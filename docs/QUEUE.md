# QUEUE.md — Tasks Celery/Redis AgentShield

> Ce fichier définit TOUTES les tasks asynchrones du projet : leur rôle, leur config, leur scheduling, leur retry logic. Claude Code le lit avant de créer ou modifier une task Celery.
> Cohérent avec : ARCH.md (workers), DEPLOY.md (infrastructure), ENV.md (config Redis/Celery)
> Dernière mise à jour : mars 2026

---

## 1. ARCHITECTURE CELERY

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  FastAPI      │────▶│  Redis       │────▶│  Celery Worker(s)    │
│  (producer)   │     │  (broker)    │     │  (consumer)          │
│              │     │  DB 1        │     │                      │
│  Dispatch    │     │              │     │  tasks_alerts.py     │
│  tasks via   │     │              │     │  tasks_smart_alerts  │
│  .delay()    │     │              │     │  tasks_anomaly.py    │
│              │     │              │     │  tasks_aggregation   │
│              │     │              │     │  tasks_forecast.py   │
│              │     │              │     │  tasks_recommendations│
│              │     │              │     │  tasks_guardrails.py │
│              │     │              │     │  tasks_pii.py        │
│              │     │              │     │  tasks_reports.py    │
│              │     │              │     │  tasks_webhooks.py   │
│              │     │              │     │  tasks_maintenance   │
└──────────────┘     │              │     └──────────────────────┘
                     │              │
┌──────────────┐     │              │     ┌──────────────────────┐
│  Celery Beat │────▶│              │────▶│  Celery Worker(s)    │
│  (scheduler) │     │              │     │  (même pool)         │
│  1 instance  │     └──────────────┘     └──────────────────────┘
└──────────────┘

Redis DB allocation :
  DB 0 — Cache (API keys, pricing, analytics, guardrails, PII config)
  DB 1 — Celery broker (task queue)
  DB 2 — Celery results backend
  DB 3 — Pub/Sub WebSocket (channels ws:{org_id})
  DB 4 — Rate limiting counters
  DB 5 — Budget counters
```

---

## 2. CONFIGURATION CELERY

```python
# app/workers/celery_app.py

from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "agentshield",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,

    # Performance
    worker_concurrency=4,
    worker_prefetch_multiplier=2,
    worker_max_tasks_per_child=1000,

    # Reliability
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=300,           # Hard kill après 5 min
    task_soft_time_limit=240,      # SoftTimeLimitExceeded après 4 min

    # Routing
    task_routes={
        "alerts.*": {"queue": "alerts"},
        "smart_alerts.*": {"queue": "smart_alerts"},
        "anomaly.*": {"queue": "default"},
        "aggregation.*": {"queue": "default"},
        "forecast.*": {"queue": "default"},
        "recommendations.*": {"queue": "smart_alerts"},
        "guardrails.*": {"queue": "default"},
        "pii.*": {"queue": "default"},
        "reports.*": {"queue": "reports"},
        "webhooks.*": {"queue": "webhooks"},
        "maintenance.*": {"queue": "default"},
    },

    # Retry defaults
    task_default_retry_delay=60,
    task_max_retries=3,

    # Results
    result_expires=3600,           # Résultats expirés après 1h
)

# Auto-discover tasks
celery_app.autodiscover_tasks([
    "app.workers.tasks_alerts",
    "app.workers.tasks_smart_alerts",
    "app.workers.tasks_anomaly",
    "app.workers.tasks_aggregation",
    "app.workers.tasks_forecast",
    "app.workers.tasks_recommendations",
    "app.workers.tasks_guardrails",
    "app.workers.tasks_pii",
    "app.workers.tasks_reports",
    "app.workers.tasks_webhooks",
    "app.workers.tasks_maintenance",
])
```

---

## 3. CELERY BEAT — TASKS SCHEDULÉES

```python
# Dans celery_app.py

celery_app.conf.beat_schedule = {
    # ── Agrégation ────────────────────────────────────
    "aggregate-hourly": {
        "task": "aggregation.compute_hourly",
        "schedule": crontab(minute="*/5"),          # Toutes les 5 min
        "options": {"queue": "default"},
    },
    "aggregate-daily": {
        "task": "aggregation.compute_daily",
        "schedule": crontab(minute=5, hour=0),      # Chaque jour à 00:05 UTC
        "options": {"queue": "default"},
    },

    # ── Forecast ──────────────────────────────────────
    "recalculate-forecasts": {
        "task": "forecast.recalculate_all",
        "schedule": crontab(minute=0),              # Toutes les heures
        "options": {"queue": "default"},
    },

    # ── Anomaly baselines ─────────────────────────────
    "update-anomaly-baselines": {
        "task": "anomaly.update_baselines",
        "schedule": crontab(minute=30),             # Toutes les heures à :30
        "options": {"queue": "default"},
    },

    # ── Cost Autopilot ────────────────────────────────
    "generate-recommendations": {
        "task": "recommendations.generate_all",
        "schedule": crontab(minute=0, hour=3, day_of_week=1),  # Lundi 3h UTC
        "options": {"queue": "smart_alerts"},
    },

    # ── Maintenance ───────────────────────────────────
    "cleanup-old-events": {
        "task": "maintenance.cleanup_expired_data",
        "schedule": crontab(minute=0, hour=2),      # Chaque jour à 2h UTC
        "options": {"queue": "default"},
    },
    "sync-pricing-table": {
        "task": "maintenance.sync_pricing",
        "schedule": crontab(minute=0, hour=6),      # Chaque jour à 6h UTC
        "options": {"queue": "default"},
    },
    "cleanup-expired-shares": {
        "task": "maintenance.cleanup_expired_shares",
        "schedule": crontab(minute=0, hour=4),      # Chaque jour à 4h UTC
        "options": {"queue": "default"},
    },
    "reset-budget-counters-daily": {
        "task": "maintenance.reset_budget_counters",
        "schedule": crontab(minute=0, hour=0),      # Minuit UTC
        "args": ["daily"],
        "options": {"queue": "default"},
    },
    "reset-budget-counters-weekly": {
        "task": "maintenance.reset_budget_counters",
        "schedule": crontab(minute=0, hour=0, day_of_week=1),  # Lundi minuit
        "args": ["weekly"],
        "options": {"queue": "default"},
    },
    "reset-budget-counters-monthly": {
        "task": "maintenance.reset_budget_counters",
        "schedule": crontab(minute=0, hour=0, day_of_month=1),  # 1er du mois
        "args": ["monthly"],
        "options": {"queue": "default"},
    },
}
```

---

## 4. CATALOGUE DES TASKS

### 4.1 — Alert tasks

```python
# app/workers/tasks_alerts.py

@shared_task(name="alerts.check_thresholds", bind=True, max_retries=3)
def check_alert_thresholds(self, organization_id: str, agent_id: str) -> None:
    """
    Triggered: après chaque POST /v1/track
    Rôle: vérifier toutes les alert rules actives pour cet org/agent
    Durée max: 10s
    Retry: 3x avec backoff 60s
    """

@shared_task(name="alerts.send_email", bind=True, max_retries=5)
def send_alert_email(self, alert_history_id: str) -> None:
    """
    Triggered: quand une alerte est déclenchée (channel=email ou both)
    Rôle: envoyer l'email via Brevo API
    Durée max: 15s
    Retry: 5x avec backoff exponentiel (30s, 60s, 120s, 300s, 600s)
    """

@shared_task(name="alerts.send_slack", bind=True, max_retries=5)
def send_alert_slack(self, alert_history_id: str) -> None:
    """
    Triggered: quand une alerte est déclenchée (channel=slack ou both)
    Rôle: envoyer la notification via Slack webhook
    Durée max: 10s
    Retry: 5x avec backoff exponentiel
    """
```

### 4.2 — Smart Alert tasks

```python
# app/workers/tasks_smart_alerts.py

@shared_task(name="smart_alerts.diagnose", bind=True, max_retries=2)
def diagnose_alert(self, alert_history_id: str) -> None:
    """
    Triggered: après chaque alerte (plans Pro+ uniquement)
    Rôle: appeler Claude API pour diagnostiquer la cause et suggérer un fix
    Durée max: 30s (Claude API peut être lent)
    Retry: 2x avec backoff 30s
    Result: met à jour alert_history.smart_diagnosis et alert_history.suggested_fix
    Note: la notification basique part AVANT le diagnostic — le diagnostic est ajouté après
    """
```

### 4.3 — Anomaly tasks

```python
# app/workers/tasks_anomaly.py

@shared_task(name="anomaly.check_event", bind=True, max_retries=3)
def check_anomaly(self, organization_id: str, agent_id: str, event_data: dict) -> None:
    """
    Triggered: après chaque POST /v1/track
    Rôle: comparer l'event au baseline (z-score), déclencher alerte si anomalie
    Durée max: 5s
    Retry: 3x avec backoff 30s
    """

@shared_task(name="anomaly.update_baselines")
def update_baselines() -> None:
    """
    Scheduled: toutes les heures à :30 (Beat)
    Rôle: recalculer les baselines (mean + stddev) pour chaque agent/heure/jour
    Durée max: 60s
    Pas de retry (scheduled, sera relancée à la prochaine heure)
    """
```

### 4.4 — Aggregation tasks

```python
# app/workers/tasks_aggregation.py

@shared_task(name="aggregation.compute_hourly")
def compute_hourly() -> None:
    """
    Scheduled: toutes les 5 minutes (Beat)
    Rôle: agréger les events de la dernière heure dans aggregations_hourly
    Durée max: 30s
    UPSERT pour idempotence (safe to re-run)
    """

@shared_task(name="aggregation.compute_daily")
def compute_daily() -> None:
    """
    Scheduled: chaque jour à 00:05 UTC (Beat)
    Rôle: agréger les events du jour précédent dans aggregations_daily
    Durée max: 60s
    UPSERT pour idempotence
    """
```

### 4.5 — Forecast tasks

```python
# app/workers/tasks_forecast.py

@shared_task(name="forecast.recalculate_all")
def recalculate_all() -> None:
    """
    Scheduled: toutes les heures (Beat)
    Rôle: recalculer les projections EOM pour chaque org active
    Durée max: 120s (itère sur toutes les orgs)
    Résultat stocké dans Redis (forecast:{org_id}, TTL 1h)
    """

@shared_task(name="forecast.recalculate_org", bind=True, max_retries=2)
def recalculate_org(self, organization_id: str) -> None:
    """
    Triggered: manuellement ou par recalculate_all
    Rôle: recalculer la projection pour une seule org
    Durée max: 5s
    """
```

### 4.6 — Recommendations tasks (Cost Autopilot)

```python
# app/workers/tasks_recommendations.py

@shared_task(name="recommendations.generate_all")
def generate_all() -> None:
    """
    Scheduled: lundi 3h UTC (Beat) — hebdomadaire
    Rôle: générer les recommandations de modèle pour chaque org Pro+
    Durée max: 300s (itère sur les orgs, appelle Claude API pour chaque)
    """

@shared_task(name="recommendations.generate_org", bind=True, max_retries=2)
def generate_org(self, organization_id: str) -> None:
    """
    Triggered: par generate_all ou manuellement
    Rôle: analyser les events des 7 derniers jours et appeler Claude API
    Durée max: 30s par org
    Résultat stocké dans Redis (recommendations:{org_id}, TTL 7j)
    """
```

### 4.7 — Guardrail tasks

```python
# app/workers/tasks_guardrails.py

@shared_task(name="guardrails.log_violation", bind=True, max_retries=3)
def log_violation(self, violation_data: dict) -> None:
    """
    Triggered: après détection d'une violation dans le middleware (async logging)
    Rôle: insérer dans guardrail_violations + incrémenter counters + alerte si configurée
    Durée max: 5s
    Retry: 3x avec backoff 30s
    Note: la détection est SYNC (middleware), le logging est ASYNC (cette task)
    """
```

### 4.8 — PII tasks

```python
# app/workers/tasks_pii.py

@shared_task(name="pii.scan_batch")
def scan_batch(event_ids: list[str]) -> None:
    """
    Triggered: optionnel — pour scanner en batch des events existants
    Rôle: appliquer la PII redaction sur des events déjà stockés (si config change)
    Durée max: 60s
    Note: la redaction en temps réel est SYNC (middleware). Cette task est pour le rétroactif.
    """
```

### 4.9 — Report tasks

```python
# app/workers/tasks_reports.py

@shared_task(name="reports.generate_pdf", bind=True, max_retries=2)
def generate_pdf(self, organization_id: str, params: dict) -> str:
    """
    Triggered: quand un user demande un rapport PDF
    Rôle: générer le PDF avec les données de la période demandée
    Durée max: 30s
    Retry: 2x avec backoff 60s
    Return: URL du PDF stocké temporairement (7 jours)
    Notification: WebSocket event "report_ready" + email
    """
```

### 4.10 — Webhook tasks

```python
# app/workers/tasks_webhooks.py

@shared_task(name="webhooks.dispatch", bind=True, max_retries=5)
def dispatch_webhook(self, delivery_id: str) -> None:
    """
    Triggered: quand un event webhook est créé
    Rôle: envoyer le payload HTTP signé au endpoint du client
    Durée max: 15s (timeout requête : 10s)
    Retry: 5x avec backoff (immédiat, 1min, 5min, 30min, 2h)
    """

@shared_task(name="webhooks.dispatch_batch")
def dispatch_batch(organization_id: str, event_type: str, payloads: list[dict]) -> None:
    """
    Triggered: pour les webhooks event.tracked (batching)
    Rôle: grouper les events et envoyer en un seul appel (max 1 envoi/10s)
    Durée max: 15s
    """
```

### 4.11 — Maintenance tasks

```python
# app/workers/tasks_maintenance.py

@shared_task(name="maintenance.cleanup_expired_data")
def cleanup_expired_data() -> None:
    """
    Scheduled: chaque jour à 2h UTC (Beat)
    Rôle: supprimer les events/sessions au-delà de la période d'historique du plan
    - Free : > 7 jours + 30 jours de grâce = > 37 jours
    - Starter : > 30 jours + 30 jours de grâce = > 60 jours
    - Pro : > 90 jours + 30 jours de grâce = > 120 jours
    - Team : > 365 jours + 30 jours de grâce = > 395 jours
    Durée max: 120s
    Note: 30 jours de grâce pour laisser le temps de upgrader
    """

@shared_task(name="maintenance.sync_pricing")
def sync_pricing() -> None:
    """
    Scheduled: chaque jour à 6h UTC (Beat)
    Rôle: mettre à jour la table model_pricing et le cache Redis
    Durée max: 30s
    Source: table model_pricing en DB (mise à jour manuellement quand un provider change ses prix)
    """

@shared_task(name="maintenance.cleanup_expired_shares")
def cleanup_expired_shares() -> None:
    """
    Scheduled: chaque jour à 4h UTC (Beat)
    Rôle: désactiver les share links expirés
    Durée max: 10s
    """

@shared_task(name="maintenance.reset_budget_counters")
def reset_budget_counters(period: str) -> None:
    """
    Scheduled: minuit (daily), lundi minuit (weekly), 1er du mois (monthly)
    Rôle: remettre à zéro les budget counters Redis pour la période
    Durée max: 30s
    Synchronise aussi le counter Redis avec la valeur DB
    Défreezer les agents dont le budget est reset
    """
```

---

## 5. QUEUES

```
Queues Celery :

| Queue         | Workers | Concurrency | Rôle                                    |
|---------------|---------|-------------|-----------------------------------------|
| default       | 1       | 4           | Agrégation, anomaly, forecast, guardrails, PII, maintenance |
| alerts        | 1       | 4           | Alertes email/Slack (prioritaire)       |
| smart_alerts  | 1       | 2           | Claude API calls (lents, limités)       |
| reports       | 1       | 1           | Génération PDF (CPU-intensive)          |
| webhooks      | 1       | 4           | Dispatch webhooks sortants              |
```

**En production au lancement** : un seul worker avec 4 concurrency qui consomme TOUTES les queues. On sépare les queues quand on scale.

```bash
# Dev / lancement — un seul worker, toutes les queues
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4

# Après scaling — workers dédiés
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4 -Q default,alerts
celery -A app.workers.celery_app worker --loglevel=info --concurrency=2 -Q smart_alerts,reports
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4 -Q webhooks
```

---

## 6. RETRY STRATEGY

### Par catégorie de task

| Catégorie | Max retries | Backoff | Pourquoi |
|-----------|-------------|---------|----------|
| Alertes email/Slack | 5 | Exponentiel (30s → 600s) | Les services email/Slack peuvent avoir des pannes temporaires |
| Smart Alerts (Claude API) | 2 | Fixe 30s | Claude API est rarement down mais peut timeout |
| Anomaly check | 3 | Fixe 30s | Critique mais pas bloquant si raté une fois |
| Agrégation | 0 | — | Scheduled, sera relancée au prochain cycle |
| Forecast | 0 | — | Scheduled, sera relancée au prochain cycle |
| Webhooks sortants | 5 | Escalade (0s → 1m → 5m → 30m → 2h) | Le endpoint client peut être temporairement down |
| Reports PDF | 2 | Fixe 60s | Peut échouer si les données sont volumineuses |
| Maintenance | 0 | — | Scheduled, safe to skip une fois |

### Implémentation retry

```python
@shared_task(bind=True, max_retries=5)
def send_alert_email(self, alert_history_id: str) -> None:
    try:
        # Logic
        pass
    except BrevAPIError as exc:
        # Backoff exponentiel : 30s, 60s, 120s, 300s, 600s
        backoff = min(30 * (2 ** self.request.retries), 600)
        raise self.retry(exc=exc, countdown=backoff)
    except Exception as exc:
        # Erreur inattendue — log dans Sentry, retry quand même
        sentry_sdk.capture_exception(exc)
        raise self.retry(exc=exc, countdown=60)
```

---

## 7. DEAD LETTER ET MONITORING

### Tasks échouées (après tous les retries)

```python
# app/workers/celery_app.py

from celery.signals import task_failure

@task_failure.connect
def handle_task_failure(sender, task_id, exception, args, kwargs, traceback, **kw):
    """Log failed tasks to Sentry and DB."""
    sentry_sdk.capture_exception(exception)

    # Pour les webhooks : marquer comme failed dans webhook_deliveries
    if sender.name.startswith("webhooks."):
        mark_webhook_delivery_failed(args, exception)

    # Pour les alertes : log mais pas de retry (le user sera notifié au prochain trigger)
    if sender.name.startswith("alerts."):
        log_alert_delivery_failure(args, exception)
```

### Monitoring Celery

```python
# Health check pour Celery (appelé par le health endpoint)

def check_celery_health() -> dict:
    """Check if Celery workers are alive."""
    inspector = celery_app.control.inspect()
    active = inspector.active()
    if not active:
        return {"celery": "error", "message": "No active workers"}
    return {
        "celery": "ok",
        "workers": len(active),
        "active_tasks": sum(len(tasks) for tasks in active.values()),
    }
```

### Métriques à surveiller

```
- Queue depth par queue (> 100 = warning, > 1000 = critical)
- Task success rate (< 95% = investigate)
- Task duration p95 (> soft_time_limit = investigate)
- Worker memory usage (> 80% = restart worker)
- Redis memory (> 80% = upgrade plan)
```

---

## 8. FLOW COMPLET — POST /v1/track

```
SDK envoie POST /v1/track
    │
    ├── [SYNC] Middleware auth          → vérifie API key
    ├── [SYNC] Middleware budget_check  → vérifie budget cap (Redis)
    ├── [SYNC] Middleware guardrail     → évalue les règles (Redis cache)
    ├── [SYNC] Middleware pii           → redacte les PII (regex)
    ├── [SYNC] Middleware plan_limits   → vérifie les limites
    ├── [SYNC] Insert event            → Supabase
    ├── [SYNC] Update session          → Supabase UPSERT
    ├── [SYNC] Update budget counter   → Redis INCRBYFLOAT
    ├── [SYNC] Publish WebSocket       → Redis Pub/Sub
    │
    ├── [ASYNC] check_alert_thresholds.delay()
    ├── [ASYNC] check_anomaly.delay()
    ├── [ASYNC] log_violation.delay()          (si violation détectée)
    ├── [ASYNC] dispatch_webhook.delay()       (si webhooks configurés)
    │
    └── Return 201 + response
        Total latence sync : < 50ms p95
```

---

## 9. REDIS — DÉTAIL DES USAGES

```
DB 0 — CACHE
  pricing:{provider}:{model}           → JSON pricing     TTL 1h
  apikey:{key_hash}                    → JSON org data     TTL 5min
  analytics:{org_id}:{query_hash}      → JSON response     TTL 30s
  guardrails:{org_id}                  → JSON rules list   TTL 5min
  pii:{org_id}                         → JSON pii config   TTL 5min
  forecast:{org_id}                    → JSON forecast      TTL 1h
  recommendations:{org_id}             → JSON recommendations TTL 7d
  session:{org_id}:{session_id}        → JSON session state TTL 1h

DB 1 — CELERY BROKER
  (géré automatiquement par Celery)

DB 2 — CELERY RESULTS
  (géré automatiquement par Celery)

DB 3 — WEBSOCKET PUB/SUB
  Channel ws:{org_id}                  → Messages temps réel

DB 4 — RATE LIMITING
  ratelimit:{org_id}:{endpoint}:{window} → INT counter   TTL window

DB 5 — BUDGET COUNTERS
  budget:{org_id}:{agent_id}:daily     → FLOAT usage     TTL 24h
  budget:{org_id}:{agent_id}:weekly    → FLOAT usage     TTL 7d
  budget:{org_id}:{agent_id}:monthly   → FLOAT usage     TTL 31d
  budget:{org_id}:global:daily         → FLOAT usage     TTL 24h
  budget:{org_id}:global:weekly        → FLOAT usage     TTL 7d
  budget:{org_id}:global:monthly       → FLOAT usage     TTL 31d
```

---

## 10. CHECKLIST AVANT D'AJOUTER UNE TASK

```
□ La task a un name unique et descriptif (namespace.action)
□ La task est dans le bon fichier workers/tasks_{category}.py
□ La task a bind=True si elle utilise self.retry()
□ max_retries et retry backoff sont définis
□ La task est idempotente (safe to re-run avec les mêmes arguments)
□ La task a un timeout (task_time_limit ou soft_time_limit)
□ La task est routée vers la bonne queue
□ Si scheduled → ajoutée dans beat_schedule
□ Les erreurs sont catchées et loggées dans Sentry
□ Les erreurs non-récupérables ne font PAS de retry (raise sans self.retry)
□ La task est documentée dans ce fichier (QUEUE.md)
□ La task a un test dans tests/
```

---

> **Règle :** Tout ce qui prend > 100ms et qui n'est pas critique pour la réponse HTTP → task Celery.
> Tout ce qui doit se répéter périodiquement → Celery Beat.
> Les tasks sont le système nerveux d'AgentShield — elles doivent être fiables et monitored.
