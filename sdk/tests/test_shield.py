"""Tests for the @shield() decorator."""
from __future__ import annotations

import pytest
import respx
import httpx

from agentshield._config import configure
from agentshield.shield import shield
from agentshield.sessions import session

_API_URL = "http://shield.agentshield.local"
_API_KEY = "ags_live_shieldtest"

_SUCCESS_BODY = {
    "event_id": "00000000-0000-0000-0000-000000000001",
    "agent": "test-agent",
    "cost_usd": 0.001,
    "budget_remaining_usd": None,
    "budget_status": "ok",
    "guardrail_violations": [],
    "pii_detected": [],
    "warnings": [],
}


@pytest.fixture(autouse=True)
def configure_sdk():
    configure(api_key=_API_KEY, api_url=_API_URL, retry_max=0, retry_backoff=0.0, pii_redaction=False)
    yield


class _Usage:
    prompt_tokens = 100
    completion_tokens = 50


class _Msg:
    content = "Hello!"


class _Choice:
    message = _Msg()


class _OpenAIResp:
    model = "gpt-4o"
    usage = _Usage()
    choices = [_Choice()]


@respx.mock
def test_shield_sync_captures_openai_response():
    """@shield tracks a sync function returning an OpenAI response."""
    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    result = fake_llm()
    assert result.model == "gpt-4o"
    assert route.call_count == 1

    # Verify sent payload contains extracted data
    import json
    payload = json.loads(route.calls[0].request.content)
    assert payload["agent"] == "test-agent"
    assert payload["input_tokens"] == 100
    assert payload["output_tokens"] == 50


@pytest.mark.asyncio
@respx.mock
async def test_shield_async_captures_response():
    """@shield tracks an async function."""
    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    async def fake_async_llm():
        return _OpenAIResp()

    result = await fake_async_llm()
    assert result.model == "gpt-4o"
    assert route.call_count == 1


@respx.mock
def test_shield_never_blocks_on_api_failure():
    """When the AgentShield API returns 500, the dev's function still works."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(500, json={"error": {"code": "server_error", "message": "down"}})
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    # Should NOT raise, should return result normally
    result = fake_llm()
    assert result.model == "gpt-4o"


@respx.mock
def test_shield_raises_budget_exceeded():
    """BudgetExceededError from the API is re-raised to the developer."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            429,
            json={
                "error": {
                    "code": "budget_exceeded",
                    "message": "budget exceeded",
                    "details": {"agent": "bot", "current_usd": 100.0, "max_usd": 50.0},
                }
            },
        )
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    from agentshield.exceptions import BudgetExceededError
    with pytest.raises(BudgetExceededError):
        fake_llm()


@respx.mock
def test_shield_raises_agent_frozen():
    """AgentFrozenError from the API is re-raised to the developer."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            400,
            json={"error": {"code": "agent_frozen", "message": "frozen", "details": {}}},
        )
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    from agentshield.exceptions import AgentFrozenError
    with pytest.raises(AgentFrozenError):
        fake_llm()


@respx.mock
def test_shield_returns_original_response_untouched():
    """The decorator always returns the original response object from the function."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    original = _OpenAIResp()

    @shield(agent="test-agent")
    def fake_llm():
        return original

    result = fake_llm()
    assert result is original


@respx.mock
def test_shield_sends_error_status_on_dev_exception():
    """When the developer's function raises, @shield sends status='error' and re-raises."""
    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    def failing_llm():
        raise ValueError("dev code broke")

    with pytest.raises(ValueError, match="dev code broke"):
        failing_llm()

    assert route.call_count == 1
    import json
    payload = json.loads(route.calls[0].request.content)
    assert payload["status"] == "error"


@respx.mock
def test_shield_with_session_sends_session_id():
    """@shield inside session() includes session_id and step in the payload."""
    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    with session("my-session-abc"):
        fake_llm()

    import json
    payload = json.loads(route.calls[0].request.content)
    assert payload.get("session_id") == "my-session-abc"
    assert payload.get("step") == 1


@respx.mock
def test_shield_with_pii_redaction():
    """@shield applies client-side PII redaction when enabled."""
    configure(api_key=_API_KEY, api_url=_API_URL, retry_max=0, retry_backoff=0.0, pii_redaction=True)

    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    shield.attach(input_text="Contact john@example.com", output_text="Hello John")
    fake_llm()

    import json
    payload = json.loads(route.calls[0].request.content)
    # PII should be redacted
    assert "john@example.com" not in (payload.get("input_text") or "")
    assert "john@example.com" not in (payload.get("output_text") or "")


@pytest.mark.asyncio
@respx.mock
async def test_shield_async_sends_error_on_exception():
    """Async @shield sends status='error' when dev function raises."""
    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    async def failing_async():
        raise ValueError("async dev error")

    with pytest.raises(ValueError):
        await failing_async()

    assert route.call_count == 1
    import json
    payload = json.loads(route.calls[0].request.content)
    assert payload["status"] == "error"


@respx.mock
def test_shield_with_session_increments_steps():
    """Multiple @shield calls in same session get sequential step numbers."""
    route = respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(201, json=_SUCCESS_BODY)
    )

    @shield(agent="test-agent")
    def fake_llm():
        return _OpenAIResp()

    with session("step-session"):
        fake_llm()
        fake_llm()
        fake_llm()

    import json
    steps = [json.loads(call.request.content).get("step") for call in route.calls]
    assert steps == [1, 2, 3]
