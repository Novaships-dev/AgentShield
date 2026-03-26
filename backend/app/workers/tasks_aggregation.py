"""Celery aggregation tasks — hourly and daily rollups."""
from __future__ import annotations
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="aggregation.run_hourly", bind=True, max_retries=3)
def compute_hourly(self):
    """Aggregate events from the last 2 hours into aggregations_hourly."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.aggregation import AggregationService
        db = get_supabase_client()
        svc = AggregationService(db=db)
        count = svc.compute_hourly()
        logger.info(f"[aggregation.run_hourly] upserted {count} rows")
        return {"status": "ok", "rows": count}
    except Exception as exc:
        logger.error(f"[aggregation.run_hourly] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="aggregation.run_daily", bind=True, max_retries=3)
def compute_daily(self):
    """Aggregate yesterday's events into aggregations_daily."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.services.aggregation import AggregationService
        db = get_supabase_client()
        svc = AggregationService(db=db)
        count = svc.compute_daily()
        logger.info(f"[aggregation.run_daily] upserted {count} rows")
        return {"status": "ok", "rows": count}
    except Exception as exc:
        logger.error(f"[aggregation.run_daily] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=120)
