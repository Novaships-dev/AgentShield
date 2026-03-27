"""Plan limits enforcement — agents, requests, modules."""
from __future__ import annotations
from datetime import datetime, timezone
from app.utils.errors import AgentShieldError
from app.models.user import Organization

MAX_ALERTS = {"free": 0, "starter": 5, "pro": 20, "team": 20}

PLAN_HIERARCHY = {"free": 1, "starter": 2, "pro": 3, "team": 4}
PLAN_AGENT_LIMITS = {"free": 1, "starter": 5, "pro": 999_999, "team": 999_999}


def require_module(module: str):
    """Dependency factory: ensure the org's plan includes this module."""
    from fastapi import Depends, HTTPException
    from app.dependencies import get_current_org

    async def checker(org: Organization = Depends(get_current_org)) -> Organization:
        if module not in (org.modules_enabled or []):
            plan_map = {"replay": "starter", "protect": "pro"}
            required = plan_map.get(module, "pro")
            raise HTTPException(
                status_code=403,
                detail=f"Module '{module}' requires the {required} plan or higher.",
            )
        return org

    return checker


def check_agent_limit_for_downgrade(org_id: str, new_plan: str, db) -> None:
    """Raise HTTPException if org has more agents than the new plan allows."""
    from fastapi import HTTPException
    max_allowed = PLAN_AGENT_LIMITS.get(new_plan, 1)
    if max_allowed >= 999_999:
        return
    count_result = (
        db.table("agents")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .eq("is_active", True)
        .execute()
    )
    active_count = count_result.count or 0
    if active_count > max_allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot downgrade: you have {active_count} active agents, "
                f"but the {new_plan} plan allows only {max_allowed}. "
                "Please deactivate some agents first."
            ),
        )


def handle_module_downgrade(org_id: str, old_plan: str, new_plan: str, db) -> None:
    """Apply side effects on downgrade (deactivate guardrails, etc.). Data is never deleted."""
    old_rank = PLAN_HIERARCHY.get(old_plan, 0)
    new_rank = PLAN_HIERARCHY.get(new_plan, 0)
    if new_rank >= old_rank:
        return

    from app.services.stripe_service import PLAN_CONFIGS
    old_modules = set(PLAN_CONFIGS.get(old_plan, {}).get("modules", []))
    new_modules = set(PLAN_CONFIGS.get(new_plan, {}).get("modules", []))
    lost = old_modules - new_modules

    if "protect" in lost:
        try:
            db.table("guardrail_rules").update({"is_active": False}).eq("organization_id", org_id).execute()
        except Exception:
            pass


class PlanLimitError(AgentShieldError):
    status_code = 429

    def __init__(self, message: str, code: str = "plan_limit_exceeded", **kwargs):
        super().__init__(message, code=code, status_code=429, **kwargs)


async def check_plan_limits(org: Organization, action: str, **kwargs) -> None:
    """Check if org has exceeded plan limits for the given action."""
    from app.utils.supabase import get_supabase_client
    from app.utils.redis import get_redis_client

    if action == "create_agent":
        db = get_supabase_client()
        result = db.table("agents").select("id", count="exact").eq("organization_id", org.id).eq("is_active", True).execute()
        agents_count = result.count or 0
        if agents_count >= org.max_agents:
            raise PlanLimitError(
                f"Agent limit reached: {agents_count}/{org.max_agents}. Upgrade your plan.",
                code="plan_limit_agents",
                details={"current": agents_count, "max": org.max_agents, "plan": org.plan},
            )

    elif action == "track_event":
        redis = get_redis_client()
        now = datetime.now(timezone.utc)
        month_key = f"requests:{org.id}:{now.year}-{now.month:02d}"
        monthly_count = await redis.incr(month_key)
        # Set TTL to ~35 days if first time
        if monthly_count == 1:
            await redis.expire(month_key, 35 * 24 * 3600)
        if monthly_count > org.max_requests:
            raise PlanLimitError(
                f"Monthly request limit reached: {org.max_requests}. Upgrade your plan.",
                code="plan_limit_requests",
                details={"current": monthly_count, "max": org.max_requests, "plan": org.plan},
            )

    elif action == "create_alert":
        db = get_supabase_client()
        result = db.table("alert_rules").select("id", count="exact").eq("organization_id", org.id).eq("is_active", True).execute()
        alerts_count = result.count or 0
        max_alerts = MAX_ALERTS.get(org.plan, 0)
        if max_alerts == 0:
            raise PlanLimitError(
                "Alerts require Starter plan or higher.",
                code="plan_limit_alerts",
                details={"plan": org.plan},
            )
        if alerts_count >= max_alerts:
            raise PlanLimitError(
                f"Alert limit reached: {alerts_count}/{max_alerts}.",
                code="plan_limit_alerts",
                details={"current": alerts_count, "max": max_alerts, "plan": org.plan},
            )

    elif action == "use_module":
        module = kwargs.get("module", "")
        if module and module not in org.modules_enabled:
            raise PlanLimitError(
                f"Module '{module}' is not available on your plan.",
                code="module_not_enabled",
                details={"module": module, "plan": org.plan},
            )
