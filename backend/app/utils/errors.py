from __future__ import annotations
from typing import Any


class AgentShieldError(Exception):
    """Base exception for all AgentShield errors."""

    code: str = "AGENTSHIELD_ERROR"
    status_code: int = 500

    def __init__(
        self,
        message: str,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class BudgetExceededError(AgentShieldError):
    code = "BUDGET_EXCEEDED"
    status_code = 429

    def __init__(self, message: str = "Budget cap exceeded", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class AgentFrozenError(AgentShieldError):
    code = "AGENT_FROZEN"
    status_code = 429

    def __init__(self, message: str = "Agent is frozen due to budget cap", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class GuardrailBlockedError(AgentShieldError):
    code = "GUARDRAIL_BLOCKED"
    status_code = 403

    def __init__(self, message: str = "Request blocked by guardrail rule", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class AuthenticationError(AgentShieldError):
    code = "AUTHENTICATION_ERROR"
    status_code = 401

    def __init__(self, message: str = "Authentication required", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class AuthorizationError(AgentShieldError):
    code = "AUTHORIZATION_ERROR"
    status_code = 403

    def __init__(self, message: str = "Insufficient permissions", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class RateLimitError(AgentShieldError):
    code = "RATE_LIMIT_EXCEEDED"
    status_code = 429

    def __init__(self, message: str = "Rate limit exceeded", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class ValidationError(AgentShieldError):
    code = "VALIDATION_ERROR"
    status_code = 422

    def __init__(self, message: str = "Validation failed", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
