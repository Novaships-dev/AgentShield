"""Celery tasks for async PDF report generation."""
from __future__ import annotations
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_REPORTS_PER_MONTH = 10


@celery_app.task(name="reports.generate_pdf", bind=True, max_retries=2, time_limit=60)
def generate_pdf(self, report_id: str, organization_id: str, period_start: str, period_end: str) -> dict:
    """Generate a PDF report, store it, update DB, notify via WebSocket."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.utils.redis import get_redis_client
        db = get_supabase_client()

        # Load org
        org = db.table("organizations").select("name").eq("id", organization_id).maybe_single().execute()
        org_name = (org.data or {}).get("name", "Organization")

        from app.services.pdf import generate_report
        filepath = generate_report(
            org_id=organization_id,
            org_name=org_name,
            period_start=period_start,
            period_end=period_end,
            report_id=report_id,
            db=db,
        )

        import os
        file_size_kb = os.path.getsize(filepath) // 1024

        # Update DB record
        download_url = f"/v1/reports/{report_id}/download"
        db.table("reports").update({
            "status": "ready",
            "file_path": filepath,
            "file_size_kb": file_size_kb,
            "download_url": download_url,
        }).eq("id", report_id).execute()

        # Notify via WebSocket
        try:
            import asyncio
            redis = get_redis_client()
            import json
            msg = json.dumps({"type": "report_ready", "report_id": report_id})
            loop = asyncio.get_event_loop()
            loop.run_until_complete(redis.publish(f"ws:{organization_id}", msg))
        except Exception:
            pass

        # Audit log
        try:
            db.table("audit_log").insert({
                "organization_id": organization_id,
                "user_id": None,
                "action": "report.generated",
                "resource_type": "report",
                "resource_id": report_id,
                "details": {"period_start": period_start, "period_end": period_end, "size_kb": file_size_kb},
                "ip_address": None,
            }).execute()
        except Exception:
            pass

        logger.info(f"[reports] generated {filepath} ({file_size_kb}KB) for org {organization_id}")
        return {"status": "ready", "report_id": report_id, "size_kb": file_size_kb}

    except Exception as exc:
        logger.error(f"[reports] generation failed for {report_id}: {exc}", exc_info=True)
        try:
            from app.utils.supabase import get_supabase_client
            db = get_supabase_client()
            db.table("reports").update({"status": "failed"}).eq("id", report_id).execute()
        except Exception:
            pass
        raise self.retry(exc=exc, countdown=120)
