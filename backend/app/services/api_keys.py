"""API key generation, verification, and management."""
from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timezone

from app.models.user import Organization
from app.utils.errors import AuthenticationError, AgentShieldError
from app.utils.redis import get_redis_client
from app.utils.supabase import get_supabase_client

_CACHE_TTL = 300  # 5 minutes
_KEY_PREFIX = "ags_live_"
_MAX_KEYS_PER_ORG = 5


def _hash_key(key: str) -> str:
    """Return SHA-256 hex digest of the given key."""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key.

    Returns:
        (full_key, key_hash, key_prefix)
        - full_key:   "ags_live_" + 32 URL-safe random chars
        - key_hash:   SHA-256 hex digest of full_key
        - key_prefix: first 13 characters (e.g. "ags_live_xxxx")
    """
    random_part = secrets.token_urlsafe(32)[:32]
    full_key = f"{_KEY_PREFIX}{random_part}"
    key_hash = _hash_key(full_key)
    key_prefix = full_key[:13]
    return full_key, key_hash, key_prefix


async def verify_api_key(key: str) -> Organization:
    """Verify an API key and return the associated Organization.

    Flow:
    1. Hash the key with SHA-256.
    2. Check Redis cache `apikey:{hash}` (TTL 5 min).
    3. On cache miss → query DB api_keys table.
    4. Cache result and fire-and-forget update of last_used_at.
    5. Raise AuthenticationError if not found or inactive.
    """
    key_hash = _hash_key(key)
    redis = get_redis_client()
    cache_key = f"apikey:{key_hash}"

    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        return Organization(**data)

    # Cache miss — query DB (2 separate queries to avoid join serialization issues)
    db = get_supabase_client()

    # Step 1: Find the API key
    key_result = (
        db.table("api_keys")
        .select("id, organization_id, is_active")
        .eq("key_hash", key_hash)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )

    if not key_result or not key_result.data:
        raise AuthenticationError("Invalid API key", code="auth_invalid_api_key")

    org_id = key_result.data.get("organization_id")
    if not org_id:
        raise AuthenticationError("Invalid API key", code="auth_invalid_api_key")

    # Step 2: Fetch the organization
    org_result = (
        db.table("organizations")
        .select("id, name, plan, max_agents, max_requests, modules_enabled")
        .eq("id", org_id)
        .maybe_single()
        .execute()
    )

    if not org_result or not org_result.data:
        raise AuthenticationError("Organization not found", code="auth_invalid_api_key")

    org_data = org_result.data
    org = Organization(
        id=org_data.get("id", ""),
        name=org_data.get("name", ""),
        plan=org_data.get("plan", "free"),
        max_agents=org_data.get("max_agents", 1),
        max_requests=org_data.get("max_requests", 10000),
        modules_enabled=org_data.get("modules_enabled", []),
    )

    # Cache org data in Redis
    await redis.set(cache_key, json.dumps(org.model_dump()), ex=_CACHE_TTL)

    # Fire-and-forget: update last_used_at
    api_key_id = key_result.data.get("id")
    if api_key_id:
        asyncio.create_task(_update_last_used(api_key_id))

    return org


async def _update_last_used(api_key_id: str) -> None:
    """Update last_used_at for the given API key (best-effort)."""
    try:
        db = get_supabase_client()
        db.table("api_keys").update(
            {"last_used_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", api_key_id).execute()
    except Exception:
        pass  # Non-critical — do not propagate


async def create_api_key(org_id: str, name: str) -> dict:
    """Create a new API key for the organization.

    Raises AgentShieldError if the org already has 5 active keys.
    Returns dict with {id, name, key, key_prefix, created_at}.
    """
    db = get_supabase_client()

    # Check existing active key count
    count_result = (
        db.table("api_keys")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .eq("is_active", True)
        .execute()
    )
    current_count = count_result.count or 0
    if current_count >= _MAX_KEYS_PER_ORG:
        raise AgentShieldError(
            f"API key limit reached: {_MAX_KEYS_PER_ORG} active keys maximum.",
            code="api_key_limit_exceeded",
            status_code=422,
        )

    full_key, key_hash, key_prefix = generate_api_key()
    now = datetime.now(timezone.utc).isoformat()

    import uuid
    key_id = str(uuid.uuid4())
    db.table("api_keys").insert(
        {
            "id": key_id,
            "organization_id": org_id,
            "name": name,
            "key_hash": key_hash,
            "key_prefix": key_prefix,
            "is_active": True,
            "created_at": now,
        }
    ).execute()

    return {
        "id": key_id,
        "name": name,
        "key": full_key,  # Only returned once
        "key_prefix": key_prefix,
        "created_at": now,
    }


async def revoke_api_key(org_id: str, key_id: str) -> dict:
    """Revoke an API key and invalidate the Redis cache.

    Returns dict with {id, name, is_active, revoked_at}.
    """
    db = get_supabase_client()
    redis = get_redis_client()

    # Fetch key to get hash for cache invalidation
    result = (
        db.table("api_keys")
        .select("id, name, key_hash")
        .eq("id", key_id)
        .eq("organization_id", org_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="API key not found")

    key_hash = result.data.get("key_hash")
    name = result.data.get("name", "")
    revoked_at = datetime.now(timezone.utc).isoformat()

    db.table("api_keys").update({"is_active": False}).eq("id", key_id).execute()

    # Invalidate Redis cache
    if key_hash:
        await redis.delete(f"apikey:{key_hash}")

    return {
        "id": key_id,
        "name": name,
        "is_active": False,
        "revoked_at": revoked_at,
    }


async def list_api_keys(org_id: str) -> list[dict]:
    """List all API keys for the organization.

    Never includes key_hash or the full key value.
    """
    db = get_supabase_client()
    result = (
        db.table("api_keys")
        .select("id, name, key_prefix, is_active, created_at, last_used_at")
        .eq("organization_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []
