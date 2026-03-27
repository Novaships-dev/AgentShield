"""Celery tasks for Smart Alerts — Claude API diagnosis of triggered alerts."""
from __future__ import annotations
import json
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an AI cost optimization expert for AI agent systems.
Analyze the provided alert context and diagnose the probable cause of the cost anomaly.
Respond ONLY with valid JSON in this exact format:
{
  "diagnosis": "Brief explanation of what likely caused this alert (2-3 sentences)",
  "suggested_fix": "Specific actionable recommendation to fix the issue",
  "confidence": 0.85
}"""


@celery_app.task(name="smart_alerts.diagnose", bind=True, max_retries=2, default_retry_delay=30)
def diagnose_alert(self, alert_history_id: str, org_id: str):
    """Call Claude API to diagnose an alert, then update alert_history with the result."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.claude import call_claude
        import asyncio

        db = get_supabase_client()

        # 1. Load alert history + rule
        history = db.table("alert_history").select("*").eq("id", alert_history_id).maybe_single().execute()
        if not history.data:
            return {"status": "skipped", "reason": "history_not_found"}
        h = history.data

        rule_res = db.table("alert_rules").select("*").eq("id", h.get("alert_rule_id", "")).maybe_single().execute()
        rule = rule_res.data or {}

        # 2. Load last 20 events for context
        agent_id = h.get("agent_id") or rule.get("agent_id")
        recent_events = []
        if agent_id:
            events_res = (
                db.table("events")
                .select("cost_usd, total_tokens, model, status, tracked_at")
                .eq("agent_id", agent_id)
                .order("tracked_at", desc=True)
                .limit(20)
                .execute()
            )
            recent_events = events_res.data or []

        # 3. Build context
        agent_name = "unknown"
        if agent_id:
            agent_res = db.table("agents").select("name").eq("id", agent_id).maybe_single().execute()
            if agent_res.data:
                agent_name = agent_res.data["name"]

        context = {
            "alert_name": rule.get("name", "Unknown Alert"),
            "agent_name": agent_name,
            "metric": h.get("metric", ""),
            "triggered_value": h.get("triggered_value", 0),
            "threshold": h.get("threshold", rule.get("threshold", 0)),
            "recent_events_summary": {
                "count": len(recent_events),
                "avg_cost": sum(e.get("cost_usd") or 0 for e in recent_events) / max(1, len(recent_events)),
                "error_count": sum(1 for e in recent_events if e.get("status") == "error"),
                "models_used": list({e.get("model") for e in recent_events if e.get("model")}),
            },
        }
        user_msg = f"Alert context:\n{json.dumps(context, indent=2)}\n\nDiagnose the probable cause and suggest a fix."

        # 4. Call Claude API
        result = call_claude(SYSTEM_PROMPT, user_msg)
        diagnosis = result.get("diagnosis", "")
        suggested_fix = result.get("suggested_fix", "")

        # 5. Update alert_history with diagnosis
        db.table("alert_history").update({
            "smart_diagnosis": diagnosis,
            "suggested_fix": suggested_fix,
        }).eq("id", alert_history_id).execute()

        # 6. Publish WebSocket update
        import asyncio
        from app.utils.redis import get_redis_client
        redis = get_redis_client()
        asyncio.get_event_loop().run_until_complete(
            _publish_smart_alert_ws(redis, org_id, agent_name, diagnosis, alert_history_id)
        )

        logger.info(f"[smart_alerts] diagnosed alert {alert_history_id}: {diagnosis[:80]}")
        return {"status": "ok", "alert_history_id": alert_history_id}

    except Exception as exc:
        logger.error(f"[smart_alerts.diagnose] error: {exc}", exc_info=True)
        raise self.retry(exc=exc)


async def _publish_smart_alert_ws(redis, org_id: str, agent_name: str, diagnosis: str, history_id: str):
    try:
        channel = f"ws:{org_id}"
        payload = json.dumps({
            "type": "smart_alert",
            "data": {
                "history_id": history_id,
                "agent": agent_name,
                "diagnosis": diagnosis[:200],
            },
        })
        await redis.publish(channel, payload)
    except Exception:
        pass
