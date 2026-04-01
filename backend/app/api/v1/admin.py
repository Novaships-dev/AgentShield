"""Platform admin endpoints — accessible only by platform admins."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.utils.errors import AuthorizationError

router = APIRouter(prefix="/v1/admin", tags=["admin"])


async def require_platform_admin(user: User = Depends(get_current_user)):
    """Verify user is a platform admin."""
    from app.utils.supabase import get_supabase_client
    db = get_supabase_client()
    result = db.table("users").select("is_platform_admin").eq("id", user.id).maybe_single().execute()
    if not result.data or not result.data.get("is_platform_admin"):
        raise AuthorizationError("Platform admin access required", code="admin_required")
    return user


@router.get("/overview")
async def admin_overview(
    _user: User = Depends(require_platform_admin),
    db=Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    orgs = db.table("organizations").select("id", count="exact").execute()
    users = db.table("users").select("id", count="exact").execute()
    agents = db.table("agents").select("id", count="exact").execute()
    events = db.table("events").select("id", count="exact").execute()
    sessions = db.table("agent_sessions").select("id", count="exact").execute()

    cost_result = db.table("events").select("cost_usd").execute()
    total_cost = sum(float(e.get("cost_usd", 0) or 0) for e in (cost_result.data or []))

    events_today = db.table("events").select("id", count="exact").gte("tracked_at", today.isoformat()).execute()
    events_week = db.table("events").select("id", count="exact").gte("tracked_at", week_ago.isoformat()).execute()
    events_month = db.table("events").select("id", count="exact").gte("tracked_at", month_ago.isoformat()).execute()

    active_orgs_data = db.table("events").select("organization_id").gte("tracked_at", week_ago.isoformat()).execute()
    active_org_ids = set(e["organization_id"] for e in (active_orgs_data.data or []) if e.get("organization_id"))

    return {
        "total_organizations": orgs.count or 0,
        "total_users": users.count or 0,
        "total_agents": agents.count or 0,
        "total_events": events.count or 0,
        "total_sessions": sessions.count or 0,
        "total_cost_usd": round(total_cost, 4),
        "events_today": events_today.count or 0,
        "events_this_week": events_week.count or 0,
        "events_this_month": events_month.count or 0,
        "active_organizations_7d": len(active_org_ids),
    }


@router.get("/organizations")
async def admin_organizations(
    _user: User = Depends(require_platform_admin),
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at", regex="^(created_at|event_count|total_cost_usd)$"),
):
    offset = (page - 1) * per_page
    orgs_result = db.table("organizations").select("*", count="exact").range(offset, offset + per_page - 1).order("created_at", desc=True).execute()
    orgs = orgs_result.data or []
    total = orgs_result.count or 0

    items = []
    for org in orgs:
        org_id = org["id"]
        user_count = db.table("users").select("id", count="exact").eq("organization_id", org_id).execute()
        agent_count = db.table("agents").select("id", count="exact").eq("organization_id", org_id).execute()
        event_data = db.table("events").select("cost_usd, tracked_at").eq("organization_id", org_id).execute()
        events_list = event_data.data or []
        event_count = len(events_list)
        org_cost = sum(float(e.get("cost_usd", 0) or 0) for e in events_list)
        last_event_at = max((e["tracked_at"] for e in events_list if e.get("tracked_at")), default=None) if events_list else None

        items.append({
            "id": org_id,
            "name": org.get("name", ""),
            "slug": org.get("slug", ""),
            "plan": org.get("plan", "free"),
            "created_at": org.get("created_at"),
            "user_count": user_count.count or 0,
            "agent_count": agent_count.count or 0,
            "event_count": event_count,
            "total_cost_usd": round(org_cost, 4),
            "last_event_at": last_event_at,
        })

    if sort_by == "event_count":
        items.sort(key=lambda x: x["event_count"], reverse=True)
    elif sort_by == "total_cost_usd":
        items.sort(key=lambda x: x["total_cost_usd"], reverse=True)

    return {
        "data": items,
        "pagination": {"page": page, "per_page": per_page, "total": total},
    }


@router.get("/users")
async def admin_users(
    _user: User = Depends(require_platform_admin),
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    offset = (page - 1) * per_page
    result = db.table("users").select("*, organizations(name, plan)", count="exact").order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    users = result.data or []
    total = result.count or 0

    items = []
    for u in users:
        org = u.get("organizations") or {}
        items.append({
            "id": u["id"],
            "email": u.get("email", ""),
            "role": u.get("role", "member"),
            "organization_name": org.get("name", ""),
            "plan": org.get("plan", "free"),
            "created_at": u.get("created_at"),
            "is_platform_admin": u.get("is_platform_admin", False),
        })

    return {
        "data": items,
        "pagination": {"page": page, "per_page": per_page, "total": total},
    }


@router.get("/events/timeline")
async def admin_events_timeline(
    _user: User = Depends(require_platform_admin),
    db=Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=30)
    result = db.table("events").select("tracked_at, cost_usd").gte("tracked_at", since.isoformat()).execute()
    events = result.data or []

    days: dict[str, dict] = {}
    for e in events:
        tracked = e.get("tracked_at", "")
        if not tracked:
            continue
        day = tracked[:10]
        if day not in days:
            days[day] = {"date": day, "count": 0, "total_cost_usd": 0.0}
        days[day]["count"] += 1
        days[day]["total_cost_usd"] += float(e.get("cost_usd", 0) or 0)

    timeline = sorted(days.values(), key=lambda x: x["date"])
    for d in timeline:
        d["total_cost_usd"] = round(d["total_cost_usd"], 4)
    return timeline


@router.get("/revenue")
async def admin_revenue(
    _user: User = Depends(require_platform_admin),
    db=Depends(get_db),
):
    plan_prices = {"starter": 29, "pro": 79, "team": 199}

    orgs = db.table("organizations").select("name, plan, stripe_customer_id, stripe_subscription_id, created_at").not_.is_("stripe_subscription_id", "null").execute()
    paying_orgs = orgs.data or []

    mrr = 0.0
    items = []
    for org in paying_orgs:
        plan = org.get("plan", "free")
        price = plan_prices.get(plan, 0)
        mrr += price
        items.append({
            "name": org.get("name", ""),
            "plan": plan,
            "stripe_customer_id": org.get("stripe_customer_id"),
            "created_at": org.get("created_at"),
            "monthly_price": price,
        })

    all_orgs = db.table("organizations").select("plan").execute()
    plan_counts: dict[str, int] = {}
    for o in (all_orgs.data or []):
        p = o.get("plan", "free")
        plan_counts[p] = plan_counts.get(p, 0) + 1

    return {
        "mrr": mrr,
        "arr": mrr * 12,
        "plan_breakdown": plan_counts,
        "paying_organizations": items,
    }
