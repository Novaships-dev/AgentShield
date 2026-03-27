"""Celery tasks for anomaly detection."""
from __future__ import annotations
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

METRICS = ("cost_hourly", "requests_hourly", "error_rate_hourly")


@celery_app.task(name="anomaly.check_event", bind=True, max_retries=3)
def check_anomaly_event(
    self,
    org_id: str,
    agent_id: str,
    cost_usd: float,
    total_tokens: int,
    status: str,
):
    """Check each metric for anomaly after a new event is tracked."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.utils.redis import get_redis_client
        from app.services.anomaly import AnomalyService
        import asyncio

        db = get_supabase_client()
        redis = get_redis_client()
        svc = AnomalyService(db=db)

        anomalies_found = []
        for metric in METRICS:
            current_value = svc.get_current_metric_value(org_id, agent_id, metric)
            anomaly = svc.check_for_anomaly(org_id, agent_id, metric, current_value)

            if anomaly:
                logger.info(f"[anomaly] {metric} anomaly on agent {agent_id}: {anomaly['type']} z={anomaly['z_score']}")
                anomalies_found.append(anomaly)

                # Publish WebSocket event
                asyncio.get_event_loop().run_until_complete(
                    _publish_anomaly_ws(redis, org_id, agent_id, db, anomaly)
                )

                # Send email notification
                send_anomaly_email.delay(org_id, agent_id, anomaly)

        return {"status": "ok", "anomalies": len(anomalies_found)}

    except Exception as exc:
        logger.error(f"[anomaly.check_event] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="anomaly.update_all_baselines", bind=True, max_retries=3)
def update_all_baselines(self):
    """Scheduled hourly: update EMA baselines for all active orgs/agents."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.anomaly import AnomalyService

        db = get_supabase_client()
        svc = AnomalyService(db=db)

        # Get distinct org_ids with active agents
        result = db.table("agents").select("organization_id").eq("is_active", True).execute()
        org_ids = list({r["organization_id"] for r in (result.data or [])})

        total = 0
        for org_id in org_ids:
            count = svc.update_all_baselines_for_org(org_id)
            total += count

        logger.info(f"[anomaly.update_all_baselines] updated {total} baselines across {len(org_ids)} orgs")
        return {"status": "ok", "baselines_updated": total}

    except Exception as exc:
        logger.error(f"[anomaly.update_all_baselines] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="anomaly.send_email", bind=True, max_retries=5)
def send_anomaly_email(self, org_id: str, agent_id: str, anomaly: dict):
    """Send anomaly email notification via Brevo."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.brevo import BrevoService
        from datetime import datetime, timezone

        db = get_supabase_client()
        brevo = BrevoService()

        # Resolve agent name
        agent_name = agent_id
        agent_res = db.table("agents").select("name").eq("id", agent_id).maybe_single().execute()
        if agent_res.data:
            agent_name = agent_res.data["name"]

        # Get user emails
        users = db.table("users").select("email").eq("organization_id", org_id).in_("role", ["owner", "admin"]).execute()
        emails = [u["email"] for u in (users.data or [])]

        if not emails:
            return {"status": "skipped", "reason": "no_recipients"}

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        mean = anomaly.get("mean", 0)
        multiplier = anomaly.get("multiplier", 0)

        for email in emails:
            brevo.send_anomaly_email(
                to_email=email,
                agent_name=agent_name,
                metric=anomaly.get("metric", ""),
                current_value=anomaly.get("current_value", 0),
                mean=mean,
                stddev=anomaly.get("stddev", 0),
                multiplier=multiplier if multiplier > 0 else 1.0,
                timestamp=timestamp,
            )

        return {"status": "ok", "recipients": len(emails)}

    except Exception as exc:
        logger.error(f"[anomaly.send_email] error: {exc}", exc_info=True)
        countdown = 30 * (3 ** self.request.retries)
        raise self.retry(exc=exc, countdown=min(countdown, 600))


async def _publish_anomaly_ws(redis, org_id: str, agent_id: str, db, anomaly: dict):
    """Publish anomaly event to WebSocket channel."""
    import json
    try:
        # Resolve agent name
        agent_name = agent_id
        agent_res = db.table("agents").select("name").eq("id", agent_id).maybe_single().execute()
        if agent_res.data:
            agent_name = agent_res.data["name"]

        channel = f"ws:{org_id}"
        payload = json.dumps({
            "type": "anomaly",
            "data": {
                "agent": agent_name,
                "metric": anomaly.get("metric", ""),
                "type": anomaly.get("type", "spike"),
                "value": anomaly.get("current_value", 0),
                "normal": anomaly.get("mean", 0),
                "z_score": anomaly.get("z_score", 0),
            },
        })
        await redis.publish(channel, payload)
    except Exception:
        pass
