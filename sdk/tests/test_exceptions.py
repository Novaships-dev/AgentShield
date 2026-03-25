"""Tests for exception enrichment and factory functions."""
import pytest

from agentshield.exceptions import (
    AgentFrozenError,
    AgentShieldError,
    AuthenticationError,
    BudgetExceededError,
    GuardrailBlockedError,
    RateLimitError,
    ServerError,
    ValidationError,
    exception_from_response,
)


def test_budget_exceeded_from_response():
    error = {
        "code": "budget_exceeded",
        "message": "Budget exceeded",
        "details": {"agent": "my-bot", "current_usd": 10.5, "max_usd": 5.0, "period": "daily"},
    }
    exc = BudgetExceededError.from_response(error)
    assert exc.agent == "my-bot"
    assert exc.current_usd == 10.5
    assert exc.max_usd == 5.0
    assert exc.period == "daily"
    assert exc.code == "budget_exceeded"


def test_guardrail_blocked_from_response():
    error = {
        "code": "guardrail_blocked",
        "message": "Blocked by rule",
        "details": {"rule_id": "rule-1", "rule_name": "No swearing", "matched": "****"},
    }
    exc = GuardrailBlockedError.from_response(error)
    assert exc.rule_id == "rule-1"
    assert exc.rule_name == "No swearing"
    assert exc.matched == "****"


def test_agent_frozen_from_response():
    error = {
        "code": "agent_frozen",
        "message": "Agent frozen",
        "details": {"agent": "bot", "frozen_by": "budget_cap"},
    }
    exc = AgentFrozenError.from_response(error)
    assert exc.agent == "bot"
    assert exc.frozen_by == "budget_cap"


def test_rate_limit_from_response():
    error = {"code": "rate_limit_exceeded", "message": "Too fast", "details": {}}
    headers = {
        "x-ratelimit-limit": "100",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1234567890",
        "retry-after": "5",
    }
    exc = RateLimitError.from_response(error, headers)
    assert exc.limit == 100
    assert exc.remaining == 0
    assert exc.retry_after == 5


def test_exception_factory_budget_exceeded():
    data = {"error": {"code": "budget_exceeded", "message": "over", "details": {}}}
    exc = exception_from_response(429, data, {})
    assert isinstance(exc, BudgetExceededError)


def test_exception_factory_guardrail_blocked():
    data = {"error": {"code": "guardrail_blocked", "message": "blocked", "details": {}}}
    exc = exception_from_response(403, data, {})
    assert isinstance(exc, GuardrailBlockedError)


def test_exception_factory_agent_frozen():
    data = {"error": {"code": "agent_frozen", "message": "frozen", "details": {}}}
    exc = exception_from_response(400, data, {})
    assert isinstance(exc, AgentFrozenError)


def test_exception_factory_auth_error():
    data = {"error": {"code": "auth_invalid_key", "message": "bad key", "details": {}}}
    exc = exception_from_response(401, data, {})
    assert isinstance(exc, AuthenticationError)


def test_exception_factory_plan_error():
    data = {"error": {"code": "plan_required_starter", "message": "upgrade", "details": {}}}
    exc = exception_from_response(403, data, {})
    from agentshield.exceptions import AuthorizationError
    assert isinstance(exc, AuthorizationError)


def test_exception_factory_validation():
    data = {"error": {"code": "validation_error", "message": "bad input", "details": {}}}
    exc = exception_from_response(422, data, {})
    assert isinstance(exc, ValidationError)


def test_exception_factory_server_error():
    data = {"error": {"code": "server_error", "message": "oops", "details": {}}}
    exc = exception_from_response(500, data, {})
    assert isinstance(exc, ServerError)


def test_exception_request_id_from_header():
    data = {"error": {"code": "server_error", "message": "oops", "details": {}}}
    headers = {"x-ags-request-id": "req-abc-123"}
    exc = exception_from_response(500, data, headers)
    assert exc.request_id == "req-abc-123"


def test_base_exception_repr():
    exc = AgentShieldError("test error", code="test_code", status_code=500)
    r = repr(exc)
    assert "AgentShieldError" in r
    assert "test_code" in r


def test_exception_factory_rate_limit():
    data = {"error": {"code": "rate_limit_exceeded", "message": "slow", "details": {}}}
    exc = exception_from_response(429, data, {"retry-after": "2"})
    assert isinstance(exc, RateLimitError)
    assert exc.retry_after == 2
