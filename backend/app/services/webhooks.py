"""Outbound webhook service — endpoint CRUD, dispatch, HMAC signing."""
from __future__ import annotations
import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

MAX_ENDPOINTS_PER_ORG = 5
RETRY_DELAYS = [0, 60, 300, 1800, 7200]  # seconds


def create_endpoint(org_id: str, url: str, events: list[str], db) -> dict:
    """Create a new webhook endpoint. Returns the row including the plaintext secret (once)."""
    # Enforce max 5 endpoints
    count = db.table("webhook_endpoints").select("id", count="exact").eq("organization_id", org_id).execute()
    if (count.count or 0) >= MAX_ENDPOINTS_PER_ORG:
        raise ValueError(f"Maximum {MAX_ENDPOINTS_PER_ORG} webhook endpoints per organization.")

    secret = secrets.token_urlsafe(32)
    result = db.table("webhook_endpoints").insert({
        "organization_id": org_id,
        "url": url,
        "events": events,
        "secret": secret,
        "is_active": True,
        "consecutive_failures": 0,
    }).execute()
    row = result.data[0]
    row["secret"] = secret  # Include plaintext for one-time display
    return row


def list_endpoints(org_id: str, db) -> list[dict]:
    """List endpoints without secrets."""
    result = db.table("webhook_endpoints").select(
        "id, url, events, is_active, consecutive_failures, created_at"
    ).eq("organization_id", org_id).execute()
    return result.data or []


def delete_endpoint(org_id: str, endpoint_id: str, db) -> None:
    db.table("webhook_endpoints").delete().eq("id", endpoint_id).eq("organization_id", org_id).execute()


def test_endpoint(org_id: str, endpoint_id: str, db) -> dict:
    """Send a test payload to the endpoint. Returns delivery result."""
    row = db.table("webhook_endpoints").select("*").eq("id", endpoint_id).eq("organization_id", org_id).maybe_single().execute()
    if not row.data:
        raise ValueError("Endpoint not found.")

    endpoint = row.data
    payload = {
        "id": f"wh_test_{uuid4().hex[:16]}",
        "type": "test",
        "api_version": "v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": org_id,
        "data": {
            "message": "This is a test webhook from AgentShield.",
        },
    }

    delivery_id = str(uuid4())
    status_code, success = _send_signed(endpoint, payload)

    return {"delivery_id": delivery_id, "status_code": status_code, "success": success}


def dispatch(org_id: str, event_type: str, payload_data: dict, db) -> None:
    """
    Find all active endpoints listening to event_type and dispatch Celery tasks.
    Non-blocking — fire and forget.
    """
    endpoints = (
        db.table("webhook_endpoints")
        .select("id, url, events, secret, is_active, consecutive_failures")
        .eq("organization_id", org_id)
        .eq("is_active", True)
        .execute()
    )
    for endpoint in (endpoints.data or []):
        if event_type not in (endpoint.get("events") or []):
            continue

        payload = {
            "id": f"wh_{uuid4()}",
            "type": event_type,
            "api_version": "v1",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "organization_id": org_id,
            "data": payload_data,
        }

        # Create a delivery record
        delivery = db.table("webhook_deliveries").insert({
            "endpoint_id": endpoint["id"],
            "event_type": event_type,
            "payload": payload,
            "status": "pending",
            "attempt": 0,
        }).execute()
        delivery_id = delivery.data[0]["id"] if delivery.data else None

        if delivery_id:
            try:
                from app.workers.tasks_webhooks import dispatch_webhook
                dispatch_webhook.delay(delivery_id)
            except Exception as exc:
                logger.error(f"[webhooks] failed to queue delivery {delivery_id}: {exc}")


def sign_payload(payload_json: str, secret: str) -> tuple[str, int]:
    """Return (signature, timestamp). signature = sha256=HMAC(secret, '{ts}.{payload}')."""
    ts = int(time.time())
    message = f"{ts}.{payload_json}"
    sig = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"sha256={sig}", ts


def _send_signed(endpoint: dict, payload: dict) -> tuple[Optional[int], bool]:
    """Sign and POST the payload synchronously. Returns (status_code, success)."""
    import urllib.request
    import urllib.error

    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    signature, ts = sign_payload(payload_json, endpoint["secret"])

    headers = {
        "Content-Type": "application/json",
        "X-AGS-Signature": signature,
        "X-AGS-Timestamp": str(ts),
        "X-AGS-Event": payload.get("type", "test"),
        "X-AGS-Delivery-Id": payload.get("id", ""),
        "User-Agent": "AgentShield-Webhook/1.0",
    }

    req = urllib.request.Request(
        endpoint["url"],
        data=payload_json.encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        return exc.code, False
    except Exception:
        return None, False
