"""Tests for AgentShieldClient HTTP retry logic and error mapping."""
from __future__ import annotations

import pytest
import respx
import httpx

from agentshield._config import configure
from agentshield.client import AgentShieldClient
from agentshield.exceptions import (
    AuthenticationError,
    BudgetExceededError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from agentshield.models import TrackEvent, TrackResponse

_API_URL = "http://test.agentshield.local"
_API_KEY = "ags_live_testkey"

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


def _make_client(retry_max: int = 3, retry_backoff: float = 0.0) -> AgentShieldClient:
    configure(api_key=_API_KEY, api_url=_API_URL, retry_max=retry_max, retry_backoff=retry_backoff)
    return AgentShieldClient(api_key=_API_KEY, api_url=_API_URL, retry_max=retry_max, retry_backoff=retry_backoff)


def _event() -> TrackEvent:
    return TrackEvent(agent="test-agent", model="gpt-4o", input_tokens=100, output_tokens=50)


@respx.mock
def test_client_track_success():
    respx.post(f"{_API_URL}/v1/track").mock(return_value=httpx.Response(201, json=_SUCCESS_BODY))
    client = _make_client()
    response = client.track(_event())
    assert response is not None
    assert response.agent == "test-agent"
    assert response.budget_status == "ok"


@respx.mock
def test_client_retries_on_500():
    """Client retries on 500 and succeeds on the third attempt."""
    route = respx.post(f"{_API_URL}/v1/track")
    route.side_effect = [
        httpx.Response(500, json={"error": {"code": "server_error", "message": "oops"}}),
        httpx.Response(500, json={"error": {"code": "server_error", "message": "oops"}}),
        httpx.Response(201, json=_SUCCESS_BODY),
    ]
    client = _make_client(retry_max=3, retry_backoff=0.0)
    response = client.track(_event())
    assert response is not None
    assert route.call_count == 3


@respx.mock
def test_client_retries_on_timeout():
    """Client retries on timeout and succeeds on the third attempt."""
    route = respx.post(f"{_API_URL}/v1/track")
    route.side_effect = [
        httpx.TimeoutException("timeout"),
        httpx.TimeoutException("timeout"),
        httpx.Response(201, json=_SUCCESS_BODY),
    ]
    client = _make_client(retry_max=3, retry_backoff=0.0)
    response = client.track(_event())
    assert response is not None
    assert route.call_count == 3


@respx.mock
def test_client_retries_on_429_with_retry_after():
    """Client respects Retry-After header on 429 rate limit."""
    route = respx.post(f"{_API_URL}/v1/track")
    route.side_effect = [
        httpx.Response(
            429,
            json={"error": {"code": "rate_limit_exceeded", "message": "slow down"}},
            headers={"Retry-After": "0"},
        ),
        httpx.Response(201, json=_SUCCESS_BODY),
    ]
    client = _make_client(retry_max=3, retry_backoff=0.0)
    response = client.track(_event())
    assert response is not None
    assert route.call_count == 2


@respx.mock
def test_client_no_retry_on_400():
    """Client does not retry on 400 (agent_frozen) — raises immediately."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            400,
            json={"error": {"code": "agent_frozen", "message": "frozen", "details": {}}},
        )
    )
    client = _make_client()
    from agentshield.exceptions import AgentFrozenError

    with pytest.raises(AgentFrozenError):
        client.track(_event())


@respx.mock
def test_client_no_retry_on_401():
    """Client does not retry on 401 — raises AuthenticationError."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            401,
            json={"error": {"code": "auth_invalid_key", "message": "bad key", "details": {}}},
        )
    )
    client = _make_client()
    with pytest.raises(AuthenticationError):
        client.track(_event())


@respx.mock
def test_client_max_retries_then_silent():
    """After max retries of 500, swallows ServerError silently (returns None)."""
    route = respx.post(f"{_API_URL}/v1/track")
    route.mock(
        return_value=httpx.Response(500, json={"error": {"code": "server_error", "message": "down"}})
    )
    client = _make_client(retry_max=2, retry_backoff=0.0)
    # Should NOT raise — should return None
    response = client.track(_event())
    assert response is None
    assert route.call_count == 3  # initial + 2 retries


@respx.mock
def test_client_budget_exceeded_raises():
    """Budget exceeded (429) is always raised, never retried."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            429,
            json={
                "error": {
                    "code": "budget_exceeded",
                    "message": "over budget",
                    "details": {"agent": "bot", "current_usd": 10.0, "max_usd": 5.0},
                }
            },
        )
    )
    client = _make_client()
    with pytest.raises(BudgetExceededError) as exc_info:
        client.track(_event())
    assert exc_info.value.current_usd == 10.0


@pytest.mark.asyncio
@respx.mock
async def test_client_track_async_success():
    """track_async() returns TrackResponse on success."""
    respx.post(f"{_API_URL}/v1/track").mock(return_value=httpx.Response(201, json=_SUCCESS_BODY))
    client = _make_client()
    response = await client.track_async(_event())
    assert response is not None
    assert response.agent == "test-agent"


@pytest.mark.asyncio
@respx.mock
async def test_client_track_async_retries_on_500():
    """track_async() retries on 500 and succeeds."""
    route = respx.post(f"{_API_URL}/v1/track")
    route.side_effect = [
        httpx.Response(500, json={"error": {"code": "server_error", "message": "oops"}}),
        httpx.Response(201, json=_SUCCESS_BODY),
    ]
    client = _make_client(retry_max=3, retry_backoff=0.0)
    response = await client.track_async(_event())
    assert response is not None
    assert route.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_client_track_async_max_retries_silent():
    """track_async() swallows ServerError after max retries."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(500, json={"error": {"code": "server_error", "message": "down"}})
    )
    client = _make_client(retry_max=1, retry_backoff=0.0)
    response = await client.track_async(_event())
    assert response is None


@pytest.mark.asyncio
@respx.mock
async def test_client_track_async_raises_budget_exceeded():
    """track_async() re-raises BudgetExceededError immediately."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            429,
            json={"error": {"code": "budget_exceeded", "message": "over",
                            "details": {"agent": "x", "current_usd": 5.0, "max_usd": 3.0}}},
        )
    )
    client = _make_client()
    with pytest.raises(BudgetExceededError):
        await client.track_async(_event())


def test_client_missing_api_key_raises():
    """Creating AgentShieldClient without api_key raises AuthenticationError."""
    from agentshield._config import _config as cfg
    original_key = cfg.api_key
    cfg.api_key = None
    try:
        import os
        env_key = os.environ.pop("AGENTSHIELD_API_KEY", None)
        with pytest.raises(AuthenticationError):
            AgentShieldClient(api_key=None, api_url=_API_URL)
        if env_key:
            os.environ["AGENTSHIELD_API_KEY"] = env_key
    finally:
        cfg.api_key = original_key


def test_client_close():
    """client.close() runs without error."""
    client = _make_client()
    client.close()


@respx.mock
def test_client_rate_limit_max_retries_silent():
    """After max retries of 429, returns None silently."""
    respx.post(f"{_API_URL}/v1/track").mock(
        return_value=httpx.Response(
            429,
            json={"error": {"code": "rate_limit_exceeded", "message": "slow"}},
            headers={"Retry-After": "0"},
        )
    )
    client = _make_client(retry_max=2, retry_backoff=0.0)
    response = client.track(_event())
    assert response is None


@respx.mock
def test_client_timeout_max_retries_silent():
    """After max timeout retries, returns None silently."""
    respx.post(f"{_API_URL}/v1/track").side_effect = httpx.TimeoutException("timeout")
    client = _make_client(retry_max=2, retry_backoff=0.0)
    response = client.track(_event())
    assert response is None


@respx.mock
def test_client_network_error_retries_then_silent():
    """Network errors retry and eventually return None silently."""
    route = respx.post(f"{_API_URL}/v1/track")
    route.side_effect = [
        httpx.NetworkError("connection refused"),
        httpx.NetworkError("connection refused"),
        httpx.Response(201, json=_SUCCESS_BODY),
    ]
    client = _make_client(retry_max=3, retry_backoff=0.0)
    response = client.track(_event())
    assert response is not None
    assert route.call_count == 3


def test_reset_client():
    """reset_client() clears the singleton."""
    from agentshield.client import get_client, reset_client
    configure(api_key=_API_KEY, api_url=_API_URL)
    c1 = get_client()
    reset_client()
    from agentshield import client as client_mod
    assert client_mod._client is None


@respx.mock
def test_client_returns_track_response_fields():
    """Verify all TrackResponse fields are correctly parsed."""
    body = {
        "event_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "agent": "my-bot",
        "cost_usd": 0.0042,
        "budget_remaining_usd": 4.5,
        "budget_status": "ok",
        "guardrail_violations": [],
        "pii_detected": ["email"],
        "warnings": ["Unknown model 'x'"],
    }
    respx.post(f"{_API_URL}/v1/track").mock(return_value=httpx.Response(201, json=body))
    client = _make_client()
    resp = client.track(_event())
    assert resp is not None
    assert resp.cost_usd == 0.0042
    assert resp.budget_remaining_usd == 4.5
    assert resp.pii_detected == ["email"]
    assert len(resp.warnings) == 1
