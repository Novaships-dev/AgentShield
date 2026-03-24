"""Tests for API key generation and verification."""
from __future__ import annotations
import hashlib
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.api_keys import generate_api_key, _hash_key


# ---------------------------------------------------------------------------
# generate_api_key tests (pure, no external deps)
# ---------------------------------------------------------------------------

class TestGenerateApiKey:
    def test_returns_tuple_of_three(self):
        result = generate_api_key()
        assert isinstance(result, tuple)
        assert len(result) == 3

    def test_full_key_format(self):
        full_key, _, _ = generate_api_key()
        assert full_key.startswith("ags_live_")

    def test_full_key_length(self):
        full_key, _, _ = generate_api_key()
        # "ags_live_" is 9 chars, random part is 32 chars → total 41
        assert len(full_key) == 9 + 32

    def test_key_hash_is_sha256(self):
        full_key, key_hash, _ = generate_api_key()
        expected_hash = hashlib.sha256(full_key.encode()).hexdigest()
        assert key_hash == expected_hash

    def test_key_hash_length(self):
        _, key_hash, _ = generate_api_key()
        assert len(key_hash) == 64  # SHA-256 hex is 64 chars

    def test_key_prefix_is_first_13_chars(self):
        full_key, _, key_prefix = generate_api_key()
        assert key_prefix == full_key[:13]

    def test_key_prefix_starts_with_ags_live(self):
        _, _, key_prefix = generate_api_key()
        assert key_prefix.startswith("ags_live_")

    def test_uniqueness(self):
        """Each call should generate a unique key."""
        key1, _, _ = generate_api_key()
        key2, _, _ = generate_api_key()
        assert key1 != key2

    def test_hash_key_helper(self):
        test_key = "ags_live_testkey12345678901234"
        result = _hash_key(test_key)
        expected = hashlib.sha256(test_key.encode()).hexdigest()
        assert result == expected


# ---------------------------------------------------------------------------
# verify_api_key tests (mocked Redis + DB)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    return redis


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def sample_org_data():
    return {
        "id": "org-123",
        "name": "Test Org",
        "plan": "starter",
        "max_agents": 5,
        "max_requests": 50000,
        "modules_enabled": [],
    }


class TestVerifyApiKey:
    @pytest.mark.asyncio
    async def test_cache_hit_returns_org(self, mock_redis, mock_db, sample_org_data):
        """When Redis has cached org data, return it without DB query."""
        mock_redis.get = AsyncMock(return_value=json.dumps(sample_org_data))

        with patch("app.services.api_keys.get_redis_client", return_value=mock_redis), \
             patch("app.services.api_keys.get_supabase_client", return_value=mock_db):
            from app.services.api_keys import verify_api_key
            org = await verify_api_key("ags_live_testkey1234567890123456")

        assert org.id == "org-123"
        assert org.plan == "starter"
        mock_db.table.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_miss_queries_db(self, mock_redis, mock_db, sample_org_data):
        """On cache miss, should query DB and cache result."""
        mock_redis.get = AsyncMock(return_value=None)

        db_result = MagicMock()
        db_result.data = {
            "id": "key-abc",
            "organizations": sample_org_data,
        }
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = db_result

        with patch("app.services.api_keys.get_redis_client", return_value=mock_redis), \
             patch("app.services.api_keys.get_supabase_client", return_value=mock_db), \
             patch("app.services.api_keys.asyncio.create_task"):
            from app.services.api_keys import verify_api_key
            org = await verify_api_key("ags_live_testkey1234567890123456")

        assert org.id == "org-123"
        assert org.name == "Test Org"
        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalid_key_raises_auth_error(self, mock_redis, mock_db):
        """When key not found in DB, raise AuthenticationError."""
        mock_redis.get = AsyncMock(return_value=None)

        db_result = MagicMock()
        db_result.data = None
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = db_result

        with patch("app.services.api_keys.get_redis_client", return_value=mock_redis), \
             patch("app.services.api_keys.get_supabase_client", return_value=mock_db):
            from app.services.api_keys import verify_api_key
            from app.utils.errors import AuthenticationError
            with pytest.raises(AuthenticationError) as exc_info:
                await verify_api_key("ags_live_invalidkey12345678901234")
        assert exc_info.value.code == "auth_invalid_api_key"

    @pytest.mark.asyncio
    async def test_hashes_key_before_lookup(self, mock_redis, mock_db, sample_org_data):
        """The lookup should use SHA-256 hash, not the raw key."""
        mock_redis.get = AsyncMock(return_value=None)
        test_key = "ags_live_testkey1234567890123456"
        expected_hash = hashlib.sha256(test_key.encode()).hexdigest()

        db_result = MagicMock()
        db_result.data = {"id": "key-abc", "organizations": sample_org_data}
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = db_result

        eq_calls = []
        original_eq = mock_db.table.return_value.select.return_value.eq

        def capture_eq(field, value):
            eq_calls.append((field, value))
            return original_eq.return_value
        original_eq.side_effect = capture_eq

        with patch("app.services.api_keys.get_redis_client", return_value=mock_redis), \
             patch("app.services.api_keys.get_supabase_client", return_value=mock_db), \
             patch("app.services.api_keys.asyncio.create_task"):
            from app.services.api_keys import verify_api_key
            await verify_api_key(test_key)

        # Verify that key_hash was used in the query
        hash_query = [c for c in eq_calls if c[0] == "key_hash"]
        assert hash_query, "key_hash not used in DB query"
        assert hash_query[0][1] == expected_hash


class TestCreateApiKey:
    @pytest.mark.asyncio
    async def test_creates_key_successfully(self, mock_redis, mock_db):
        """Should create key when org has fewer than 5 keys."""
        count_result = MagicMock()
        count_result.count = 2
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = count_result
        mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock()

        with patch("app.services.api_keys.get_supabase_client", return_value=mock_db):
            from app.services.api_keys import create_api_key
            result = await create_api_key("org-123", "My Key")

        assert "key" in result
        assert result["key"].startswith("ags_live_")
        assert "key_prefix" in result
        assert result["name"] == "My Key"

    @pytest.mark.asyncio
    async def test_raises_error_at_limit(self, mock_redis, mock_db):
        """Should raise error when org already has 5 keys."""
        count_result = MagicMock()
        count_result.count = 5
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = count_result

        with patch("app.services.api_keys.get_supabase_client", return_value=mock_db):
            from app.services.api_keys import create_api_key
            from app.utils.errors import AgentShieldError
            with pytest.raises(AgentShieldError) as exc_info:
                await create_api_key("org-123", "Sixth Key")
        assert exc_info.value.code == "api_key_limit_exceeded"


class TestRevokeApiKey:
    @pytest.mark.asyncio
    async def test_revokes_key_and_clears_cache(self, mock_redis, mock_db):
        """Should mark key inactive and delete from Redis cache."""
        key_hash = "abc123hash"
        find_result = MagicMock()
        find_result.data = {"id": "key-1", "name": "Test Key", "key_hash": key_hash}
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = find_result
        mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        with patch("app.services.api_keys.get_supabase_client", return_value=mock_db), \
             patch("app.services.api_keys.get_redis_client", return_value=mock_redis):
            from app.services.api_keys import revoke_api_key
            result = await revoke_api_key("org-123", "key-1")

        assert result["is_active"] is False
        assert "revoked_at" in result
        mock_redis.delete.assert_called_once_with(f"apikey:{key_hash}")


class TestListApiKeys:
    @pytest.mark.asyncio
    async def test_returns_keys_without_hash(self, mock_db):
        """Should return list of keys without key_hash field."""
        list_result = MagicMock()
        list_result.data = [
            {"id": "k1", "name": "Key 1", "key_prefix": "ags_live_xxxx", "is_active": True, "created_at": "2026-01-01", "last_used_at": None},
        ]
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = list_result

        with patch("app.services.api_keys.get_supabase_client", return_value=mock_db):
            from app.services.api_keys import list_api_keys
            keys = await list_api_keys("org-123")

        assert len(keys) == 1
        assert "key_hash" not in keys[0]
        assert keys[0]["key_prefix"] == "ags_live_xxxx"
