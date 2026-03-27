"""Team management service — invitations, member CRUD."""
from __future__ import annotations
import logging
import secrets

logger = logging.getLogger(__name__)

INVITE_TOKEN_BYTES = 32


def invite_member(org_id: str, org_name: str, inviter_id: str, email: str, role: str, db) -> str:
    """Create a pending invitation and send an email. Returns the invitation token."""
    # Check if already a member
    existing = db.table("users").select("id").eq("organization_id", org_id).eq("email", email).maybe_single().execute()
    if existing.data:
        raise ValueError(f"User '{email}' is already a member of this organization.")

    token = secrets.token_urlsafe(INVITE_TOKEN_BYTES)

    # Upsert into invitations table
    db.table("invitations").upsert({
        "organization_id": org_id,
        "email": email,
        "role": role,
        "token": token,
        "invited_by": inviter_id,
    }).execute()

    _send_invitation_email(email=email, org_name=org_name, token=token)
    return token


def list_members(org_id: str, db) -> list[dict]:
    result = db.table("users").select("id, email, role, team_label, created_at").eq("organization_id", org_id).execute()
    return result.data or []


def update_member(org_id: str, member_id: str, role: str | None, team_label: str | None, db) -> dict:
    """Update a member's role or team label."""
    updates: dict = {}
    if role is not None:
        updates["role"] = role
    if team_label is not None:
        updates["team_label"] = team_label
    if not updates:
        raise ValueError("No fields to update.")

    result = db.table("users").update(updates).eq("id", member_id).eq("organization_id", org_id).execute()
    if not result.data:
        raise ValueError("Member not found or access denied.")
    return result.data[0]


def remove_member(org_id: str, member_id: str, requester_id: str, db) -> None:
    """Remove a member from the org. Cannot remove the owner or yourself."""
    member = db.table("users").select("id, role").eq("id", member_id).eq("organization_id", org_id).maybe_single().execute()
    if not member.data:
        raise ValueError("Member not found.")
    if member.data.get("role") == "owner":
        raise ValueError("Cannot remove the organization owner.")
    if member_id == requester_id:
        raise ValueError("Cannot remove yourself.")

    db.table("users").delete().eq("id", member_id).eq("organization_id", org_id).execute()


def _send_invitation_email(email: str, org_name: str, token: str) -> None:
    try:
        from app.services.brevo import BrevoService
        from app.config import settings
        svc = BrevoService()
        app_url = "https://app.agentshield.one"
        svc._post("/smtp/email", {
            "sender": {"name": "AgentShield", "email": "alerts@agentshield.one"},
            "to": [{"email": email}],
            "subject": f"You've been invited to join {org_name} on AgentShield",
            "htmlContent": (
                f"<p>You've been invited to join <strong>{org_name}</strong> on AgentShield.</p>"
                f"<p><a href='{app_url}/signup?invite={token}'>Accept Invitation →</a></p>"
                f"<p style='color:#888;font-size:12px'>This link expires in 7 days.</p>"
            ),
        })
    except Exception as exc:
        logger.error(f"[teams] invitation email failed: {exc}")
