"""Dependency injection for FastAPI routes."""
from __future__ import annotations
from typing import Any
from fastapi import Header, Depends
from app.utils.errors import AuthenticationError, AuthorizationError
from app.models.user import Organization, User


async def get_current_org(
    authorization: str = Header(..., description="Bearer API key or JWT"),
) -> Organization:
    """Return Organization from API key or JWT."""
    token = authorization.removeprefix("Bearer ").strip()
    if token.startswith("ags_live_"):
        from app.services.api_keys import verify_api_key
        return await verify_api_key(token)
    elif token.startswith("eyJ"):
        from app.middleware.auth import verify_jwt
        from app.utils.supabase import get_supabase_client
        payload = verify_jwt(token)
        user_id = payload.get("sub")
        db = get_supabase_client()
        result = db.table("users").select("*, organizations(*)").eq("id", user_id).maybe_single().execute()
        if not result.data:
            raise AuthenticationError("User not found", code="auth_invalid_token")
        org_data = result.data.get("organizations", {})
        return Organization(
            id=org_data.get("id", ""),
            name=org_data.get("name", ""),
            plan=org_data.get("plan", "free"),
            max_agents=org_data.get("max_agents", 1),
            max_requests=org_data.get("max_requests", 10000),
            modules_enabled=org_data.get("modules_enabled", []),
        )
    else:
        raise AuthenticationError("Missing or invalid authorization", code="auth_missing")


async def get_current_user(
    authorization: str = Header(..., description="Bearer JWT"),
) -> User:
    """Return User from JWT (dashboard endpoints only)."""
    token = authorization.removeprefix("Bearer ").strip()
    if not token.startswith("eyJ"):
        raise AuthenticationError("JWT required for this endpoint", code="auth_missing")
    from app.middleware.auth import verify_jwt
    from app.utils.supabase import get_supabase_client
    payload = verify_jwt(token)
    user_id = payload.get("sub")
    db = get_supabase_client()
    result = db.table("users").select("*, organizations(*)").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise AuthenticationError("User not found", code="auth_invalid_token")
    user_data = result.data
    org_data = user_data.get("organizations", {})
    return User(
        id=user_data.get("id", user_id),
        email=user_data.get("email", payload.get("email", "")),
        role=user_data.get("role", "member"),
        organization_id=user_data.get("organization_id", ""),
        organization=Organization(
            id=org_data.get("id", ""),
            name=org_data.get("name", ""),
            plan=org_data.get("plan", "free"),
            max_agents=org_data.get("max_agents", 1),
            max_requests=org_data.get("max_requests", 10000),
            modules_enabled=org_data.get("modules_enabled", []),
        ),
    )


def require_role(minimum_role: str):
    """Dependency factory: check user role."""
    role_hierarchy = {"owner": 3, "admin": 2, "member": 1}

    async def checker(user: User = Depends(get_current_user)) -> User:
        if role_hierarchy.get(user.role, 0) < role_hierarchy.get(minimum_role, 0):
            raise AuthorizationError(
                f"Requires '{minimum_role}' role",
                code="role_insufficient",
                details={"current_role": user.role, "required_role": minimum_role},
            )
        return user
    return checker


def require_plan(minimum_plan: str):
    """Dependency factory: check org plan."""
    plan_hierarchy = {"team": 4, "pro": 3, "starter": 2, "free": 1}

    async def checker(org: Organization = Depends(get_current_org)) -> Organization:
        if plan_hierarchy.get(org.plan, 0) < plan_hierarchy.get(minimum_plan, 0):
            raise AuthorizationError(
                f"Requires '{minimum_plan}' plan",
                code=f"plan_required_{minimum_plan}",
            )
        return org
    return checker


def get_db():
    """Get Supabase service-role client."""
    from app.utils.supabase import get_supabase_client
    return get_supabase_client()


def get_redis():
    """Get async Redis client."""
    from app.utils.redis import get_redis_client
    return get_redis_client()
