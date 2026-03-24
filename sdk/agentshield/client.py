"""HTTP client stub — will be fully implemented in Sprint 2."""

from __future__ import annotations

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
)
from agentshield.models import TrackEvent, TrackResponse

_ERROR_MAP: dict[str, type[AgentShieldError]] = {
    "AUTHENTICATION_ERROR": AuthenticationError,
    "AUTHORIZATION_ERROR": AuthorizationError,
    "GUARDRAIL_BLOCKED": GuardrailBlockedError,
    "VALIDATION_ERROR": ValidationError,
    "RATE_LIMIT_EXCEEDED": RateLimitError,
    "BUDGET_EXCEEDED": BudgetExceededError,
    "AGENT_FROZEN": AgentFrozenError,
}


class AgentShieldClient:
    """Synchronous HTTP client for the AgentShield API.

    Full implementation will be added in Sprint 2.
    """

    def __init__(self) -> None:
        cfg = get_config()
        if not cfg.api_key:
            raise AuthenticationError("API key not configured. Call agentshield.configure() first.")
        self._cfg = cfg
        self._http = httpx.Client(
            base_url=cfg.api_url,
            timeout=cfg.timeout,
            headers={
                "Authorization": f"Bearer {cfg.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "agentshield-python/0.1.0",
            },
        )

    def track(self, event: TrackEvent) -> TrackResponse:
        """Send a tracking event to the AgentShield API.

        Stub — full implementation in Sprint 2.
        """
        raise NotImplementedError("track() will be implemented in Sprint 2")

    def close(self) -> None:
        self._http.close()
