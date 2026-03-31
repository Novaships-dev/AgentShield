"""Team management endpoints."""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user, get_db, require_plan, require_role
from app.models.user import User
from app.schemas.team import InviteRequest, InviteResponse, MemberResponse, MemberUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["teams"])

_require_team = require_plan("team")
_require_admin = require_role("admin")


@router.post("/teams/invite", response_model=InviteResponse, status_code=201, summary="Invite a team member")
async def invite_member(
    body: InviteRequest,
    user: User = Depends(_require_admin),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> InviteResponse:
    # Load org name
    org_row = db.table("organizations").select("name").eq("id", user.organization_id).maybe_single().execute()
    org_name = (org_row.data or {}).get("name", "your organization")

    from app.services.teams import invite_member as svc_invite
    try:
        svc_invite(
            org_id=user.organization_id,
            org_name=org_name,
            inviter_id=user.id,
            email=body.email,
            role=body.role,
            db=db,
        )
    except ValueError as exc:
        logger.warning(f"[teams] operation failed: {exc}")
        raise HTTPException(status_code=400, detail="Operation failed. Please check your input and try again.")

    # Audit log
    _audit(user, "member.invited", "invitation", body.email, {"email": body.email, "role": body.role}, db)

    return InviteResponse(message="Invitation sent.", email=body.email)


@router.get("/teams/members", response_model=list[MemberResponse], summary="List team members")
async def list_members(
    user: User = Depends(get_current_user),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> list[MemberResponse]:
    from app.services.teams import list_members as svc_list
    members = svc_list(org_id=user.organization_id, db=db)
    return [MemberResponse(**m) for m in members]


@router.patch("/teams/members/{member_id}", response_model=MemberResponse, summary="Update member role or team label")
async def update_member(
    member_id: str,
    body: MemberUpdate,
    user: User = Depends(_require_admin),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> MemberResponse:
    from app.services.teams import update_member as svc_update
    try:
        updated = svc_update(
            org_id=user.organization_id,
            member_id=member_id,
            role=body.role,
            team_label=body.team_label,
            db=db,
        )
    except ValueError as exc:
        logger.warning(f"[teams] operation failed: {exc}")
        raise HTTPException(status_code=400, detail="Operation failed. Please check your input and try again.")

    if body.role:
        _audit(user, "member.role_changed", "user", member_id, {"role": body.role}, db)
    if body.team_label is not None:
        _audit(user, "member.team_changed", "user", member_id, {"team_label": body.team_label}, db)

    return MemberResponse(**updated)


@router.delete("/teams/members/{member_id}", status_code=204, summary="Remove a team member")
async def remove_member(
    member_id: str,
    user: User = Depends(_require_admin),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> None:
    from app.services.teams import remove_member as svc_remove
    try:
        svc_remove(
            org_id=user.organization_id,
            member_id=member_id,
            requester_id=user.id,
            db=db,
        )
    except ValueError as exc:
        logger.warning(f"[teams] operation failed: {exc}")
        raise HTTPException(status_code=400, detail="Operation failed. Please check your input and try again.")

    _audit(user, "member.removed", "user", member_id, {}, db)


@router.get("/teams/attribution", summary="Team cost attribution by team label")
async def get_attribution(
    period: str | None = None,
    user: User = Depends(get_current_user),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> dict:
    """Return cost breakdown by team label for the current (or specified) period."""
    from datetime import datetime, timezone
    import calendar

    now = datetime.now(timezone.utc)
    if period:
        try:
            start_dt = datetime.strptime(period, "%Y-%m")
            year, month = start_dt.year, start_dt.month
        except ValueError:
            raise HTTPException(status_code=400, detail="period must be YYYY-MM")
    else:
        year, month = now.year, now.month

    period_start = f"{year}-{month:02d}-01T00:00:00+00:00"
    last_day = calendar.monthrange(year, month)[1]
    period_end = f"{year}-{month:02d}-{last_day:02d}T23:59:59+00:00"

    # Fetch events for the period with agent info joined via agent_id
    events = (
        db.table("events")
        .select("cost_usd, agent_id, user_label, team_label")
        .eq("organization_id", user.organization_id)
        .gte("tracked_at", period_start)
        .lte("tracked_at", period_end)
        .execute()
    )
    rows = events.data or []

    # Aggregate by team_label
    teams: dict[str, dict] = {}
    total_cost = 0.0

    for row in rows:
        label = row.get("team_label") or "unassigned"
        cost = float(row.get("cost_usd") or 0)
        total_cost += cost
        if label not in teams:
            teams[label] = {"team_label": label, "members": set(), "agents": set(), "cost_usd": 0.0}
        teams[label]["cost_usd"] += cost
        if row.get("user_label"):
            teams[label]["members"].add(row["user_label"])
        if row.get("agent_id"):
            teams[label]["agents"].add(row["agent_id"])

    result = []
    for t in sorted(teams.values(), key=lambda x: x["cost_usd"], reverse=True):
        pct = round(t["cost_usd"] / total_cost * 100, 1) if total_cost > 0 else 0
        result.append({
            "team_label": t["team_label"],
            "members": len(t["members"]),
            "agents": len(t["agents"]),
            "cost_usd": round(t["cost_usd"], 4),
            "pct": pct,
        })

    return {
        "period": f"{year}-{month:02d}",
        "total_cost_usd": round(total_cost, 4),
        "teams": result,
    }


def _audit(user: User, action: str, resource_type: str, resource_id: str, details: dict, db) -> None:
    try:
        db.table("audit_log").insert({
            "organization_id": user.organization_id,
            "user_id": user.id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details,
            "ip_address": None,
        }).execute()
    except Exception as exc:
        logger.error(f"[teams] audit log failed: {exc}")
