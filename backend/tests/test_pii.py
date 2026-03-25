"""Tests for server-side PII redaction."""
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
def mock_db():
    db = MagicMock()
    agent_find = MagicMock()
    agent_find.data = {"id": "agent-123"}
    agent_count = MagicMock()
    agent_count.count = 0
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = agent_find
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = agent_count
    db.table.return_value.insert.return_value.execute.return_value = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = agent_find
    return db


@pytest.fixture
def client_with_overrides(free_org, mock_redis, mock_db):
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


# ---------------------------------------------------------------------------
# pii_patterns unit tests
# ---------------------------------------------------------------------------


def test_pii_email_redacted():
    """Email addresses are redacted by the server-side pattern."""
    from app.utils.pii_patterns import redact_text
    text = "Contact me at john@example.com please"
    result, types = redact_text(text)
    assert "[REDACTED:email]" in result
    assert "email" in types
    assert "john@example.com" not in result


def test_pii_phone_redacted():
    """Phone numbers with + prefix are redacted."""
    from app.utils.pii_patterns import redact_text
    text = "Call me at +33 6 12 34 56 78"
    result, types = redact_text(text)
    assert "phone" in types


def test_pii_credit_card_luhn_valid_redacted():
    """Luhn-valid credit card numbers are redacted."""
    from app.utils.pii_patterns import redact_text
    text = "Card: 4539148803436467"
    result, types = redact_text(text)
    assert "[REDACTED:credit_card]" in result
    assert "credit_card" in types


def test_pii_credit_card_luhn_invalid_not_redacted():
    """Luhn-invalid digit sequences are NOT redacted as credit cards."""
    from app.utils.pii_patterns import redact_text
    text = "Number: 1234567890123456"
    result, types = redact_text(text)
    assert "credit_card" not in types


def test_pii_ssn_redacted():
    from app.utils.pii_patterns import redact_text
    text = "SSN: 123-45-6789"
    result, types = redact_text(text)
    assert "ssn" in types
    assert "123-45-6789" not in result


def test_pii_multiple_types_detected():
    from app.utils.pii_patterns import redact_text
    text = "Email john@test.com and SSN 987-65-4320"
    result, types = redact_text(text)
    assert "email" in types
    assert "ssn" in types


# ---------------------------------------------------------------------------
# PIIRedactionService unit tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pii_service_redacts_email():
    from app.services.pii import PIIRedactionService
    db = MagicMock()
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    # No org config
    db.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = MagicMock(data=None)

    svc = PIIRedactionService(db=db, redis=redis)
    result, types = await svc.redact("org-1", "Email: john@example.com")
    assert "[REDACTED:email]" in result
    assert "email" in types


@pytest.mark.asyncio
async def test_pii_service_handles_none_text():
    from app.services.pii import PIIRedactionService
    db = MagicMock()
    redis = AsyncMock()
    svc = PIIRedactionService(db=db, redis=redis)
    result, types = await svc.redact("org-1", None)
    assert result is None
    assert types == []


# ---------------------------------------------------------------------------
# Integration: PII in POST /v1/track
# ---------------------------------------------------------------------------


def test_pii_email_redacted_in_track(client_with_overrides):
    """POST /v1/track with email in input_text returns pii_detected=['email']."""
    response = client_with_overrides.post(
        "/v1/track",
        json={
            "agent": "my-agent",
            "input_text": "Email john@example.com",
            "output_text": "Got it",
        },
        headers={"Authorization": "Bearer ags_live_test"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "email" in data.get("pii_detected", [])


def test_pii_store_original_false_nulls_text(client_with_overrides, mock_db):
    """By default, input_text and output_text are NOT stored in DB (store_original=False)."""
    response = client_with_overrides.post(
        "/v1/track",
        json={
            "agent": "my-agent",
            "input_text": "sensitive info",
            "output_text": "response here",
        },
        headers={"Authorization": "Bearer ags_live_test"},
    )
    assert response.status_code == 201

    # Verify event insert had input_text=None, output_text=None
    insert_call = mock_db.table.return_value.insert.call_args
    if insert_call:
        event_data = insert_call[0][0]
        assert event_data.get("input_text") is None
        assert event_data.get("output_text") is None


def test_pii_luhn_valid_in_track(client_with_overrides):
    """Luhn-valid credit card in output triggers pii_detected."""
    response = client_with_overrides.post(
        "/v1/track",
        json={
            "agent": "my-agent",
            "output_text": "Your card: 4539148803436467",
        },
        headers={"Authorization": "Bearer ags_live_test"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "credit_card" in data.get("pii_detected", [])
