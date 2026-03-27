"""Agent CRUD endpoints."""
from fastapi import APIRouter, Depends, Query, HTTPException
from app.dependencies import get_current_user, require_role, get_db, get_redis
from app.models.user import User
from app.schemas.agent import AgentResponse, AgentDetailResponse, AgentUpdateRequest
from datetime import datetime, timezone, timedelta
from uuid import UUID

router = APIRouter(prefix="/v1", tags=["agents"])


@router.get("/agents", summary="List agents")
async def list_agents(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> dict:
    """List all agents for the organization with metrics."""
    query = db.table("agents").select("*").eq("organization_id", user.organization_id)
    if search:
        query = query.ilike("name", f"%{search}%")
    if status == "inactive":
        query = query.eq("is_active", False)
    elif status:
        query = query.eq("is_active", True)
    result = query.execute()
    agents = result.data or []

    # Compute metrics per agent
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    enriched = []
    for agent in agents:
        agent_id = agent["id"]
        # Cost today
        today_events = db.table("events").select("cost_usd").eq("agent_id", agent_id).gte("tracked_at", today_start).execute()
        cost_today = sum(e.get("cost_usd") or 0 for e in (today_events.data or []))
        # Cost month
        month_events = db.table("events").select("cost_usd").eq("agent_id", agent_id).gte("tracked_at", month_start).execute()
        cost_month = sum(e.get("cost_usd") or 0 for e in (month_events.data or []))
        # Requests today
        requests_today = len(today_events.data or [])

        enriched.append({
            "id": agent_id,
            "name": agent.get("name", ""),
            "description": agent.get("description"),
            "is_active": agent.get("is_active", True),
            "is_frozen": agent.get("is_frozen", False),
            "status": "active" if agent.get("is_active", True) else "inactive",
            "cost_today_usd": round(cost_today, 6),
            "cost_month_usd": round(cost_month, 6),
            "cost_trend_pct": 0.0,
            "requests_today": requests_today,
            "last_event_at": agent.get("last_event_at"),
            "created_at": agent.get("created_at"),
        })

    total = len(enriched)
    start = (page - 1) * per_page
    end = start + per_page

    return {
        "data": enriched[start:end],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 1,
        },
    }


@router.get("/agents/{agent_id}", summary="Get agent detail")
async def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
) -> dict:
    """Get detailed agent info with metrics."""
    result = db.table("agents").select("*").eq("id", agent_id).eq("organization_id", user.organization_id).maybe_single().execute()
    if not result.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = result.data
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    all_events = db.table("events").select("cost_usd, input_tokens, output_tokens, model, status, tracked_at").eq("agent_id", agent_id).execute()
    all_data = all_events.data or []

    today_data = [e for e in all_data if e.get("tracked_at", "") >= today_start]
    week_data = [e for e in all_data if e.get("tracked_at", "") >= week_start]
    month_data = [e for e in all_data if e.get("tracked_at", "") >= month_start]

    cost_today = sum(e.get("cost_usd") or 0 for e in today_data)
    cost_week = sum(e.get("cost_usd") or 0 for e in week_data)
    cost_month = sum(e.get("cost_usd") or 0 for e in month_data)
    req_today = len(today_data)
    req_month = len(month_data)

    # Top model
    from collections import Counter
    model_counts = Counter(e.get("model") for e in all_data if e.get("model"))
    top_model = model_counts.most_common(1)[0][0] if model_counts else None
    top_model_pct = (model_counts.most_common(1)[0][1] / len(all_data) * 100) if model_counts and all_data else 0

    avg_cost = (sum(e.get("cost_usd") or 0 for e in month_data) / len(month_data)) if month_data else 0
    avg_tokens = (sum((e.get("input_tokens", 0) or 0) + (e.get("output_tokens", 0) or 0) for e in month_data) / len(month_data)) if month_data else 0
    errors = sum(1 for e in month_data if e.get("status") == "error")
    error_rate = (errors / len(month_data) * 100) if month_data else 0

    return {
        "id": agent["id"],
        "name": agent.get("name", ""),
        "description": agent.get("description"),
        "is_active": agent.get("is_active", True),
        "is_frozen": agent.get("is_frozen", False),
        "status": "active" if agent.get("is_active", True) else "inactive",
        "metrics": {
            "cost_today_usd": round(cost_today, 6),
            "cost_week_usd": round(cost_week, 6),
            "cost_month_usd": round(cost_month, 6),
            "cost_trend_pct": 0.0,
            "requests_today": req_today,
            "requests_month": req_month,
            "avg_cost_per_request": round(avg_cost, 6),
            "avg_tokens_per_request": round(avg_tokens, 1),
            "error_rate_pct": round(error_rate, 2),
            "top_model": top_model,
            "top_model_pct": round(top_model_pct, 1),
        },
        "budget_cap": None,  # Sprint 4
        "forecast": None,  # Sprint 4
        "last_event_at": agent.get("last_event_at"),
        "created_at": agent.get("created_at"),
    }


@router.patch("/agents/{agent_id}", summary="Update agent")
async def update_agent(
    agent_id: str,
    body: AgentUpdateRequest,
    user: User = Depends(require_role("admin")),
    db=Depends(get_db),
) -> dict:
    """Update agent description or active status."""
    result = db.table("agents").select("id").eq("id", agent_id).eq("organization_id", user.organization_id).maybe_single().execute()
    if not result.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = {}
    if body.description is not None:
        updates["description"] = body.description
    if body.is_active is not None:
        updates["is_active"] = body.is_active

    if updates:
        db.table("agents").update(updates).eq("id", agent_id).execute()

    updated = db.table("agents").select("*").eq("id", agent_id).maybe_single().execute()
    agent = updated.data or {}
    return {
        "id": agent.get("id"),
        "name": agent.get("name"),
        "description": agent.get("description"),
        "is_active": agent.get("is_active", True),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/agents/{agent_id}/kill-switch", summary="Toggle agent kill switch")
async def toggle_kill_switch(
    agent_id: str,
    body: dict,
    user: User = Depends(require_role("admin")),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """Activate or deactivate the kill switch for an agent. Requires Pro+ plan."""
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Kill switch requires Pro plan or higher.")

    result = db.table("agents").select("*").eq("id", agent_id).eq("organization_id", user.organization_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = result.data
    enabled = bool(body.get("enabled", True))
    now = datetime.now(timezone.utc)

    # Update DB
    db.table("agents").update({"is_frozen": enabled}).eq("id", agent_id).execute()

    # Update Redis frozen flag
    frozen_key = f"frozen:{user.organization_id}:{agent_id}"
    try:
        if enabled:
            await redis.set(frozen_key, "kill_switch")
        else:
            await redis.delete(frozen_key)
    except Exception:
        pass

    # Publish WebSocket event
    import json
    try:
        channel = f"ws:{user.organization_id}"
        payload = json.dumps({
            "type": "budget_frozen" if enabled else "new_event",
            "data": {
                "agent": agent.get("name", agent_id),
                "is_frozen": enabled,
                "frozen_by": "kill_switch",
            },
        })
        await redis.publish(channel, payload)
    except Exception:
        pass

    # Write audit log
    try:
        db.table("audit_logs").insert({
            "id": str(UUID(int=0)),  # placeholder — real UUID generated server-side
            "organization_id": user.organization_id,
            "user_id": user.id,
            "action": "agent.kill_switch_enabled" if enabled else "agent.kill_switch_disabled",
            "resource_type": "agent",
            "resource_id": agent_id,
            "details": {"agent_name": agent.get("name"), "enabled": enabled},
            "created_at": now.isoformat(),
        }).execute()
    except Exception:
        pass  # Audit log is non-critical

    return {
        "agent_id": agent_id,
        "agent_name": agent.get("name", agent_id),
        "is_frozen": enabled,
        "frozen_by": "kill_switch" if enabled else None,
        "frozen_at": now.isoformat() if enabled else None,
    }
