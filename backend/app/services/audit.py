"""Audit log service — immutable INSERT-only log for admin actions."""
from __future__ import annotations
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# All valid audit actions
AUDIT_ACTIONS = frozenset({
    "api_key.created",
    "api_key.revoked",
    "alert_rule.created",
    "alert_rule.updated",
    "alert_rule.deleted",
    "alert_rule.toggled",
    "budget_cap.created",
    "budget_cap.deleted",
    "guardrail_rule.created",
    "guardrail_rule.updated",
    "guardrail_rule.deleted",
    "pii_config.updated",
    "kill_switch.activated",
    "kill_switch.deactivated",
    "session.shared",
    "session.share_revoked",
    "plan.upgraded",
    "plan.downgraded",
    "billing.payment_failed",
    "member.invited",
    "member.role_changed",
    "member.team_changed",
    "member.removed",
    "webhook.created",
    "webhook.deleted",
    "webhook.tested",
    "report.generated",
})


def log(
    org_id: str,
    user_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict,
    ip_address: Optional[str] = None,
    db=None,
) -> None:
    """
    Insert an audit log entry. IMMUTABLE — no UPDATE, no DELETE.
    Silently ignores errors to never block the main operation.
    """
    if db is None:
        try:
            from app.utils.supabase import get_supabase_client
            db = get_supabase_client()
        except Exception:
            return

    try:
        db.table("audit_log").insert({
            "organization_id": org_id,
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address,
        }).execute()
    except Exception as exc:
        logger.error(f"[audit] failed to log '{action}': {exc}")


def log_from_request(
    request,  # FastAPI Request
    org_id: str,
    user_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict,
    db=None,
) -> None:
    """Extract IP from request and call log()."""
    ip = None
    try:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        elif request.client:
            ip = request.client.host
    except Exception:
        pass
    log(org_id=org_id, user_id=user_id, action=action, resource_type=resource_type,
        resource_id=resource_id, details=details, ip_address=ip, db=db)
