"""AgentShield HTTP client with retry logic and error mapping."""

from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

from agentshield._config import get_config
from agentshield.exceptions import (
    AgentFrozenError,
    AgentShieldError,
    AuthenticationError,
    AuthorizationError,
    BudgetExceededError,
    GuardrailBlockedError,
    NetworkError,
    RateLimitError,
    ServerError,
    ValidationError,
    exception_from_response,
)
from agentshield.models import TrackEvent, TrackResponse

logger = logging.getLogger("agentshield")

# Exceptions that must always be raised to the developer
_BLOCKING_EXCEPTIONS = (
    BudgetExceededError,
    AgentFrozenError,
    GuardrailBlockedError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
)

_SDK_VERSION = "0.1.0"
_DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": f"agentshield-python/{_SDK_VERSION}",
}


def _log_debug(msg: str) -> None:
    cfg = get_config()
    if cfg.debug:
        logger.debug(msg)


class AgentShieldClient:
    """HTTP client for the AgentShield API with automatic retry logic."""

    def __init__(
        self,
        api_key: str | None = None,
        api_url: str | None = None,
        timeout: float | None = None,
        retry_max: int | None = None,
        retry_backoff: float | None = None,
    ) -> None:
        cfg = get_config()

        resolved_key = api_key or cfg.api_key or os.environ.get("AGENTSHIELD_API_KEY")
        if not resolved_key:
            raise AuthenticationError(
                "API key not configured. Call agentshield.configure() first "
                "or set AGENTSHIELD_API_KEY environment variable."
            )

        self._api_key = resolved_key
        self._api_url = api_url or cfg.api_url
        self._timeout = timeout if timeout is not None else cfg.timeout
        self._retry_max = retry_max if retry_max is not None else cfg.retry_max
        self._retry_backoff = retry_backoff if retry_backoff is not None else cfg.retry_backoff

        headers = {**_DEFAULT_HEADERS, "Authorization": f"Bearer {self._api_key}"}

        self._http = httpx.Client(
            base_url=self._api_url,
            timeout=self._timeout,
            headers=headers,
        )
        self._async_http = httpx.AsyncClient(
            base_url=self._api_url,
            timeout=self._timeout,
            headers=headers,
        )

    def track(self, event: TrackEvent) -> TrackResponse | None:
        """Send a tracking event synchronously.

        Returns TrackResponse on success, None if a non-blocking error occurred
        (ServerError, NetworkError, RateLimitError after max retries).
        Raises blocking exceptions (BudgetExceededError, AgentFrozenError,
        GuardrailBlockedError, AuthenticationError, AuthorizationError).
        """
        payload = event.to_dict()

        for attempt in range(self._retry_max + 1):
            try:
                resp = self._http.post("/v1/track", json=payload)
                return self._handle_response(resp)

            except _BLOCKING_EXCEPTIONS:
                raise

            except RateLimitError as e:
                if attempt >= self._retry_max:
                    _log_debug(f"Rate limit after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = e.retry_after or self._retry_backoff * (2**attempt)
                _log_debug(f"Rate limited, sleeping {sleep_secs}s (attempt {attempt + 1})")
                time.sleep(sleep_secs)

            except ServerError:
                if attempt >= self._retry_max:
                    _log_debug(f"Server error after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = self._retry_backoff * (2**attempt)
                _log_debug(f"Server error, sleeping {sleep_secs}s (attempt {attempt + 1})")
                time.sleep(sleep_secs)

            except httpx.TimeoutException:
                if attempt >= self._retry_max:
                    _log_debug(f"Timeout after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = self._retry_backoff * (2**attempt)
                _log_debug(f"Timeout, sleeping {sleep_secs}s (attempt {attempt + 1})")
                time.sleep(sleep_secs)

            except httpx.NetworkError:
                if attempt >= self._retry_max:
                    _log_debug(f"Network error after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = self._retry_backoff * (2**attempt)
                _log_debug(f"Network error, sleeping {sleep_secs}s (attempt {attempt + 1})")
                time.sleep(sleep_secs)

            except AgentShieldError:
                raise

        return None

    async def track_async(self, event: TrackEvent) -> TrackResponse | None:
        """Send a tracking event asynchronously.

        Same semantics as track() but uses an async HTTP client.
        """
        import asyncio

        payload = event.to_dict()

        for attempt in range(self._retry_max + 1):
            try:
                resp = await self._async_http.post("/v1/track", json=payload)
                return self._handle_response(resp)

            except _BLOCKING_EXCEPTIONS:
                raise

            except RateLimitError as e:
                if attempt >= self._retry_max:
                    _log_debug(f"Rate limit after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = e.retry_after or self._retry_backoff * (2**attempt)
                _log_debug(f"Rate limited, sleeping {sleep_secs}s (attempt {attempt + 1})")
                await asyncio.sleep(sleep_secs)

            except ServerError:
                if attempt >= self._retry_max:
                    _log_debug(f"Server error after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = self._retry_backoff * (2**attempt)
                _log_debug(f"Server error, sleeping {sleep_secs}s (attempt {attempt + 1})")
                await asyncio.sleep(sleep_secs)

            except httpx.TimeoutException:
                if attempt >= self._retry_max:
                    _log_debug(f"Timeout after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = self._retry_backoff * (2**attempt)
                _log_debug(f"Timeout, sleeping {sleep_secs}s (attempt {attempt + 1})")
                await asyncio.sleep(sleep_secs)

            except httpx.NetworkError:
                if attempt >= self._retry_max:
                    _log_debug(f"Network error after {attempt + 1} attempts, swallowing silently")
                    return None
                sleep_secs = self._retry_backoff * (2**attempt)
                _log_debug(f"Network error, sleeping {sleep_secs}s (attempt {attempt + 1})")
                await asyncio.sleep(sleep_secs)

            except AgentShieldError:
                raise

        return None

    def _handle_response(self, resp: httpx.Response) -> TrackResponse:
        """Parse the HTTP response into a TrackResponse or raise appropriate exception."""
        if resp.status_code == 201:
            data = resp.json()
            return TrackResponse(
                event_id=str(data["event_id"]),
                agent=data["agent"],
                cost_usd=data.get("cost_usd"),
                budget_remaining_usd=data.get("budget_remaining_usd"),
                budget_status=data.get("budget_status", "ok"),
                guardrail_violations=data.get("guardrail_violations", []),
                pii_detected=data.get("pii_detected", []),
                warnings=data.get("warnings", []),
            )

        try:
            data = resp.json()
        except Exception:
            data = {}

        headers = {k.lower(): v for k, v in resp.headers.items()}
        raise exception_from_response(resp.status_code, data, headers)

    def close(self) -> None:
        """Close the underlying HTTP clients."""
        self._http.close()

    async def aclose(self) -> None:
        """Close the async HTTP client."""
        await self._async_http.aclose()


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_client: AgentShieldClient | None = None


def get_client(api_key: str | None = None) -> AgentShieldClient:
    """Get or create the global AgentShieldClient singleton."""
    global _client
    if _client is None:
        config = get_config()
        _client = AgentShieldClient(
            api_key=api_key or config.api_key,
            api_url=config.api_url,
            timeout=config.timeout,
            retry_max=config.retry_max,
            retry_backoff=config.retry_backoff,
        )
    return _client


def reset_client() -> None:
    """Reset the global client singleton (useful for testing)."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
