from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "agentshield",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.tasks_maintenance",
        "app.workers.tasks_aggregation",
        "app.workers.tasks_alerts",
        "app.workers.tasks_anomaly",
        "app.workers.tasks_forecast",
        "app.workers.tasks_guardrails",
        "app.workers.tasks_smart_alerts",
        "app.workers.tasks_recommendations",
        "app.workers.tasks_webhooks",
        "app.workers.tasks_reports",
    ],
)

# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]

# ---------------------------------------------------------------------------
# Timezone
# ---------------------------------------------------------------------------
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# ---------------------------------------------------------------------------
# Task routing
# ---------------------------------------------------------------------------
celery_app.conf.task_routes = {
    "alerts.*":        {"queue": "alerts"},
    "anomaly.*":       {"queue": "anomaly"},
    "aggregation.*":   {"queue": "aggregation"},
    "forecast.*":      {"queue": "forecast"},
    "reports.*":       {"queue": "reports"},
    "guardrails.*":    {"queue": "default"},
    "smart_alerts.*":  {"queue": "alerts"},
    "webhooks.*":      {"queue": "webhooks"},
    "maintenance.*":   {"queue": "default"},
    "recommendations.*": {"queue": "recommendations"},
}

celery_app.conf.task_default_queue = "default"

# ---------------------------------------------------------------------------
# Beat schedule
# ---------------------------------------------------------------------------
celery_app.conf.beat_schedule = {
    # Aggregations — every hour at :05
    "aggregate-hourly": {
        "task": "aggregation.run_hourly",
        "schedule": crontab(minute=5),
        "options": {"queue": "aggregation"},
    },
    # Aggregations — daily at 00:10 UTC
    "aggregate-daily": {
        "task": "aggregation.run_daily",
        "schedule": crontab(hour=0, minute=10),
        "options": {"queue": "aggregation"},
    },
    # Forecast recalculation — every hour at :15
    "recalculate-forecasts": {
        "task": "forecast.recalculate_all",
        "schedule": crontab(minute=15),
        "options": {"queue": "forecast"},
    },
    # Alert threshold check — every 5 minutes
    "check-alert-thresholds": {
        "task": "alerts.check_all_thresholds",
        "schedule": crontab(minute="*/5"),
        "options": {"queue": "alerts"},
    },
    # Anomaly baseline update — every hour at :30
    "update-anomaly-baselines": {
        "task": "anomaly.update_all_baselines",
        "schedule": crontab(minute=30),
        "options": {"queue": "anomaly"},
    },
    # Webhook retry — every 2 minutes
    "retry-failed-webhooks": {
        "task": "webhooks.retry_failed",
        "schedule": crontab(minute="*/2"),
        "options": {"queue": "webhooks"},
    },
    # Cleanup old events — daily at 03:00 UTC
    "cleanup-old-events": {
        "task": "maintenance.cleanup_old_events",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "default"},
    },
    # Cost Autopilot recommendations — every Monday at 03:00 UTC
    "generate-recommendations": {
        "task": "recommendations.generate_all",
        "schedule": crontab(day_of_week="monday", hour=3, minute=0),
        "options": {"queue": "recommendations"},
    },
    # Health check ping — every 10 minutes
    "celery-health-check": {
        "task": "maintenance.health_check",
        "schedule": crontab(minute="*/10"),
        "options": {"queue": "default"},
    },
}

# ---------------------------------------------------------------------------
# Worker settings
# ---------------------------------------------------------------------------
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.conf.task_acks_late = True
celery_app.conf.task_reject_on_worker_lost = True
celery_app.conf.task_track_started = True
