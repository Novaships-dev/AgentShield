"""AgentShield SDK exception hierarchy."""

from __future__ import annotations

from typing import Any


class AgentShieldError(Exception):
    """Base exception for all AgentShield SDK errors."""

    code: str = "AGENTSHIELD_ERROR"

    def __init__(self, message: str, code: str | None = None, **kwargs: Any) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


class AuthenticationError(AgentShieldError):
    """Raised when the API key is missing, invalid, or revoked."""

    code = "AUTHENTICATION_ERROR"


class AuthorizationError(AgentShieldError):
    """Raised when the authenticated user lacks permission for the action."""

    code = "AUTHORIZATION_ERROR"


class GuardrailBlockedError(AgentShieldError):
    """Raised when a guardrail rule blocks the request."""

    code = "GUARDRAIL_BLOCKED"

    def __init__(self, message: str, violations: list[str] | None = None, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.violations = violations or []


class PlanRequiredError(AgentShieldError):
    """Raised when an action requires a higher-tier plan."""

    code = "PLAN_REQUIRED"

    def __init__(self, message: str, required_plan: str | None = None, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.required_plan = required_plan


class ValidationError(AgentShieldError):
    """Raised when request payload fails validation."""

    code = "VALIDATION_ERROR"

    def __init__(self, message: str, errors: list[dict] | None = None, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.errors = errors or []


class RateLimitError(AgentShieldError):
    """Raised when the rate limit is exceeded."""

    code = "RATE_LIMIT_EXCEEDED"

    def __init__(self, message: str, retry_after: int | None = None, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class BudgetExceededError(AgentShieldError):
    """Raised when the agent's budget cap has been reached."""

    code = "BUDGET_EXCEEDED"

    def __init__(
        self,
        message: str,
        budget_remaining_usd: float | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(message, **kwargs)
        self.budget_remaining_usd = budget_remaining_usd


class AgentFrozenError(AgentShieldError):
    """Raised when attempting to track an agent that is frozen."""

    code = "AGENT_FROZEN"


class ServerError(AgentShieldError):
    """Raised when the AgentShield API returns a 5xx response."""

    code = "SERVER_ERROR"

    def __init__(self, message: str, status_code: int | None = None, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.status_code = status_code


class NetworkError(AgentShieldError):
    """Raised when a network-level error prevents the request from completing."""

    code = "NETWORK_ERROR"
