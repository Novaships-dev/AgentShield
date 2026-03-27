"""Celery tasks for forecast recalculation."""
from __future__ import annotations
import json
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="forecast.recalculate_all", bind=True, max_retries=3)
def recalculate_all(self):
    """Scheduled hourly: recompute EOM forecast for all active orgs and cache in Redis."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.utils.redis import get_redis_client
        from app.services.forecast import ForecastService

        db = get_supabase_client()
        redis = get_redis_client()

        # Get all orgs that have events this month
        result = db.table("organizations").select("id").execute()
        org_ids = [r["id"] for r in (result.data or [])]

        svc = ForecastService(db=db, redis=redis)
        count = 0
        for org_id in org_ids:
            try:
                forecast = svc.compute_and_cache(org_id)
                # Write to Redis synchronously (sync redis client for Celery)
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    _cache_forecast(redis, org_id, forecast)
                )
                count += 1
            except Exception as exc:
                logger.warning(f"[forecast] failed for org {org_id}: {exc}")

        logger.info(f"[forecast.recalculate_all] refreshed {count}/{len(org_ids)} orgs")
        return {"status": "ok", "orgs_refreshed": count}

    except Exception as exc:
        logger.error(f"[forecast.recalculate_all] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(name="forecast.recalculate_org", bind=True, max_retries=3)
def recalculate_org(self, org_id: str):
    """Recalculate forecast for a single org on demand."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.utils.redis import get_redis_client
        from app.services.forecast import ForecastService
        import asyncio

        db = get_supabase_client()
        redis = get_redis_client()
        svc = ForecastService(db=db, redis=redis)
        forecast = svc.compute_and_cache(org_id)
        asyncio.get_event_loop().run_until_complete(_cache_forecast(redis, org_id, forecast))

        return {"status": "ok", "org_id": org_id}
    except Exception as exc:
        logger.error(f"[forecast.recalculate_org] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


async def _cache_forecast(redis, org_id: str, forecast: dict):
    """Write forecast to Redis with 1h TTL."""
    try:
        await redis.setex(f"forecast:{org_id}", 3600, json.dumps(forecast))
    except Exception:
        pass
