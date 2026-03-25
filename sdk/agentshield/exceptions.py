"""AgentShield SDK exception hierarchy."""

from __future__ import annotations

from typing import Any


class AgentShieldError(Exception):
    """Base exception for all AgentShield SDK errors."""

    code: str = "agentshield_error"

    def __init__(
        self,
        message: str,
        code: str | None = None,
        status_code: int = 500,
        details: dict | None = None,
        request_id: str | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.status_code = status_code
        self.details = details or {}
        self.request_id = request_id


class AuthenticationError(AgentShieldError):
    """Raised when the API key is missing, invalid, or revoked."""

    code = "auth_invalid_key"

    def __init__(self, message: str = "Authentication required", **kwargs: Any) -> None:
        kwargs.setdefault("status_code", 401)
        super().__init__(message, **kwargs)


class AuthorizationError(AgentShieldError):
    """Raised when the authenticated user lacks permission for the action."""

    code = "plan_required"

    def __init__(self, message: str = "Insufficient permissions", **kwargs: Any) -> None:
        kwargs.setdefault("status_code", 403)
        super().__init__(message, **kwargs)


class GuardrailBlockedError(AgentShieldError):
    """Raised when a guardrail rule blocks the request."""

    code = "guardrail_blocked"

    def __init__(
        self,
        message: str = "Request blocked by guardrail rule",
        rule_id: str = "",
        rule_name: str = "",
        matched: str = "",
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 403)
        super().__init__(message, **kwargs)
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.matched = matched

    @classmethod
    def from_response(cls, error: dict) -> "GuardrailBlockedError":
        details = error.get("details", {})
        return cls(
            message=error.get("message", "Request blocked by guardrail rule"),
            rule_id=details.get("rule_id", ""),
            rule_name=details.get("rule_name", ""),
            matched=details.get("matched", ""),
            code=error.get("code", "guardrail_blocked"),
            details=details,
        )


class PlanRequiredError(AuthorizationError):
    """Raised when an action requires a higher-tier plan."""

    code = "plan_required"

    def __init__(self, message: str, required_plan: str | None = None, **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.required_plan = required_plan


class ValidationError(AgentShieldError):
    """Raised when request payload fails validation."""

    code = "validation_error"

    def __init__(
        self,
        message: str = "Validation failed",
        errors: list[dict] | None = None,
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 422)
        super().__init__(message, **kwargs)
        self.errors = errors or []


class RateLimitError(AgentShieldError):
    """Raised when the rate limit is exceeded."""

    code = "rate_limit_exceeded"

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        limit: int = 0,
        remaining: int = 0,
        reset: int = 0,
        retry_after: int = 1,
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 429)
        super().__init__(message, **kwargs)
        self.limit = limit
        self.remaining = remaining
        self.reset = reset
        self.retry_after = retry_after

    @classmethod
    def from_response(cls, error: dict, headers: dict) -> "RateLimitError":
        details = error.get("details", {})
        return cls(
            message=error.get("message", "Rate limit exceeded"),
            limit=int(headers.get("x-ratelimit-limit", 0)),
            remaining=int(headers.get("x-ratelimit-remaining", 0)),
            reset=int(headers.get("x-ratelimit-reset", 0)),
            retry_after=int(headers.get("retry-after", 1)),
            code=error.get("code", "rate_limit_exceeded"),
            details=details,
        )


class BudgetExceededError(AgentShieldError):
    """Raised when the agent's budget cap has been reached."""

    code = "budget_exceeded"

    def __init__(
        self,
        message: str = "Budget cap exceeded",
        agent: str = "",
        current_usd: float = 0.0,
        max_usd: float = 0.0,
        period: str = "monthly",
        # legacy compat
        budget_remaining_usd: float | None = None,
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 429)
        super().__init__(message, **kwargs)
        self.agent = agent
        self.current_usd = current_usd
        self.max_usd = max_usd
        self.period = period
        self.budget_remaining_usd = budget_remaining_usd

    @classmethod
    def from_response(cls, error: dict) -> "BudgetExceededError":
        details = error.get("details", {})
        return cls(
            message=error.get("message", "Budget cap exceeded"),
            agent=details.get("agent", ""),
            current_usd=details.get("current_usd", 0.0),
            max_usd=details.get("max_usd", 0.0),
            period=details.get("period", "monthly"),
            code=error.get("code", "budget_exceeded"),
            details=details,
        )


class AgentFrozenError(AgentShieldError):
    """Raised when attempting to track an agent that is frozen."""

    code = "agent_frozen"

    def __init__(
        self,
        message: str = "Agent is frozen due to budget cap",
        agent: str = "",
        frozen_by: str = "",
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 400)
        super().__init__(message, **kwargs)
        self.agent = agent
        self.frozen_by = frozen_by

    @classmethod
    def from_response(cls, error: dict) -> "AgentFrozenError":
        details = error.get("details", {})
        return cls(
            message=error.get("message", "Agent is frozen"),
            agent=details.get("agent", ""),
            frozen_by=details.get("frozen_by", ""),
            code=error.get("code", "agent_frozen"),
            details=details,
        )


class ServerError(AgentShieldError):
    """Raised when the AgentShield API returns a 5xx response."""

    code = "server_error"

    def __init__(self, message: str = "Server error", **kwargs: Any) -> None:
        kwargs.setdefault("status_code", 500)
        super().__init__(message, **kwargs)


class NetworkError(AgentShieldError):
    """Raised when a network-level error prevents the request from completing."""

    code = "network_error"

    def __init__(self, message: str = "Network error", **kwargs: Any) -> None:
        kwargs.setdefault("status_code", 0)
        super().__init__(message, **kwargs)


def exception_from_response(
    status_code: int,
    data: dict,
    headers: dict,
) -> AgentShieldError:
    """Create the appropriate exception from an API error response."""
    error = data.get("error", {})
    code = error.get("code", "unknown")
    message = error.get("message", "Unknown error")
    details = error.get("details", {})
    request_id = headers.get("x-ags-request-id")

    if code == "budget_exceeded":
        exc = BudgetExceededError.from_response(error)
    elif code == "guardrail_blocked":
        exc = GuardrailBlockedError.from_response(error)
    elif code == "agent_frozen":
        exc = AgentFrozenError.from_response(error)
    elif code.startswith("auth_"):
        exc = AuthenticationError(message, code=code, status_code=status_code, details=details)
    elif code.startswith("plan_") or code == "module_not_enabled":
        exc = AuthorizationError(message, code=code, status_code=status_code, details=details)
    elif "rate_limit" in code:
        exc = RateLimitError.from_response(error, headers)
    elif status_code == 422:
        exc = ValidationError(message, code=code, status_code=status_code, details=details)
    elif status_code >= 500:
        exc = ServerError(message, code=code, status_code=status_code, details=details)
    else:
        exc = AgentShieldError(message, code=code, status_code=status_code, details=details)

    exc.request_id = request_id
    return exc
