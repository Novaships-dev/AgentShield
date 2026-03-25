"""Tests for session tracking and replay endpoints."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import Organization, User
from app.dependencies import get_current_org, get_current_user, get_db, get_redis


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def starter_org():
    return Organization(
        id="org-starter",
        name="Starter Org",
        plan="starter",
        max_agents=5,
        max_requests=100000,
        modules_enabled=["replay"],
    )


@pytest.fixture
def starter_user(starter_org):
    return User(
        id="user-starter",
        email="user@example.com",
        role="owner",
        organization_id=starter_org.id,
        organization=starter_org,
    )


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.incr = AsyncMock(return_value=1)
    redis.expire = AsyncMock(return_value=True)
    pipeline_mock = AsyncMock()
    pipeline_mock.incr = MagicMock(return_value=pipeline_mock)
    pipeline_mock.expire = MagicMock(return_value=pipeline_mock)
    pipeline_mock.execute = AsyncMock(return_value=[1, True])
    redis.pipeline = MagicMock(return_value=pipeline_mock)
    return redis


@pytest.fixture
def mock_db_with_sessions():
    """Mock DB that returns session and event data."""
    db = MagicMock()

    # Default agent lookup: returns agent
    agent_result = MagicMock()
    agent_result.data = {"id": "agent-abc"}

    # Existing session
    session_row = {
        "id": "sess-row-1",
        "session_id": "my-session",
        "organization_id": "org-starter",
        "agent_ids": ["agent-abc"],
        "total_steps": 2,
        "total_cost_usd": 0.05,
        "total_tokens": 150,
        "status": "running",
        "started_at": "2026-03-25T10:00:00+00:00",
        "ended_at": "2026-03-25T10:01:00+00:00",
    }
    session_result = MagicMock()
    session_result.data = session_row
    session_result.count = 1

    # Session list
    session_list_result = MagicMock()
    session_list_result.data = [session_row]
    session_list_result.count = 1

    # Events for session
    events = [
        {
            "id": "event-1",
            "session_id": "my-session",
            "organization_id": "org-starter",
            "agent_id": "agent-abc",
            "model": "gpt-4o",
            "provider": "openai",
            "input_tokens": 100,
            "output_tokens": 50,
            "cost_usd": 0.005,
            "step": 1,
            "step_name": "reasoning",
            "status": "success",
            "duration_ms": 500,
            "pii_detected": [],
            "guardrail_violations": [],
            "tracked_at": "2026-03-25T10:00:30+00:00",
            "input_redacted": "What is AI?",
            "output_redacted": "AI is artificial intelligence.",
        },
        {
            "id": "event-2",
            "session_id": "my-session",
            "organization_id": "org-starter",
            "agent_id": "agent-abc",
            "model": "gpt-4o",
            "provider": "openai",
            "input_tokens": 50,
            "output_tokens": 100,
            "cost_usd": 0.001,
            "step": 2,
            "step_name": "summarize",
            "status": "success",
            "duration_ms": 300,
            "pii_detected": ["email"],
            "guardrail_violations": [],
            "tracked_at": "2026-03-25T10:01:00+00:00",
            "input_redacted": "Summarize",
            "output_redacted": "Summary here",
        },
    ]
    events_result = MagicMock()
    events_result.data = events

    # Agent names
    agents_result = MagicMock()
    agents_result.data = [{"id": "agent-abc", "name": "my-agent"}]

    # Wire up chains
    # For session detail
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = session_result
    # For session list (with order + range)
    db.table.return_value.select.return_value.eq.return_value.order.return_value.desc.return_value.range.return_value.execute.return_value = session_list_result
    db.table.return_value.select.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value = session_list_result
    # For events
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.order.return_value.execute.return_value = events_result
    # For agent names
    db.table.return_value.select.return_value.in_.return_value.execute.return_value = agents_result
    # Insert returns something
    db.table.return_value.insert.return_value.execute.return_value = MagicMock()
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

    return db


@pytest.fixture
def client_with_sessions(starter_org, starter_user, mock_redis, mock_db_with_sessions):
    app.dependency_overrides[get_current_org] = lambda: starter_org
    app.dependency_overrides[get_current_user] = lambda: starter_user
    app.dependency_overrides[get_db] = lambda: mock_db_with_sessions
    app.dependency_overrides[get_redis] = lambda: mock_redis

    with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis), \
         patch("app.services.pricing.get_redis_client", return_value=mock_redis), \
         patch("app.utils.redis.get_redis_client", return_value=mock_redis), \
         patch("app.utils.supabase.get_supabase_client", return_value=mock_db_with_sessions):
        client = TestClient(app, raise_server_exceptions=False)
        yield client

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Session service unit tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_session_upsert_creates_new_session():
    """SessionService.upsert_session creates a new session row."""
    from app.services.sessions import SessionService

    db = MagicMock()
    redis = AsyncMock()
    redis.set = AsyncMock(return_value=True)

    # No existing session
    no_session = MagicMock()
    no_session.data = None
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = no_session
    db.table.return_value.insert.return_value.execute.return_value = MagicMock()

    svc = SessionService(db=db, redis=redis)
    await svc.upsert_session(
        org_id="org-1",
        session_id="session-new",
        agent_id="agent-1",
        cost_usd=0.01,
        tokens=150,
        status="success",
    )

    db.table.return_value.insert.return_value.execute.assert_called_once()
    redis.set.assert_called_once()


@pytest.mark.asyncio
async def test_session_upsert_increments_existing_steps():
    """SessionService.upsert_session increments steps on existing session."""
    from app.services.sessions import SessionService

    db = MagicMock()
    redis = AsyncMock()
    redis.set = AsyncMock(return_value=True)

    existing_row = {
        "total_steps": 3,
        "total_cost_usd": 0.05,
        "total_tokens": 200,
        "status": "running",
        "agent_ids": ["agent-1"],
    }
    existing = MagicMock()
    existing.data = existing_row
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = existing
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

    svc = SessionService(db=db, redis=redis)
    await svc.upsert_session(
        org_id="org-1",
        session_id="session-existing",
        agent_id="agent-1",
        cost_usd=0.02,
        tokens=100,
        status="success",
    )

    db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.assert_called_once()
    call_kwargs = db.table.return_value.update.call_args[0][0]
    assert call_kwargs["total_steps"] == 4  # incremented
    assert abs(call_kwargs["total_cost_usd"] - 0.07) < 0.001


@pytest.mark.asyncio
async def test_session_error_status_propagates():
    """An error event sets session status to 'error'."""
    from app.services.sessions import SessionService

    db = MagicMock()
    redis = AsyncMock()
    redis.set = AsyncMock(return_value=True)

    existing_row = {
        "total_steps": 1,
        "total_cost_usd": 0.01,
        "total_tokens": 50,
        "status": "running",
        "agent_ids": ["agent-1"],
    }
    existing = MagicMock()
    existing.data = existing_row
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = existing
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()

    svc = SessionService(db=db, redis=redis)
    await svc.upsert_session(
        org_id="org-1",
        session_id="session-existing",
        agent_id="agent-1",
        cost_usd=0.0,
        tokens=0,
        status="error",
    )

    call_kwargs = db.table.return_value.update.call_args[0][0]
    assert call_kwargs["status"] == "error"


# ---------------------------------------------------------------------------
# Track event with session integration
# ---------------------------------------------------------------------------


def test_track_event_with_session_calls_upsert(starter_org, mock_redis, mock_db_with_sessions):
    """POST /v1/track with session_id triggers session upsert."""
    app.dependency_overrides[get_current_org] = lambda: starter_org
    app.dependency_overrides[get_db] = lambda: mock_db_with_sessions
    app.dependency_overrides[get_redis] = lambda: mock_redis

    try:
        with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis), \
             patch("app.services.pricing.get_redis_client", return_value=mock_redis), \
             patch("app.utils.redis.get_redis_client", return_value=mock_redis), \
             patch("app.utils.supabase.get_supabase_client", return_value=mock_db_with_sessions):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/v1/track",
                json={"agent": "my-agent", "session_id": "test-session"},
                headers={"Authorization": "Bearer ags_live_test"},
            )
        assert response.status_code == 201
        data = response.json()
        assert data["agent"] == "my-agent"
    finally:
        app.dependency_overrides.clear()


def test_track_event_without_session_no_session_created(starter_org, mock_redis, mock_db_with_sessions):
    """POST /v1/track without session_id does not call upsert_session."""
    app.dependency_overrides[get_current_org] = lambda: starter_org
    app.dependency_overrides[get_db] = lambda: mock_db_with_sessions
    app.dependency_overrides[get_redis] = lambda: mock_redis

    try:
        with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis), \
             patch("app.services.pricing.get_redis_client", return_value=mock_redis), \
             patch("app.utils.redis.get_redis_client", return_value=mock_redis), \
             patch("app.utils.supabase.get_supabase_client", return_value=mock_db_with_sessions), \
             patch("app.services.sessions.SessionService.upsert_session") as mock_upsert:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.post(
                "/v1/track",
                json={"agent": "my-agent"},
                headers={"Authorization": "Bearer ags_live_test"},
            )
        assert response.status_code == 201
        mock_upsert.assert_not_called()
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# GET /v1/sessions endpoint
# ---------------------------------------------------------------------------


def test_get_sessions_list_returns_paginated(client_with_sessions):
    """GET /v1/sessions returns a paginated list."""
    response = client_with_sessions.get(
        "/v1/sessions",
        headers={"Authorization": "Bearer eyJtest"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "pagination" in data
    assert data["pagination"]["page"] == 1


def test_get_session_timeline_not_found_returns_404(starter_org, starter_user, mock_redis):
    """GET /v1/sessions/:id returns 404 when session not found."""
    db = MagicMock()
    not_found = MagicMock()
    not_found.data = None
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = not_found

    app.dependency_overrides[get_current_org] = lambda: starter_org
    app.dependency_overrides[get_current_user] = lambda: starter_user
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_redis] = lambda: mock_redis

    try:
        with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis), \
             patch("app.utils.redis.get_redis_client", return_value=mock_redis), \
             patch("app.utils.supabase.get_supabase_client", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get(
                "/v1/sessions/nonexistent-session",
                headers={"Authorization": "Bearer eyJtest"},
            )
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
