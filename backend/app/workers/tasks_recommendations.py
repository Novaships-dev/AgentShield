"""Celery tasks for Cost Autopilot recommendations."""
from __future__ import annotations
import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="recommendations.generate_all", bind=True, max_retries=2)
def generate_all(self):
    """Scheduled weekly (Monday 3AM UTC). Generate recommendations for Pro+ orgs."""
    try:
        from app.utils.supabase import get_supabase_client
        db = get_supabase_client()

        # Get Pro+ orgs with sufficient recent activity
        orgs = db.table("organizations").select("id, plan").in_("plan", ["pro", "team"]).execute()
        org_ids = [o["id"] for o in (orgs.data or [])]

        scheduled = 0
        for org_id in org_ids:
            # Check they have > 50 events in last 7 days
            from datetime import datetime, timezone, timedelta
            since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            cnt = db.table("events").select("id", count="exact").eq("organization_id", org_id).gte("tracked_at", since).execute()
            if (cnt.count or 0) >= 50:
                generate_org.delay(org_id)
                scheduled += 1

        logger.info(f"[recommendations] scheduled {scheduled}/{len(org_ids)} orgs")
        return {"status": "ok", "scheduled": scheduled}
    except Exception as exc:
        logger.error(f"[recommendations.generate_all] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=300)


@celery_app.task(name="recommendations.generate_org", bind=True, max_retries=2)
def generate_org(self, organization_id: str):
    """Generate Cost Autopilot recommendations for one org via Claude API."""
    try:
        from app.utils.supabase import get_supabase_client
        from app.utils.redis import get_redis_client
        from app.services.recommendations import RecommendationService

        db = get_supabase_client()
        redis = get_redis_client()
        svc = RecommendationService(db=db, redis=redis)
        recs = svc.compute_and_cache_sync(organization_id)
        logger.info(f"[recommendations] generated {len(recs)} recs for org {organization_id}")
        return {"status": "ok", "recommendations": len(recs)}
    except Exception as exc:
        logger.error(f"[recommendations.generate_org] error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=120)
