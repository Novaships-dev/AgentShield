"""Dependency injection stubs for FastAPI routes.

These will be fully implemented in Sprint 1 with real JWT/API key verification.
"""
from __future__ import annotations

from typing import Any
from fastapi import Header, HTTPException, status


async def get_current_org(
    authorization: str = Header(..., description="Bearer token or API key"),
) -> dict[str, Any]:
    """Return the current organization from the auth token.

    Stub — returns a mock organization for Sprint 0.
    Full implementation in Sprint 1.
    """
    # Sprint 0 stub
    return {
        "id": "00000000-0000-0000-0000-000000000000",
        "name": "Mock Organization",
        "plan": "free",
    }


async def get_current_user(
    authorization: str = Header(..., description="Bearer token"),
) -> dict[str, Any]:
    """Return the current user from the JWT token.

    Stub — returns a mock user for Sprint 0.
    Full implementation in Sprint 1.
    """
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "email": "dev@example.com",
        "role": "owner",
    }


async def require_role(minimum_role: str = "member") -> None:
    """Verify the current user has the required role.

    Stub — always passes for Sprint 0.
    Full implementation in Sprint 1.
    """
    pass


async def require_plan(minimum_plan: str = "free") -> None:
    """Verify the current organization has the required plan.

    Stub — always passes for Sprint 0.
    Full implementation in Sprint 1.
    """
    pass
