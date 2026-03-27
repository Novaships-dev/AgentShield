"""Session sharing endpoints."""
from __future__ import annotations
import secrets
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user, require_role, get_db
from app.models.user import User
from app.schemas.share import ShareSessionRequest, ShareSessionResponse

router = APIRouter(prefix="/v1", tags=["sessions", "share"])

APP_BASE_URL = "https://app.agentshield.io"
MAX_SHARE_LINKS = 50

_EXPIRY_MAP = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "never": None,
}


def _require_pro(user: User = Depends(require_role("admin"))) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Session sharing requires Pro plan or higher.")
    return user


@router.post(
    "/sessions/{session_id}/share",
    status_code=201,
    response_model=ShareSessionResponse,
    summary="Create a share link for a session",
)
async def share_session(
    session_id: str,
    body: ShareSessionRequest,
    user: User = Depends(_require_pro),
    db=Depends(get_db),
) -> ShareSessionResponse:
    """Generate a public share token for a session. Max 50 active links per org."""
    org_id = user.organization_id

    # Check session ownership
    session_res = (
        db.table("sessions")
        .select("id, session_id")
        .eq("organization_id", org_id)
        .eq("session_id", session_id)
        .maybe_single()
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check active link count
    count_res = (
        db.table("shared_sessions")
        .select("id", count="exact")
        .eq("organization_id", org_id)
        .execute()
    )
    if (count_res.count or 0) >= MAX_SHARE_LINKS:
        raise HTTPException(status_code=409, detail=f"Maximum {MAX_SHARE_LINKS} active share links reached.")

    # Generate token
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    delta = _EXPIRY_MAP.get(body.expires_in)
    expires_at = (now + delta).isoformat() if delta else None

    db.table("shared_sessions").insert({
        "id": str(uuid.uuid4()),
        "organization_id": org_id,
        "session_id": session_id,
        "share_token": token,
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    }).execute()

    share_url = f"{APP_BASE_URL}/share/{token}"
    return ShareSessionResponse(
        share_token=token,
        share_url=share_url,
        expires_at=datetime.fromisoformat(expires_at) if expires_at else None,
        session_id=session_id,
    )


@router.get(
    "/share/{token}",
    summary="Get shared session by token (public endpoint)",
)
async def get_shared_session(
    token: str,
    db=Depends(get_db),
) -> dict:
    """Public endpoint to view a shared session. No auth required."""
    now = datetime.now(timezone.utc).isoformat()

    link_res = (
        db.table("shared_sessions")
        .select("*")
        .eq("share_token", token)
        .maybe_single()
        .execute()
    )
    if not link_res.data:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    link = link_res.data
    if link.get("expires_at") and link["expires_at"] < now:
        raise HTTPException(status_code=404, detail="Share link has expired")

    # Load timeline — always redacted
    from app.services.replay import ReplayService
    svc = ReplayService(db=db)
    timeline = await svc.get_session_timeline(
        org_id=link["organization_id"],
        session_id=link["session_id"],
        viewer_role="member",  # public — always show redacted
    )
    return timeline.model_dump()
