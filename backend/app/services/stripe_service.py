"""Stripe service — checkout, portal, and webhook event handlers."""
from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

logger = logging.getLogger(__name__)

PLAN_CONFIGS: dict[str, dict[str, Any]] = {
    "free": {
        "max_agents": 1,
        "max_requests": 10_000,
        "history_days": 7,
        "modules": ["monitor"],
    },
    "starter": {
        "max_agents": 5,
        "max_requests": 100_000,
        "history_days": 30,
        "modules": ["monitor", "replay"],
    },
    "pro": {
        "max_agents": 999_999,
        "max_requests": 500_000,
        "history_days": 90,
        "modules": ["monitor", "replay", "protect"],
    },
    "team": {
        "max_agents": 999_999,
        "max_requests": 999_999_999,
        "history_days": 365,
        "modules": ["monitor", "replay", "protect"],
    },
}


def _stripe():
    import stripe as _stripe_lib
    from app.config import settings
    _stripe_lib.api_key = settings.stripe_secret_key
    return _stripe_lib


def create_checkout_session(
    org_id: str,
    plan: str,
    user_email: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout session for a subscription. Returns checkout URL."""
    from app.config import settings
    stripe = _stripe()

    price_map = {
        "starter": settings.stripe_price_starter,
        "pro": settings.stripe_price_pro,
        "team": settings.stripe_price_team,
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise ValueError(f"No Stripe price configured for plan '{plan}'")

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={"organization_id": org_id, "plan": plan},
        allow_promotion_codes=True,
        customer_email=user_email,
    )
    return session.url


def create_portal_session(customer_id: str, return_url: str) -> str:
    """Create a Stripe Billing Portal session. Returns portal URL."""
    stripe = _stripe()
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session.url


def handle_webhook_event(payload: bytes, sig_header: str, redis_client, db_client) -> None:
    """Verify Stripe signature and dispatch to the appropriate handler (sync)."""
    from app.config import settings
    stripe = _stripe()

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid Stripe signature")
    except ValueError:
        raise ValueError("Invalid payload")

    event_data = dict(event)
    event_id = event_data.get("id", "")

    # Idempotence — skip if already processed (TTL 48h)
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        already = loop.run_until_complete(redis_client.get(f"stripe_event:{event_id}"))
    except Exception:
        already = None

    if already:
        logger.info(f"[stripe] event {event_id} already processed — skipping")
        return

    handlers = {
        "checkout.session.completed": _handle_checkout_completed,
        "invoice.paid": _handle_invoice_paid,
        "invoice.payment_failed": _handle_payment_failed,
        "customer.subscription.updated": _handle_subscription_updated,
        "customer.subscription.deleted": _handle_subscription_deleted,
    }

    event_type = event_data.get("type")
    handler = handlers.get(event_type)
    if handler:
        handler(event, db_client)
        logger.info(f"[stripe] handled event {event_type} ({event_id})")
    else:
        logger.debug(f"[stripe] unhandled event type: {event_type}")

    # Mark as processed
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(redis_client.setex(f"stripe_event:{event_id}", 172800, "1"))
    except Exception:
        pass


def _get_org_by_stripe_customer(customer_id: str, db) -> dict | None:
    result = db.table("organizations").select("*").eq("stripe_customer_id", customer_id).maybe_single().execute()
    return result.data


def _apply_plan_to_org(org_id: str, plan: str, customer_id: str, subscription_id: str, db) -> None:
    config = PLAN_CONFIGS[plan]
    db.table("organizations").update({
        "plan": plan,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "max_agents": config["max_agents"],
        "max_requests": config["max_requests"],
        "history_days": config["history_days"],
        "modules_enabled": config["modules"],
    }).eq("id", org_id).execute()


def _handle_checkout_completed(event, db) -> None:
    session = event["data"]["object"]
    metadata = getattr(session, "metadata", {}) or {}
    if isinstance(metadata, str):
        import json as _json
        metadata = _json.loads(metadata)
    org_id = metadata.get("organization_id") if isinstance(metadata, dict) else getattr(metadata, "organization_id", None)
    plan = metadata.get("plan") if isinstance(metadata, dict) else getattr(metadata, "plan", None)
    if not org_id or not plan or plan not in PLAN_CONFIGS:
        logger.warning("[stripe] checkout.completed: missing org_id or plan in metadata")
        return

    _apply_plan_to_org(
        org_id=org_id,
        plan=plan,
        customer_id=getattr(session, "customer", "") or "",
        subscription_id=getattr(session, "subscription", "") or "",
        db=db,
    )
    _audit(org_id, None, "plan.upgraded", "organization", org_id, {"plan": plan}, db)
    _send_plan_activated_email(org_id, plan, db)


def _handle_invoice_paid(event, db) -> None:
    invoice = event["data"]["object"]
    customer_id = getattr(invoice, "customer", "") or ""
    org = _get_org_by_stripe_customer(customer_id, db)
    if org:
        logger.info(f"[stripe] invoice.paid for org {org['id']} — renewal confirmed")


def _handle_payment_failed(event, db) -> None:
    invoice = event["data"]["object"]
    customer_id = getattr(invoice, "customer", "") or ""
    org = _get_org_by_stripe_customer(customer_id, db)
    if not org:
        return

    grace_end = datetime.now(timezone.utc) + timedelta(days=7)
    _audit(
        org["id"], None, "billing.payment_failed", "organization", org["id"],
        {"grace_period_ends": grace_end.isoformat()}, db,
    )
    _send_payment_failed_email(org["id"], grace_end, db)


def _handle_subscription_updated(event, db) -> None:
    subscription = event["data"]["object"]
    customer_id = getattr(subscription, "customer", "") or ""
    org = _get_org_by_stripe_customer(customer_id, db)
    if not org:
        return

    # Determine plan from price metadata (best-effort — metadata stored during checkout)
    new_plan = _infer_plan_from_subscription(subscription)
    if not new_plan:
        logger.warning("[stripe] subscription.updated: cannot infer plan")
        return

    old_plan = org.get("plan", "free")
    _apply_plan_to_org(
        org_id=org["id"],
        plan=new_plan,
        customer_id=customer_id,
        subscription_id=getattr(subscription, "id", "") or "",
        db=db,
    )

    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    action = "plan.upgraded" if plan_rank.get(new_plan, 0) > plan_rank.get(old_plan, 0) else "plan.downgraded"
    _audit(org["id"], None, action, "organization", org["id"], {"from": old_plan, "to": new_plan}, db)


def _handle_subscription_deleted(event, db) -> None:
    subscription = event["data"]["object"]
    customer_id = getattr(subscription, "customer", "") or ""
    org = _get_org_by_stripe_customer(customer_id, db)
    if not org:
        return

    config = PLAN_CONFIGS["free"]
    db.table("organizations").update({
        "plan": "free",
        "stripe_subscription_id": None,
        "max_agents": config["max_agents"],
        "max_requests": config["max_requests"],
        "history_days": config["history_days"],
        "modules_enabled": config["modules"],
    }).eq("id", org["id"]).execute()

    _audit(org["id"], None, "plan.downgraded", "organization", org["id"], {"plan": "free"}, db)
    _send_plan_downgraded_email(org["id"], db)


def _infer_plan_from_subscription(subscription) -> str | None:
    """Try to infer plan from subscription metadata or price ID."""
    from app.config import settings
    items_obj = getattr(subscription, "items", None) or {}
    items_data = getattr(items_obj, "data", None) if not isinstance(items_obj, dict) else items_obj.get("data", [])
    if not items_data:
        return None
    first_item = items_data[0]
    price_obj = getattr(first_item, "price", None) if not isinstance(first_item, dict) else first_item.get("price", {})
    price_id = getattr(price_obj, "id", "") if not isinstance(price_obj, dict) else price_obj.get("id", "")
    price_map = {
        settings.stripe_price_starter: "starter",
        settings.stripe_price_pro: "pro",
        settings.stripe_price_team: "team",
    }
    return price_map.get(price_id)


def _audit(org_id: str, user_id: str | None, action: str, resource_type: str, resource_id: str, details: dict, db) -> None:
    """Insert an audit log entry."""
    try:
        db.table("audit_log").insert({
            "organization_id": org_id,
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details,
            "ip_address": None,
        }).execute()
    except Exception as exc:
        logger.error(f"[stripe] audit log failed: {exc}")


def _send_plan_activated_email(org_id: str, plan: str, db) -> None:
    try:
        owner = db.table("users").select("email").eq("organization_id", org_id).eq("role", "owner").maybe_single().execute()
        if owner.data:
            from app.services.brevo import BrevoService
            svc = BrevoService()
            plan_names = {"starter": "Starter", "pro": "Pro", "team": "Team"}
            svc._post("/smtp/email", {
                "sender": {"name": "AgentShield", "email": "alerts@agentshield.one"},
                "to": [{"email": owner.data["email"]}],
                "subject": f"🎉 Welcome to AgentShield {plan_names.get(plan, plan)}!",
                "htmlContent": (
                    f"<p>Your subscription to AgentShield <strong>{plan_names.get(plan, plan)}</strong> is now active.</p>"
                    f"<p><a href='https://app.agentshield.one/dashboard'>Open Dashboard →</a></p>"
                ),
            })
    except Exception as exc:
        logger.error(f"[stripe] plan activated email failed: {exc}")


def _send_payment_failed_email(org_id: str, grace_end: datetime, db) -> None:
    try:
        owner = db.table("users").select("email").eq("organization_id", org_id).eq("role", "owner").maybe_single().execute()
        if owner.data:
            from app.services.brevo import BrevoService
            svc = BrevoService()
            svc._post("/smtp/email", {
                "sender": {"name": "AgentShield", "email": "alerts@agentshield.one"},
                "to": [{"email": owner.data["email"]}],
                "subject": "⚠️ AgentShield — Payment failed",
                "htmlContent": (
                    f"<p>Your payment has failed. You have a 7-day grace period until "
                    f"<strong>{grace_end.strftime('%B %d, %Y')}</strong> to update your payment method.</p>"
                    f"<p><a href='https://app.agentshield.one/dashboard/settings'>Update Payment →</a></p>"
                ),
            })
    except Exception as exc:
        logger.error(f"[stripe] payment failed email failed: {exc}")


def _send_plan_downgraded_email(org_id: str, db) -> None:
    try:
        owner = db.table("users").select("email").eq("organization_id", org_id).eq("role", "owner").maybe_single().execute()
        if owner.data:
            from app.services.brevo import BrevoService
            svc = BrevoService()
            svc._post("/smtp/email", {
                "sender": {"name": "AgentShield", "email": "alerts@agentshield.one"},
                "to": [{"email": owner.data["email"]}],
                "subject": "AgentShield — Your subscription has been cancelled",
                "htmlContent": (
                    "<p>Your AgentShield subscription has been cancelled. Your account has been downgraded to the Free plan.</p>"
                    "<p>Your data is preserved. You can resubscribe at any time.</p>"
                    "<p><a href='https://app.agentshield.one/dashboard/settings'>Resubscribe →</a></p>"
                ),
            })
    except Exception as exc:
        logger.error(f"[stripe] plan downgraded email failed: {exc}")
