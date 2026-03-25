"""@shield() decorator — automatic tracking for LLM calls."""

from __future__ import annotations

import contextvars
import functools
import logging
import time
from typing import Any, Callable

from agentshield.exceptions import (
    AgentFrozenError,
    AgentShieldError,
    AuthenticationError,
    BudgetExceededError,
    GuardrailBlockedError,
    NetworkError,
    RateLimitError,
    ServerError,
)
from agentshield.extractors import auto_extract
from agentshield.models import TrackEvent

logger = logging.getLogger("agentshield")

# Exceptions that block the developer's code — raised before/after LLM call
_BLOCKING_EXCEPTIONS = (
    BudgetExceededError,
    AgentFrozenError,
    GuardrailBlockedError,
    AuthenticationError,
)

# Exceptions that are silently swallowed so the dev is never interrupted
_SILENT_EXCEPTIONS = (ServerError, NetworkError, RateLimitError)


class _ShieldAttachments:
    """ContextVar-based storage for manual data injection via shield.attach()."""

    _data: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
        "shield_attach", default=None
    )

    @classmethod
    def attach(cls, **kwargs: Any) -> None:
        """Manually inject data into the next @shield() call in this context."""
        cls._data.set(kwargs)

    @classmethod
    def consume(cls) -> dict | None:
        """Retrieve and clear the attached data."""
        data = cls._data.get()
        cls._data.set(None)
        return data


def shield(
    agent: str,
    workflow: str | None = None,
    user_label: str | None = None,
    team_label: str | None = None,
    metadata: dict | None = None,
    model: str | None = None,
    provider: str | None = None,
    step: int | None = None,
    step_name: str | None = None,
) -> Callable:
    """Decorator that automatically tracks LLM calls.

    Usage::

        @shield(agent="my-agent")
        def call_llm(prompt: str):
            return openai_client.chat.completions.create(...)

    The decorator:
    - Detects sync vs async function automatically
    - Extracts model/token data from OpenAI/Anthropic/Google responses
    - Applies client-side PII redaction (if enabled)
    - Sends POST /v1/track without blocking the developer's code
    - Re-raises the developer's exceptions always
    - Raises BudgetExceededError / AgentFrozenError / GuardrailBlockedError
    """

    def decorator(fn: Callable) -> Callable:
        import asyncio

        if asyncio.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                start = time.monotonic()
                error_msg: str | None = None
                response = None
                status = "success"

                try:
                    response = await fn(*args, **kwargs)
                except Exception as exc:
                    status = "error"
                    error_msg = str(exc)
                    duration_ms = int((time.monotonic() - start) * 1000)
                    await _send_event_async(
                        agent=agent,
                        response=None,
                        duration_ms=duration_ms,
                        status=status,
                        workflow=workflow,
                        user_label=user_label,
                        team_label=team_label,
                        metadata=metadata,
                        model=model,
                        provider=provider,
                        step=step,
                        step_name=step_name,
                    )
                    raise

                duration_ms = int((time.monotonic() - start) * 1000)
                await _send_event_async(
                    agent=agent,
                    response=response,
                    duration_ms=duration_ms,
                    status=status,
                    workflow=workflow,
                    user_label=user_label,
                    team_label=team_label,
                    metadata=metadata,
                    model=model,
                    provider=provider,
                    step=step,
                    step_name=step_name,
                )
                return response

            return async_wrapper

        else:
            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                start = time.monotonic()
                status = "success"
                response = None

                try:
                    response = fn(*args, **kwargs)
                except Exception as exc:
                    status = "error"
                    duration_ms = int((time.monotonic() - start) * 1000)
                    _send_event_sync(
                        agent=agent,
                        response=None,
                        duration_ms=duration_ms,
                        status=status,
                        workflow=workflow,
                        user_label=user_label,
                        team_label=team_label,
                        metadata=metadata,
                        model=model,
                        provider=provider,
                        step=step,
                        step_name=step_name,
                    )
                    raise

                duration_ms = int((time.monotonic() - start) * 1000)
                _send_event_sync(
                    agent=agent,
                    response=response,
                    duration_ms=duration_ms,
                    status=status,
                    workflow=workflow,
                    user_label=user_label,
                    team_label=team_label,
                    metadata=metadata,
                    model=model,
                    provider=provider,
                    step=step,
                    step_name=step_name,
                )
                return response

            return sync_wrapper

    return decorator


# Expose shield.attach as a class method
shield.attach = _ShieldAttachments.attach  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _build_event(
    agent: str,
    response: Any,
    duration_ms: int,
    status: str,
    workflow: str | None,
    user_label: str | None,
    team_label: str | None,
    metadata: dict | None,
    model: str | None,
    provider: str | None,
    step: int | None,
    step_name: str | None,
) -> TrackEvent:
    """Build a TrackEvent from a response + decorator params."""
    from agentshield._config import get_config
    from agentshield.steps import get_session_id, next_step

    # Auto-extract from response
    extracted = auto_extract(response) if response is not None else {}
    if extracted is None:
        extracted = {}

    # Manual injection overrides auto-extraction
    attached = _ShieldAttachments.consume() or {}
    extracted.update(attached)

    # Decorator params override everything
    final_model = model or extracted.get("model")
    final_provider = provider or extracted.get("provider")
    input_tokens = extracted.get("input_tokens", 0) or 0
    output_tokens = extracted.get("output_tokens", 0) or 0
    output_text = extracted.get("output_text")
    input_text = extracted.get("input_text")

    # Session context
    session_id = get_session_id()
    final_step = step
    if session_id and final_step is None:
        final_step = next_step()

    # PII redaction
    cfg = get_config()
    if cfg.pii_redaction:
        from agentshield.pii import redact_pii
        if input_text:
            input_text, _ = redact_pii(input_text)
        if output_text:
            output_text, _ = redact_pii(output_text)

    # Local cost calculation (client-side estimate)
    cost_usd = extracted.get("cost_usd")
    if cost_usd is None and final_model and (input_tokens or output_tokens):
        from agentshield.pricing import calculate_cost
        cost_usd = calculate_cost(final_provider or "", final_model, input_tokens, output_tokens)

    return TrackEvent(
        agent=agent,
        model=final_model,
        provider=final_provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        session_id=session_id,
        step=final_step,
        step_name=step_name,
        input_text=input_text,
        output_text=output_text,
        status=status,
        duration_ms=duration_ms,
        workflow=workflow,
        user_label=user_label,
        team_label=team_label,
        metadata=metadata or {},
    )


def _send_event_sync(
    agent: str,
    response: Any,
    duration_ms: int,
    status: str,
    **kwargs: Any,
) -> None:
    """Build and send a tracking event synchronously."""
    try:
        from agentshield.client import get_client
        event = _build_event(agent=agent, response=response, duration_ms=duration_ms, status=status, **kwargs)
        client = get_client()
        track_response = client.track(event)

        # Check budget status for blocking conditions
        if track_response is not None:
            _check_blocking_response(track_response)

    except _BLOCKING_EXCEPTIONS:
        raise
    except _SILENT_EXCEPTIONS as e:
        logger.debug(f"AgentShield tracking error (swallowed): {e}")
    except Exception as e:
        logger.debug(f"AgentShield tracking error (swallowed): {e}")


async def _send_event_async(
    agent: str,
    response: Any,
    duration_ms: int,
    status: str,
    **kwargs: Any,
) -> None:
    """Build and send a tracking event asynchronously."""
    try:
        from agentshield.client import get_client
        event = _build_event(agent=agent, response=response, duration_ms=duration_ms, status=status, **kwargs)
        client = get_client()
        track_response = await client.track_async(event)

        if track_response is not None:
            _check_blocking_response(track_response)

    except _BLOCKING_EXCEPTIONS:
        raise
    except _SILENT_EXCEPTIONS as e:
        logger.debug(f"AgentShield tracking error (swallowed): {e}")
    except Exception as e:
        logger.debug(f"AgentShield tracking error (swallowed): {e}")


def _check_blocking_response(track_response: Any) -> None:
    """Raise blocking exceptions based on track response."""
    from agentshield.models import TrackResponse

    if not isinstance(track_response, TrackResponse):
        return

    if track_response.budget_status == "exceeded":
        raise BudgetExceededError(
            "Budget cap exceeded for this agent.",
            code="budget_exceeded",
        )

    if track_response.guardrail_violations:
        raise GuardrailBlockedError(
            f"Guardrail violation detected: {track_response.guardrail_violations[0]}",
            code="guardrail_blocked",
        )
