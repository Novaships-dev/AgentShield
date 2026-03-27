"""Celery tasks for outbound webhook delivery with retry and endpoint health check."""
from __future__ import annotations
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

RETRY_DELAYS = [0, 60, 300, 1800, 7200]
MAX_CONSECUTIVE_FAILURES = 3


@celery_app.task(name="webhooks.dispatch", bind=True, max_retries=5)
def dispatch_webhook(self, delivery_id: str) -> None:
    """Sign and send a queued webhook delivery. Retries on 5xx/timeout."""
    try:
        from app.utils.supabase import get_supabase_client
        db = get_supabase_client()

        delivery = db.table("webhook_deliveries").select("*").eq("id", delivery_id).maybe_single().execute()
        if not delivery.data:
            logger.warning(f"[webhooks] delivery {delivery_id} not found")
            return

        d = delivery.data
        endpoint = db.table("webhook_endpoints").select("*").eq("id", d["endpoint_id"]).maybe_single().execute()
        if not endpoint.data or not endpoint.data.get("is_active"):
            db.table("webhook_deliveries").update({"status": "skipped"}).eq("id", delivery_id).execute()
            return

        ep = endpoint.data
        attempt = self.request.retries + 1
        db.table("webhook_deliveries").update({"attempt": attempt, "status": "sending"}).eq("id", delivery_id).execute()

        from app.services.webhooks import _send_signed
        status_code, success = _send_signed(ep, d["payload"])

        if success:
            db.table("webhook_deliveries").update({
                "status": "delivered",
                "status_code": status_code,
                "delivered_at": "now()",
            }).eq("id", delivery_id).execute()
            # Reset consecutive failures
            db.table("webhook_endpoints").update({"consecutive_failures": 0}).eq("id", ep["id"]).execute()
            logger.info(f"[webhooks] delivery {delivery_id} succeeded (HTTP {status_code})")
            return

        # 4xx — client error, no retry
        if status_code and 400 <= status_code < 500:
            db.table("webhook_deliveries").update({
                "status": "failed",
                "status_code": status_code,
                "error_message": f"Client error: {status_code}",
            }).eq("id", delivery_id).execute()
            _increment_failures(ep["id"], db)
            return

        # 5xx or timeout — retry
        error_msg = f"Server error: {status_code}" if status_code else "Timeout"
        db.table("webhook_deliveries").update({
            "status": "retrying",
            "status_code": status_code,
            "error_message": error_msg,
        }).eq("id", delivery_id).execute()

        current_attempt = self.request.retries
        if current_attempt < len(RETRY_DELAYS) - 1:
            raise self.retry(countdown=RETRY_DELAYS[current_attempt + 1])
        else:
            # Max retries exhausted
            db.table("webhook_deliveries").update({
                "status": "failed",
                "error_message": f"Failed after 5 attempts. Last error: {error_msg}",
            }).eq("id", delivery_id).execute()
            _increment_failures(ep["id"], db)
            _notify_owner_failure(ep["id"], d["event_type"], db)

    except Exception as exc:
        if not isinstance(exc, self.MaxRetriesExceededError):
            logger.error(f"[webhooks] dispatch error for {delivery_id}: {exc}", exc_info=True)
            raise


def _increment_failures(endpoint_id: str, db) -> None:
    ep = db.table("webhook_endpoints").select("consecutive_failures").eq("id", endpoint_id).maybe_single().execute()
    if not ep.data:
        return
    failures = (ep.data.get("consecutive_failures") or 0) + 1
    updates = {"consecutive_failures": failures}
    if failures >= MAX_CONSECUTIVE_FAILURES:
        updates["is_active"] = False
        logger.warning(f"[webhooks] endpoint {endpoint_id} disabled after {failures} consecutive failures")
        _notify_owner_disabled(endpoint_id, db)
    db.table("webhook_endpoints").update(updates).eq("id", endpoint_id).execute()


def _notify_owner_failure(endpoint_id: str, event_type: str, db) -> None:
    try:
        ep = db.table("webhook_endpoints").select("organization_id, url").eq("id", endpoint_id).maybe_single().execute()
        if not ep.data:
            return
        org_id = ep.data["organization_id"]
        url = ep.data["url"]
        owner = db.table("users").select("email").eq("organization_id", org_id).eq("role", "owner").maybe_single().execute()
        if owner.data:
            from app.services.brevo import BrevoService
            BrevoService()._post("/smtp/email", {
                "sender": {"name": "AgentShield", "email": "alerts@agentshield.io"},
                "to": [{"email": owner.data["email"]}],
                "subject": "⚠️ AgentShield — Webhook delivery failed",
                "htmlContent": (
                    f"<p>Webhook delivery to <code>{url}</code> failed after 5 attempts for event <code>{event_type}</code>.</p>"
                    f"<p><a href='https://app.agentshield.io/dashboard/settings'>View Webhooks →</a></p>"
                ),
            })
    except Exception as exc:
        logger.error(f"[webhooks] failure notification error: {exc}")


def _notify_owner_disabled(endpoint_id: str, db) -> None:
    try:
        ep = db.table("webhook_endpoints").select("organization_id, url").eq("id", endpoint_id).maybe_single().execute()
        if not ep.data:
            return
        org_id = ep.data["organization_id"]
        url = ep.data["url"]
        owner = db.table("users").select("email").eq("organization_id", org_id).eq("role", "owner").maybe_single().execute()
        if owner.data:
            from app.services.brevo import BrevoService
            BrevoService()._post("/smtp/email", {
                "sender": {"name": "AgentShield", "email": "alerts@agentshield.io"},
                "to": [{"email": owner.data["email"]}],
                "subject": "🔴 AgentShield — Webhook endpoint disabled",
                "htmlContent": (
                    f"<p>Your webhook endpoint <code>{url}</code> has been automatically disabled after "
                    f"3 consecutive delivery failures.</p>"
                    f"<p><a href='https://app.agentshield.io/dashboard/settings'>Manage Webhooks →</a></p>"
                ),
            })
    except Exception as exc:
        logger.error(f"[webhooks] disabled notification error: {exc}")
