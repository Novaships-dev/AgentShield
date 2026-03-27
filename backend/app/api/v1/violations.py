"""GET /v1/violations — paginated guardrail violation history."""
from __future__ import annotations
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/v1", tags=["violations"])


def _require_pro(user: User = Depends(get_current_user)) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Violations require Pro plan or higher.")
    return user


@router.get("/violations", summary="List guardrail violations")
async def list_violations(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    agent_id: str | None = Query(None),
    guardrail_id: str | None = Query(None),
    start: str | None = Query(None),
    end: str | None = Query(None),
    user: User = Depends(_require_pro),
    db=Depends(get_db),
) -> dict:
    """Return paginated list of guardrail violations with rule and agent names."""
    org_id = user.organization_id

    # Violations are linked to rules via rule_id; filter rules by org first
    rule_ids_res = db.table("guardrail_rules").select("id").eq("organization_id", org_id).execute()
    rule_ids = [r["id"] for r in (rule_ids_res.data or [])]
    if not rule_ids:
        return {"data": [], "pagination": {"page": page, "per_page": per_page, "total": 0, "total_pages": 1}}

    query = db.table("guardrail_violations").select("*", count="exact").in_("rule_id", rule_ids)

    if agent_id:
        query = query.eq("agent_id", agent_id)
    if guardrail_id:
        query = query.eq("rule_id", guardrail_id)
    if start:
        query = query.gte("created_at", start)
    if end:
        query = query.lte("created_at", end)

    offset = (page - 1) * per_page
    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    rows = result.data or []
    total = result.count or 0

    # Enrich with rule and agent names
    rule_map: dict[str, str] = {}
    agent_map: dict[str, str] = {}

    for rid in {r.get("rule_id") for r in rows if r.get("rule_id")}:
        rule_res = db.table("guardrail_rules").select("name").eq("id", rid).maybe_single().execute()
        if rule_res.data:
            rule_map[rid] = rule_res.data["name"]

    for aid in {r.get("agent_id") for r in rows if r.get("agent_id")}:
        agent_res = db.table("agents").select("name").eq("id", aid).maybe_single().execute()
        if agent_res.data:
            agent_map[aid] = agent_res.data["name"]

    enriched = []
    for r in rows:
        enriched.append({
            "id": r["id"],
            "rule_id": r.get("rule_id"),
            "guardrail_name": rule_map.get(r.get("rule_id", ""), r.get("rule_id")),
            "agent_id": r.get("agent_id"),
            "agent_name": agent_map.get(r.get("agent_id", ""), r.get("agent_id")),
            "session_id": r.get("session_id"),
            "matched_content": r.get("matched_content"),
            "action_taken": r.get("action_taken", "log"),
            "created_at": r.get("created_at"),
        })

    return {
        "data": enriched,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": max(1, math.ceil(total / per_page)),
        },
    }
