# SKILL-CELERY.md — Comment coder les tasks Celery dans AgentShield

> Lire AVANT de créer ou modifier une task async.
> Réfs : QUEUE.md (catalogue complet), DEPLOY.md (workers), ENV.md (config)

---

## TEMPLATE DE TASK

```python
# app/workers/tasks_{category}.py

from celery import shared_task
import sentry_sdk

@shared_task(
    name="{category}.{action}",      # Nom unique et descriptif
    bind=True,                        # Accès à self (pour retry)
    max_retries=3,                    # Nombre max de retries
    default_retry_delay=60,           # Delay entre retries (secondes)
    acks_late=True,                   # Ack après exécution (pas avant)
    time_limit=300,                   # Hard kill après 5 min
    soft_time_limit=240,              # SoftTimeLimitExceeded après 4 min
)
def my_task(self, arg1: str, arg2: dict) -> None:
    """Docstring: quand, pourquoi, durée max."""
    try:
        # Logic
        pass
    except SoftTimeLimitExceeded:
        # Cleanup avant le hard kill
        sentry_sdk.capture_message(f"Task {self.name} soft timeout")
    except RecoverableError as exc:
        # Retry
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    except Exception as exc:
        # Erreur inattendue — log et ne PAS retry
        sentry_sdk.capture_exception(exc)
        raise  # Celery marque la task comme failed
```

## DISPATCH DEPUIS LE CODE

```python
# Async (non-blocking) — PRÉFÉRÉ
my_task.delay(arg1, arg2)

# Async avec options
my_task.apply_async(
    args=[arg1, arg2],
    countdown=10,           # Délai avant exécution (secondes)
    queue="alerts",         # Queue spécifique
    expires=3600,           # Expire si pas exécutée dans 1h
)

# Sync (tests uniquement — CELERY_TASK_ALWAYS_EAGER=true)
result = my_task(arg1, arg2)
```

## QUEUES

```
default       → aggregation, anomaly, forecast, guardrails, PII, maintenance
alerts        → alertes email/Slack (prioritaire)
smart_alerts  → Claude API calls (lents)
reports       → PDF generation (CPU-intensive)
webhooks      → dispatch webhooks sortants

Au lancement : 1 worker consomme toutes les queues.
Après scaling : workers dédiés par queue.
```

## CELERY BEAT (tasks schedulées)

```python
# Dans celery_app.py — JAMAIS dans un fichier task

celery_app.conf.beat_schedule = {
    "nom-unique": {
        "task": "category.action",
        "schedule": crontab(minute="*/5"),  # ou timedelta(seconds=30)
        "args": [],
        "options": {"queue": "default"},
    },
}

# RÈGLE : Beat tourne sur EXACTEMENT 1 instance.
# Si 2 instances Beat → les tasks sont envoyées en double.
```

## RETRY STRATEGY

```
Services internes (DB, Redis) : 3 retries, backoff fixe 60s
Services externes (Brevo, Slack) : 5 retries, backoff exponentiel
Claude API : 2 retries, backoff 30s (timeout fréquent)
Tasks schedulées : 0 retries (re-scheduled au prochain cycle)
Webhooks sortants : 5 retries, escalade (0, 60, 300, 1800, 7200)
```

## IDEMPOTENCE

```python
# CHAQUE task doit être idempotente (safe to re-run)

# ✅ Idempotent
@shared_task
def compute_daily_aggregation(org_id, date):
    # UPSERT — si déjà calculé, on écrase avec les mêmes valeurs
    db.from_("aggregations_daily").upsert({...}, on_conflict="org,agent,provider,model,day").execute()

# ❌ Non idempotent
@shared_task
def increment_counter(org_id):
    # Si la task est retried → le counter est incrémenté 2 fois
    db.rpc("increment_counter", {"org_id": org_id}).execute()
```

## MONITORING

```python
# Failure handler global
from celery.signals import task_failure

@task_failure.connect
def on_task_failure(sender, task_id, exception, **kwargs):
    sentry_sdk.capture_exception(exception)

# Health check
def celery_health():
    inspector = celery_app.control.inspect(timeout=3)
    active = inspector.active()
    return {"workers": len(active) if active else 0}
```

## RÈGLES

```
1. Jamais de task > 5 minutes (hard limit)
2. Jamais de task qui modifie et retry sans idempotence
3. Jamais de task sans sentry logging des erreurs
4. Jamais de logique métier dans le dispatch (le dispatch est fire-and-forget)
5. Toujours un name explicite (pas le nom auto-généré)
6. Toujours acks_late=True (reliability)
7. Les arguments de task sont sérialisables JSON (pas d'objets Python complexes)
8. Un fichier par catégorie de tasks : tasks_alerts.py, tasks_anomaly.py, etc.
```
