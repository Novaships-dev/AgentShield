"""Authentication middleware stubs.

Full implementation in Sprint 1.
"""
from __future__ import annotations

from typing import Any


async def verify_jwt(token: str) -> dict[str, Any]:
    """Verify a Supabase JWT and return the decoded payload.

    Stub — Sprint 1 will validate against SUPABASE_JWT_SECRET.
    """
    raise NotImplementedError("verify_jwt will be implemented in Sprint 1")


async def verify_api_key(key: str) -> dict[str, Any]:
    """Verify an AgentShield API key and return the associated organization.

    Stub — Sprint 1 will hash the key and look up in the api_keys table.
    """
    raise NotImplementedError("verify_api_key will be implemented in Sprint 1")
