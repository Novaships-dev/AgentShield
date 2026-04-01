"""GET /v1/sessions and GET /v1/sessions/:session_id endpoints."""
from __future__ import annotations

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user, get_db, get_redis, require_plan
from app.models.user import User
from app.schemas.session import (
    PaginationMeta,
    SessionListResponse,
    SessionResponse,
    SessionTimelineResponse,
)

router = APIRouter(tags=["sessions"])


@router.get(
    "/v1/sessions",
    response_model=SessionListResponse,
    summary="List sessions",
)
async def list_sessions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    range: str | None = Query(None, description="today / 7d / 30d / custom"),
    start: str | None = Query(None),
    end: str | None = Query(None),
    agent_id: str | None = Query(None),
    status: str | None = Query(None, pattern="^(success|error|partial|running)$"),
    search: str | None = Query(None),
    min_cost: float | None = Query(None, ge=0),
    max_cost: float | None = Query(None, ge=0),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
    _plan=Depends(require_plan("starter")),
) -> SessionListResponse:
    """List sessions for the organization with optional filtering and pagination.

    Requires Starter plan or higher.
    """
    org_id = user.organization_id

    query = db.table("agent_sessions").select("*", count="exact").eq("organization_id", org_id)

    # Date range filter
    if range == "today":
        today = datetime.now(timezone.utc).date().isoformat()
        query = query.gte("started_at", f"{today}T00:00:00Z")
    elif range == "7d":
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query = query.gte("started_at", cutoff)
    elif range == "30d":
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query = query.gte("started_at", cutoff)
    elif range == "custom" and start:
        query = query.gte("started_at", start)
        if end:
            query = query.lte("started_at", end)

    if status:
        query = query.eq("status", status)

    if search:
        query = query.ilike("session_id", f"%{search}%")

    if min_cost is not None:
        query = query.gte("total_cost_usd", min_cost)

    if max_cost is not None:
        query = query.lte("total_cost_usd", max_cost)

    # Pagination
    offset = (page - 1) * per_page
    result = query.order("started_at", desc=True).range(offset, offset + per_page - 1).execute()

    rows = result.data or []
    total = result.count or 0
    total_pages = max(1, math.ceil(total / per_page))

    # Resolve agent names from agent_ids
    sessions = []
    for row in rows:
        agent_names = _resolve_agent_names(db, row.get("agent_ids") or [])
        started = row.get("started_at")
        ended = row.get("ended_at")
        duration_ms = _compute_duration_ms(started, ended)
        sessions.append(
            SessionResponse(
                id=row.get("id"),
                session_id=row["session_id"],
                agents=agent_names,
                total_steps=row.get("total_steps") or 0,
                total_cost_usd=row.get("total_cost_usd"),
                total_tokens=row.get("total_tokens") or 0,
                status=row.get("status", "running"),
                duration_ms=duration_ms,
                started_at=started,
                ended_at=ended,
            )
        )

    return SessionListResponse(
        data=sessions,
        pagination=PaginationMeta(
            page=page,
            per_page=per_page,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get(
    "/v1/sessions/{session_id}",
    response_model=SessionTimelineResponse,
    summary="Get session timeline",
)
async def get_session_timeline(
    session_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
    _plan=Depends(require_plan("starter")),
) -> SessionTimelineResponse:
    """Get the step-by-step timeline for a specific session.

    Requires Starter plan or higher.
    """
    from app.services.replay import ReplayService

    svc = ReplayService(db=db)
    timeline = await svc.get_session_timeline(
        org_id=user.organization_id,
        session_id=session_id,
        viewer_role=user.role,
    )
    return timeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_agent_names(db, agent_ids: list[str]) -> list[str]:
    """Batch-load agent names from a list of agent IDs."""
    if not agent_ids:
        return []
    try:
        result = db.table("agents").select("id,name").in_("id", agent_ids).execute()
        id_to_name = {row["id"]: row["name"] for row in (result.data or [])}
        return [id_to_name.get(aid, aid) for aid in agent_ids]
    except Exception:
        return agent_ids


def _compute_duration_ms(started_at: str | None, ended_at: str | None) -> int | None:
    """Compute duration in milliseconds between two ISO timestamps."""
    if not started_at or not ended_at:
        return None
    try:
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
        return max(0, int((end - start).total_seconds() * 1000))
    except Exception:
        return None
