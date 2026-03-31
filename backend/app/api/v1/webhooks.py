"""Outbound webhook endpoints — CRUD, test, delivery history."""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user, get_db, require_plan, require_role
from app.models.user import User
from app.schemas.webhook import (
    WebhookEndpointCreate, WebhookEndpointResponse,
    WebhookDeliveryResponse, TestWebhookResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["webhooks"])

_require_pro = require_plan("pro")
_require_admin = require_role("admin")


@router.post("/webhooks", response_model=WebhookEndpointResponse, status_code=201)
async def create_webhook(
    body: WebhookEndpointCreate,
    user: User = Depends(_require_admin),
    _plan=Depends(_require_pro),
    db=Depends(get_db),
) -> WebhookEndpointResponse:
    from app.services.webhooks import create_endpoint
    try:
        row = create_endpoint(
            org_id=user.organization_id,
            url=body.url,
            events=body.events,
            db=db,
        )
    except ValueError as exc:
        logger.warning(f"[webhooks] create failed: {exc}")
        raise HTTPException(status_code=400, detail="Failed to create webhook endpoint.")

    _audit(user, "webhook.created", "webhook", row["id"], {"url": body.url, "events": body.events}, db)
    return WebhookEndpointResponse(**_normalize(row, include_secret=True))


@router.get("/webhooks", response_model=list[WebhookEndpointResponse])
async def list_webhooks(
    user: User = Depends(get_current_user),
    _plan=Depends(_require_pro),
    db=Depends(get_db),
) -> list[WebhookEndpointResponse]:
    from app.services.webhooks import list_endpoints
    rows = list_endpoints(org_id=user.organization_id, db=db)
    return [WebhookEndpointResponse(**_normalize(r)) for r in rows]


@router.delete("/webhooks/{endpoint_id}", status_code=204)
async def delete_webhook(
    endpoint_id: str,
    user: User = Depends(_require_admin),
    db=Depends(get_db),
) -> None:
    from app.services.webhooks import delete_endpoint
    delete_endpoint(org_id=user.organization_id, endpoint_id=endpoint_id, db=db)
    _audit(user, "webhook.deleted", "webhook", endpoint_id, {}, db)


@router.post("/webhooks/{endpoint_id}/test", response_model=TestWebhookResponse)
async def test_webhook(
    endpoint_id: str,
    user: User = Depends(_require_admin),
    db=Depends(get_db),
) -> TestWebhookResponse:
    from app.services.webhooks import test_endpoint
    try:
        result = test_endpoint(org_id=user.organization_id, endpoint_id=endpoint_id, db=db)
    except ValueError as exc:
        logger.warning(f"[webhooks] delete failed: {exc}")
        raise HTTPException(status_code=404, detail="Webhook endpoint not found.")
    _audit(user, "webhook.tested", "webhook", endpoint_id, {"success": result["success"]}, db)
    return TestWebhookResponse(**result)


@router.get("/webhooks/{endpoint_id}/deliveries", response_model=list[WebhookDeliveryResponse])
async def list_deliveries(
    endpoint_id: str,
    user: User = Depends(get_current_user),
    _plan=Depends(_require_pro),
    db=Depends(get_db),
) -> list[WebhookDeliveryResponse]:
    # Verify endpoint belongs to org
    ep = db.table("webhook_endpoints").select("id").eq("id", endpoint_id).eq("organization_id", user.organization_id).maybe_single().execute()
    if not ep.data:
        raise HTTPException(status_code=404, detail="Endpoint not found.")

    result = (
        db.table("webhook_deliveries")
        .select("id, endpoint_id, event_type, status, status_code, attempt, error_message, created_at, delivered_at")
        .eq("endpoint_id", endpoint_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [WebhookDeliveryResponse(**r) for r in (result.data or [])]


def _normalize(row: dict, *, include_secret: bool = False) -> dict:
    """Ensure required fields have defaults. Never expose secret unless explicitly requested."""
    result = {
        "id": row.get("id", ""),
        "url": row.get("url", ""),
        "events": row.get("events") or [],
        "is_active": row.get("is_active", True),
        "has_secret": bool(row.get("secret")),
        "consecutive_failures": row.get("consecutive_failures", 0),
        "created_at": row.get("created_at", ""),
    }
    if include_secret:
        result["secret"] = row.get("secret")
    return result


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
        logger.error(f"[webhooks] audit failed: {exc}")
