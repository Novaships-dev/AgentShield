"""Audit log endpoint — GET /v1/audit (Team plan required)."""
from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_db, require_plan
from app.models.user import User
from app.schemas.audit import AuditLogResponse, AuditLogEntry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["audit"])

_require_team = require_plan("team")


@router.get("/audit", response_model=AuditLogResponse, summary="Get audit log")
async def get_audit_log(
    page: int = 1,
    per_page: int = 50,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> AuditLogResponse:
    """Return paginated audit log entries for the organization."""
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    query = db.table("audit_log").select("*", count="exact").eq("organization_id", current_user.organization_id)

    if user_id:
        query = query.eq("user_id", user_id)
    if action:
        query = query.eq("action", action)
    if resource_type:
        query = query.eq("resource_type", resource_type)
    if start:
        query = query.gte("created_at", start)
    if end:
        query = query.lte("created_at", end)

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    rows = result.data or []
    total = result.count or 0

    # Resolve user emails
    user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
    email_map: dict[str, str] = {}
    if user_ids:
        users = db.table("users").select("id, email").in_("id", user_ids).execute()
        email_map = {u["id"]: u["email"] for u in (users.data or [])}

    entries = [
        AuditLogEntry(
            id=r["id"],
            organization_id=r["organization_id"],
            user_id=r.get("user_id"),
            user_email=email_map.get(r["user_id"], "") if r.get("user_id") else None,
            action=r["action"],
            resource_type=r["resource_type"],
            resource_id=r["resource_id"],
            details=r.get("details") or {},
            ip_address=r.get("ip_address"),
            created_at=r["created_at"],
        )
        for r in rows
    ]

    return AuditLogResponse(data=entries, total=total, page=page, per_page=per_page)
