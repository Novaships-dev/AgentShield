from celery import shared_task


@shared_task(name="maintenance.health_check", bind=True, max_retries=0)
def celery_health_check(self) -> str:
    """Periodic heartbeat task to verify Celery is alive."""
    return "Celery is alive"


@shared_task(name="maintenance.cleanup_old_events", bind=True)
def cleanup_old_events(self) -> dict:
    """Remove events beyond the organization's history retention window.

    This is a stub — full implementation in Sprint 1.
    """
    return {"status": "ok", "deleted": 0}
