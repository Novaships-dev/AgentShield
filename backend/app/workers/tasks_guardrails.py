"""Celery tasks for guardrail violation logging."""
from __future__ import annotations
import logging
import uuid
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="guardrails.log_violation", bind=True, max_retries=3)
def log_violation(self, violations: list[dict], agent_id: str | None = None, session_id: str | None = None):
    """Log guardrail violations asynchronously. Insert into guardrail_violations table."""
    try:
        from app.utils.supabase import get_supabase_client
        from datetime import datetime, timezone

        db = get_supabase_client()
        now = datetime.now(timezone.utc).isoformat()

        rows = []
        for v in violations:
            rows.append({
                "id": str(uuid.uuid4()),
                "rule_id": v.get("rule_id"),
                "agent_id": agent_id,
                "session_id": session_id,
                "matched_content": v.get("matched_content", ""),
                "action_taken": v.get("action", "log"),
                "created_at": now,
            })

        if rows:
            db.table("guardrail_violations").insert(rows).execute()

        return {"status": "ok", "logged": len(rows)}

    except Exception as exc:
        logger.error(f"[guardrails.log_violation] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=30)
