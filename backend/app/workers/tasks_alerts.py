"""Celery tasks for alert evaluation and notifications."""
from __future__ import annotations
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="alerts.check_thresholds", bind=True, max_retries=3)
def check_alert_thresholds(self, org_id: str, agent_id: str | None = None):
    """Evaluate alert rules for an org/agent after a new event is tracked."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.utils.redis import get_redis_client
        from app.services.alerts import AlertService
        import asyncio

        db = get_supabase_client()
        redis = get_redis_client()
        svc = AlertService(db=db, redis=redis)

        # Load active rules for this org (scoped to agent if provided)
        query = db.table("alert_rules").select("*").eq("organization_id", org_id).eq("is_active", True)
        result = query.execute()
        rules = result.data or []

        # Filter: rules that match this agent or are org-wide
        relevant = [
            r for r in rules
            if r.get("agent_id") is None or r.get("agent_id") == agent_id
        ]

        for rule in relevant:
            # 1. Check cooldown first (avoids DB query if not needed)
            if not svc.should_trigger(rule):
                logger.debug(f"[alerts] rule {rule['id']} in cooldown — skipping")
                continue

            # 2. Evaluate metric
            try:
                current_value = svc.evaluate_metric(org_id, rule.get("agent_id") or agent_id, rule["metric"])
            except Exception as exc:
                logger.warning(f"[alerts] metric eval failed for rule {rule['id']}: {exc}")
                continue

            # 3. Threshold check
            if current_value <= rule["threshold"]:
                continue

            logger.info(f"[alerts] rule {rule['id']} triggered: {current_value} > {rule['threshold']}")

            # 4. Record alert history + update last_triggered
            history_id = svc.record_alert(
                org_id=org_id,
                rule=rule,
                triggered_value=current_value,
                agent_id=agent_id,
            )

            # 5. Dispatch notifications (fire-and-forget)
            channel = rule.get("channel", "email")
            if channel in ("email", "both"):
                send_alert_email.delay(org_id, history_id, rule["id"])
            if channel in ("slack", "both") and rule.get("slack_webhook"):
                send_alert_slack.delay(history_id, rule["id"], rule["slack_webhook"])

            # 6. Publish WebSocket event
            asyncio.get_event_loop().run_until_complete(
                _publish_alert_ws(redis, org_id, rule, current_value)
            )

            # 7. Smart Alert diagnosis (Pro+ orgs only)
            try:
                from app.utils.supabase import get_supabase_client as _get_db
                _db = _get_db()
                org_res = _db.table("organizations").select("plan").eq("id", org_id).maybe_single().execute()
                if org_res.data and org_res.data.get("plan") in ("pro", "team"):
                    from app.workers.tasks_smart_alerts import diagnose_alert
                    diagnose_alert.delay(history_id, org_id)
            except Exception as _exc:
                logger.warning(f"[alerts] smart alert dispatch failed: {_exc}")

        return {"status": "ok", "rules_checked": len(relevant)}

    except Exception as exc:
        logger.error(f"[alerts.check_thresholds] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="alerts.check_all_thresholds", bind=True, max_retries=3)
def check_all_thresholds(self):
    """Periodic task: evaluate all active alert rules across all orgs."""
    try:
        from app.utils.supabase import get_supabase_client
        db = get_supabase_client()

        # Get distinct org_ids that have active alert rules
        result = db.table("alert_rules").select("organization_id").eq("is_active", True).execute()
        org_ids = list({r["organization_id"] for r in (result.data or [])})

        for org_id in org_ids:
            check_alert_thresholds.delay(org_id, None)

        return {"status": "ok", "orgs_scheduled": len(org_ids)}
    except Exception as exc:
        logger.error(f"[alerts.check_all_thresholds] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="alerts.send_email", bind=True, max_retries=5)
def send_alert_email(self, org_id: str, history_id: str, rule_id: str):
    """Send alert notification email via Brevo. Retry with exponential backoff."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.brevo import BrevoService

        db = get_supabase_client()

        # Load alert history
        history = db.table("alert_history").select("*").eq("id", history_id).maybe_single().execute()
        if not history.data:
            return {"status": "skipped", "reason": "history_not_found"}

        # Load rule
        rule = db.table("alert_rules").select("*").eq("id", rule_id).maybe_single().execute()
        if not rule.data:
            return {"status": "skipped", "reason": "rule_not_found"}

        # Load org email
        org = db.table("organizations").select("*").eq("id", org_id).maybe_single().execute()
        if not org.data:
            return {"status": "skipped", "reason": "org_not_found"}

        # Load user emails (owner/admin)
        users = db.table("users").select("email").eq("organization_id", org_id).in_("role", ["owner", "admin"]).execute()
        emails = [u["email"] for u in (users.data or [])]
        if not emails:
            return {"status": "skipped", "reason": "no_recipients"}

        h = history.data
        r = rule.data
        agent_name = "unknown"
        if h.get("agent_id"):
            agent_res = db.table("agents").select("name").eq("id", h["agent_id"]).maybe_single().execute()
            if agent_res.data:
                agent_name = agent_res.data["name"]

        brevo = BrevoService()
        for email in emails:
            brevo.send_alert_email(
                to_email=email,
                agent_name=agent_name,
                metric=h.get("metric", r.get("metric", "")),
                current_value=h.get("triggered_value", 0),
                threshold=h.get("threshold", r.get("threshold", 0)),
                smart_diagnosis=h.get("smart_diagnosis"),
                suggested_fix=h.get("suggested_fix"),
            )

        return {"status": "ok", "recipients": len(emails)}

    except Exception as exc:
        logger.error(f"[alerts.send_email] error: {exc}", exc_info=True)
        # Exponential backoff: 30s, 90s, 270s, 810s, 2430s (~40min)
        countdown = 30 * (3 ** self.request.retries)
        raise self.retry(exc=exc, countdown=min(countdown, 600))


@celery_app.task(name="alerts.send_slack", bind=True, max_retries=5)
def send_alert_slack(self, history_id: str, rule_id: str, webhook_url: str):
    """Send alert notification to Slack. Retry with exponential backoff."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.slack import SlackService

        db = get_supabase_client()
        history = db.table("alert_history").select("*").eq("id", history_id).maybe_single().execute()
        if not history.data:
            return {"status": "skipped", "reason": "history_not_found"}

        h = history.data
        agent_name = "unknown"
        if h.get("agent_id"):
            agent_res = db.table("agents").select("name").eq("id", h["agent_id"]).maybe_single().execute()
            if agent_res.data:
                agent_name = agent_res.data["name"]

        slack = SlackService()
        slack.send_alert(
            webhook_url=webhook_url,
            agent_name=agent_name,
            metric=h.get("metric", ""),
            current_value=h.get("triggered_value", 0),
            threshold=h.get("threshold", 0),
        )
        return {"status": "ok"}

    except Exception as exc:
        logger.error(f"[alerts.send_slack] error: {exc}", exc_info=True)
        countdown = 30 * (3 ** self.request.retries)
        raise self.retry(exc=exc, countdown=min(countdown, 600))


async def _publish_alert_ws(redis, org_id: str, rule: dict, triggered_value: float):
    """Publish alert_fired event to WebSocket channel."""
    import json
    try:
        channel = f"ws:{org_id}"
        payload = json.dumps({
            "type": "alert_fired",
            "data": {
                "alert_name": rule.get("name", ""),
                "metric": rule.get("metric", ""),
                "value": triggered_value,
                "threshold": rule.get("threshold", 0),
            },
        })
        await redis.publish(channel, payload)
    except Exception:
        pass
