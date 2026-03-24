"""Tests for POST /v1/track endpoint using dependency overrides."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import Organization
from app.dependencies import get_current_org, get_db, get_redis


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def free_org():
    return Organization(
        id="org-free",
        name="Free Org",
        plan="free",
        max_agents=1,
        max_requests=10000,
        modules_enabled=[],
    )


@pytest.fixture
def pro_org():
    return Organization(
        id="org-pro",
        name="Pro Org",
        plan="pro",
        max_agents=20,
        max_requests=1000000,
        modules_enabled=["pii", "guardrails"],
    )


@pytest.fixture
def mock_redis():
    """Mock async Redis client that supports pipeline and basic operations."""
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
def mock_db():
    """Mock Supabase DB that simulates agent not found, then creates it."""
    db = MagicMock()

    # Agent lookup: not found
    agent_find = MagicMock()
    agent_find.data = None

    # Agent count for plan limits: 0 agents
    agent_count = MagicMock()
    agent_count.count = 0

    # Agent insert result
    agent_insert = MagicMock()
    agent_insert.data = [{"id": "agent-123"}]

    # Event insert result
    event_insert = MagicMock()

    # Chain: .table().select().eq().eq().maybe_single().execute() → agent_find
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = agent_find
    # Chain: .table().select().eq().eq().execute() → agent_count (for plan limits)
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = agent_count
    # Insert returns something
    db.table.return_value.insert.return_value.execute.return_value = agent_insert

    return db


@pytest.fixture
def client_with_overrides(free_org, mock_redis, mock_db):
    """TestClient with dependency overrides for free org; patches Redis/DB in middleware too."""
    app.dependency_overrides[get_current_org] = lambda: free_org
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_redis] = lambda: mock_redis

    with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis), \
         patch("app.services.pricing.get_redis_client", return_value=mock_redis), \
         patch("app.utils.redis.get_redis_client", return_value=mock_redis), \
         patch("app.utils.supabase.get_supabase_client", return_value=mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def client_with_pro_org(pro_org, mock_redis, mock_db):
    """TestClient with dependency overrides for pro org."""
    app.dependency_overrides[get_current_org] = lambda: pro_org
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_redis] = lambda: mock_redis

    with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis), \
         patch("app.services.pricing.get_redis_client", return_value=mock_redis), \
         patch("app.utils.redis.get_redis_client", return_value=mock_redis), \
         patch("app.utils.supabase.get_supabase_client", return_value=mock_db):
        client = TestClient(app, raise_server_exceptions=False)
        yield client

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Basic track endpoint tests
# ---------------------------------------------------------------------------

class TestTrackEndpoint:
    def test_track_basic_event(self, client_with_overrides):
        """Track a basic event with agent name only."""
        response = client_with_overrides.post(
            "/v1/track",
            json={"agent": "my-agent"},
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "event_id" in data
        assert data["agent"] == "my-agent"
        assert data["budget_status"] == "ok"

    def test_track_with_model_and_tokens(self, client_with_overrides):
        """Track event with model and token counts — cost should be auto-calculated."""
        response = client_with_overrides.post(
            "/v1/track",
            json={
                "agent": "gpt-agent",
                "model": "gpt-4o",
                "input_tokens": 1000,
                "output_tokens": 500,
            },
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["cost_usd"] is not None
        assert data["cost_usd"] > 0

    def test_track_with_explicit_cost(self, client_with_overrides):
        """Track event with explicit cost_usd provided."""
        response = client_with_overrides.post(
            "/v1/track",
            json={
                "agent": "my-agent",
                "cost_usd": 0.05,
            },
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["cost_usd"] == 0.05

    def test_track_unknown_model_adds_warning(self, client_with_overrides):
        """Tracking an unknown model should return a warning."""
        response = client_with_overrides.post(
            "/v1/track",
            json={
                "agent": "my-agent",
                "model": "gpt-99-ultra-unknown",
                "input_tokens": 100,
                "output_tokens": 100,
            },
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["warnings"]) > 0
        assert "gpt-99-ultra-unknown" in data["warnings"][0]

    def test_track_returns_rate_limit_headers(self, client_with_overrides):
        """Response should include X-RateLimit-* headers."""
        response = client_with_overrides.post(
            "/v1/track",
            json={"agent": "my-agent"},
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
        assert "X-AGS-Plan" in response.headers
        assert response.headers["X-AGS-Plan"] == "free"

    def test_track_plan_in_header_for_pro(self, client_with_pro_org):
        """Pro org should show 'pro' plan in headers."""
        response = client_with_pro_org.post(
            "/v1/track",
            json={"agent": "my-agent"},
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        assert response.headers["X-AGS-Plan"] == "pro"

    def test_track_missing_agent_fails_validation(self, client_with_overrides):
        """Missing required 'agent' field should return 422."""
        response = client_with_overrides.post(
            "/v1/track",
            json={"model": "gpt-4o"},
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 422

    def test_track_invalid_status_fails_validation(self, client_with_overrides):
        """Invalid status value should return 422."""
        response = client_with_overrides.post(
            "/v1/track",
            json={"agent": "my-agent", "status": "invalid-status"},
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 422

    def test_track_negative_tokens_fails_validation(self, client_with_overrides):
        """Negative token counts should return 422."""
        response = client_with_overrides.post(
            "/v1/track",
            json={"agent": "my-agent", "input_tokens": -1},
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 422

    def test_track_with_full_payload(self, client_with_overrides):
        """Track event with all optional fields populated."""
        response = client_with_overrides.post(
            "/v1/track",
            json={
                "agent": "full-agent",
                "model": "claude-sonnet-4-6",
                "provider": "anthropic",
                "input_tokens": 2000,
                "output_tokens": 800,
                "session_id": "session-abc-123",
                "step": 3,
                "step_name": "reasoning",
                "status": "success",
                "duration_ms": 1234,
                "workflow": "customer-support",
                "user_label": "user-xyz",
                "team_label": "support-team",
                "metadata": {"custom_key": "custom_value"},
            },
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["agent"] == "full-agent"
        assert data["cost_usd"] is not None


# ---------------------------------------------------------------------------
# Model alias tests via track endpoint
# ---------------------------------------------------------------------------

class TestTrackModelAliases:
    def test_sonnet_alias_resolved(self, client_with_overrides):
        """'sonnet' alias should resolve to 'claude-sonnet-4-6' and calculate cost."""
        response = client_with_overrides.post(
            "/v1/track",
            json={
                "agent": "claude-agent",
                "model": "sonnet",
                "input_tokens": 1000,
                "output_tokens": 500,
            },
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        # Should have cost calculated (not None)
        assert data["cost_usd"] is not None
        # Should have no warnings about unknown model
        assert not any("Unknown model" in w for w in data["warnings"])

    def test_gpt4o_alias_resolved(self, client_with_overrides):
        """'gpt4o' alias should resolve to 'gpt-4o' and calculate cost."""
        response = client_with_overrides.post(
            "/v1/track",
            json={
                "agent": "openai-agent",
                "model": "gpt4o",
                "input_tokens": 500,
                "output_tokens": 250,
            },
            headers={"Authorization": "Bearer ags_live_test"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["cost_usd"] is not None


# ---------------------------------------------------------------------------
# Rate limit tests
# ---------------------------------------------------------------------------

class TestRateLimits:
    def test_rate_limit_exceeded_returns_429(self, free_org, mock_db):
        """When rate limit is exceeded, should return 429."""
        mock_redis_exceeded = AsyncMock()
        mock_redis_exceeded.get = AsyncMock(return_value=None)
        mock_redis_exceeded.set = AsyncMock(return_value=True)
        mock_redis_exceeded.incr = AsyncMock(return_value=101)
        mock_redis_exceeded.expire = AsyncMock(return_value=True)

        pipeline_mock = AsyncMock()
        pipeline_mock.incr = MagicMock(return_value=pipeline_mock)
        pipeline_mock.expire = MagicMock(return_value=pipeline_mock)
        # Simulate 101 requests (exceeds free tier limit of 100)
        pipeline_mock.execute = AsyncMock(return_value=[101, True])
        mock_redis_exceeded.pipeline = MagicMock(return_value=pipeline_mock)

        app.dependency_overrides[get_current_org] = lambda: free_org
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_redis] = lambda: mock_redis_exceeded

        try:
            with patch("app.middleware.rate_limit.get_redis_client", return_value=mock_redis_exceeded), \
                 patch("app.services.pricing.get_redis_client", return_value=mock_redis_exceeded), \
                 patch("app.utils.redis.get_redis_client", return_value=mock_redis_exceeded), \
                 patch("app.utils.supabase.get_supabase_client", return_value=mock_db):
                client = TestClient(app, raise_server_exceptions=False)
                response = client.post(
                    "/v1/track",
                    json={"agent": "my-agent"},
                    headers={"Authorization": "Bearer ags_live_test"},
                )
            assert response.status_code == 429
        finally:
            app.dependency_overrides.clear()
