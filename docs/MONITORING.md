# MONITORING.md — Alertes & Runbooks AgentShield

> Ce fichier définit comment monitorer AgentShield en production : quoi surveiller, quand alerter, et comment réagir. Claude Code le lit avant de toucher au monitoring, aux health checks, ou à la gestion d'incidents.
> Cohérent avec : DEPLOY.md (infrastructure), INTEGRATIONS.md (Sentry), QUEUE.md (Celery)
> Dernière mise à jour : mars 2026

---

## 1. STACK MONITORING

```
┌──────────────────────────────────────────────────┐
│                 MONITORING STACK                  │
│                                                  │
│  Sentry        → Errors + performance tracing    │
│  Railway logs  → Application logs (stdout/stderr)│
│  Redis INFO    → Cache/queue health              │
│  Supabase      → DB metrics (dashboard natif)    │
│  /health       → Health check endpoint           │
│  Plausible     → User-facing metrics             │
│  Internal      → Business metrics (ANALYTICS.md) │
│  UptimeRobot   → Uptime externe (gratuit)        │
└──────────────────────────────────────────────────┘
```

---

## 2. HEALTH CHECK ENDPOINT

### GET /health (pas d'auth)

```python
# app/main.py

@app.get("/health")
async def health_check():
    checks = {
        "status": "ok",
        "version": settings.app_version,
        "environment": settings.app_env,
        "timestamp": datetime.utcnow().isoformat(),
        "services": {},
    }

    # Redis
    try:
        await redis.ping()
        checks["services"]["redis"] = {"status": "ok", "latency_ms": await measure_redis_ping()}
    except Exception as e:
        checks["services"]["redis"] = {"status": "error", "error": str(e)[:100]}
        checks["status"] = "degraded"

    # Supabase
    try:
        start = time.time()
        await db.from_("organizations").select("id").limit(1).execute()
        latency = int((time.time() - start) * 1000)
        checks["services"]["database"] = {"status": "ok", "latency_ms": latency}
    except Exception as e:
        checks["services"]["database"] = {"status": "error", "error": str(e)[:100]}
        checks["status"] = "degraded"

    # Celery
    try:
        inspector = celery_app.control.inspect(timeout=3)
        active = inspector.active()
        if active:
            worker_count = len(active)
            task_count = sum(len(tasks) for tasks in active.values())
            checks["services"]["celery"] = {"status": "ok", "workers": worker_count, "active_tasks": task_count}
        else:
            checks["services"]["celery"] = {"status": "error", "error": "No active workers"}
            checks["status"] = "degraded"
    except Exception as e:
        checks["services"]["celery"] = {"status": "error", "error": str(e)[:100]}
        checks["status"] = "degraded"

    status_code = 200 if checks["status"] == "ok" else 503
    return JSONResponse(content=checks, status_code=status_code)
```

### Vérification externe

```
UptimeRobot (gratuit) :
  URL    : https://api.agentshield.one/health
  Check  : toutes les 5 minutes
  Alert  : email + Slack #ops si down > 2 checks consécutifs

Frontend :
  URL    : https://app.agentshield.one
  Check  : toutes les 5 minutes
  Alert  : email + Slack si status != 200
```

---

## 3. SENTRY — CONFIGURATION

### Backend

```python
# app/main.py

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration

sentry_sdk.init(
    dsn=settings.sentry_dsn,
    environment=settings.sentry_environment,
    release=f"agentshield-backend@{settings.app_version}",
    traces_sample_rate=settings.sentry_traces_sample_rate,
    profiles_sample_rate=0.1,
    integrations=[
        FastApiIntegration(transaction_style="endpoint"),
        CeleryIntegration(monitor_beat_tasks=True),
        RedisIntegration(),
        HttpxIntegration(),
    ],
    before_send=filter_sensitive_data,
    before_send_transaction=filter_sensitive_transactions,
)

def filter_sensitive_data(event, hint):
    """Remove sensitive data from Sentry events."""
    # Supprimer les API keys des breadcrumbs
    if "breadcrumbs" in event:
        for crumb in event.get("breadcrumbs", {}).get("values", []):
            if "authorization" in str(crumb.get("data", {})).lower():
                crumb["data"] = {"authorization": "[FILTERED]"}

    # Supprimer les input_text/output_text
    if "extra" in event:
        for key in ["input_text", "output_text", "input_redacted", "output_redacted"]:
            if key in event["extra"]:
                event["extra"][key] = "[FILTERED]"

    # Supprimer les headers Authorization des requêtes
    if "request" in event:
        headers = event["request"].get("headers", {})
        if "Authorization" in headers:
            headers["Authorization"] = "[FILTERED]"

    return event
```

### Frontend

```typescript
// frontend/sentry.client.config.ts

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: `agentshield-frontend@${process.env.NEXT_PUBLIC_APP_VERSION}`,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,    // Pas de session replay Sentry
  replaysOnErrorSampleRate: 0,    // Pas de session replay Sentry
});
```

### Sentry alerts configurées

| Alert | Condition | Notification |
|-------|-----------|-------------|
| High error rate | > 5% of transactions in 5min | Slack #ops + email |
| Unhandled exception | Any new unhandled error | Slack #ops |
| Slow transaction | P95 > 500ms for POST /v1/track | Slack #ops |
| Celery task failure | Any task failure | Slack #ops |
| Performance regression | P95 latency +50% vs 7-day avg | Email weekly digest |

---

## 4. LOGGING

### Format des logs

```python
# app/main.py

import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """Structured JSON logging."""

    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "module": record.module,
            "function": record.funcName,
        }

        # Ajouter les extras (request_id, org_id, etc.)
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "org_id"):
            log_data["org_id"] = record.org_id

        # NE PAS logger les données sensibles
        # Pas d'API keys, pas de JWT, pas de input_text/output_text

        return json.dumps(log_data)

# Configuration
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logging.root.addHandler(handler)
logging.root.setLevel(logging.INFO)
```

### Niveaux de log

```
DEBUG   → Détails de debugging (Redis cache hit/miss, calcul de prix)
         Activé uniquement en dev (APP_DEBUG=true)

INFO    → Événements normaux (event tracké, alerte envoyée, session créée)
         Activé en dev + staging + prod

WARNING → Situations anormales non-bloquantes (modèle inconnu, retry, cache miss)
         Activé en dev + staging + prod

ERROR   → Erreurs qui nécessitent attention (service externe down, task failed)
         Activé partout + Sentry

CRITICAL → Incidents critiques (DB down, Redis down, data corruption)
           Activé partout + Sentry + Slack #ops immédiat
```

### Ce qu'on NE log PAS

```
❌ API keys (même partielles au-delà du prefix)
❌ JWT tokens
❌ input_text / output_text (contenu des prompts)
❌ Données PII
❌ Mots de passe
❌ Stripe webhook payload complet (uniquement l'event type + ID)
❌ Headers Authorization complets
```

---

## 5. MÉTRIQUES INFRASTRUCTURE

### Redis

```python
# Vérification périodique (dans health check ou Celery task)

async def check_redis_health() -> dict:
    info = await redis.info()
    return {
        "used_memory_mb": info["used_memory"] / 1024 / 1024,
        "used_memory_pct": info["used_memory"] / info.get("maxmemory", float("inf")) * 100,
        "connected_clients": info["connected_clients"],
        "keys_count": info.get("db0", {}).get("keys", 0),
        "ops_per_sec": info["instantaneous_ops_per_sec"],
        "hit_rate": info["keyspace_hits"] / max(info["keyspace_hits"] + info["keyspace_misses"], 1) * 100,
    }
```

| Métrique | Warning | Critical |
|----------|---------|----------|
| Memory usage | > 70% | > 85% |
| Connected clients | > 80 | > 150 |
| Hit rate | < 80% | < 50% |
| Ops/sec | > 10K | > 50K |

### Celery

```python
async def check_celery_health() -> dict:
    inspector = celery_app.control.inspect(timeout=5)
    active = inspector.active() or {}
    reserved = inspector.reserved() or {}
    stats = inspector.stats() or {}

    total_active = sum(len(t) for t in active.values())
    total_reserved = sum(len(t) for t in reserved.values())

    return {
        "workers": len(active),
        "active_tasks": total_active,
        "queued_tasks": total_reserved,
        "total_processed": sum(s.get("total", {}).get("celery.worker.execute", 0) for s in stats.values()),
    }
```

| Métrique | Warning | Critical |
|----------|---------|----------|
| Workers alive | < expected | 0 |
| Queued tasks | > 100 | > 1000 |
| Task failure rate | > 5% | > 20% |

### Supabase

```
Monitored via Supabase Dashboard :
  - DB size (warning > 400MB on Free)
  - Active connections (warning > 40 on Free)
  - API requests/min
  - Slow queries (> 1s)
```

### API latency

```
Mesuré via Sentry performance :

| Endpoint | P50 target | P95 target | P99 target |
|----------|-----------|-----------|-----------|
| POST /v1/track | < 30ms | < 50ms | < 100ms |
| GET /v1/analytics | < 200ms | < 500ms | < 1000ms |
| GET /v1/sessions/:id | < 300ms | < 800ms | < 1500ms |
| GET /v1/agents | < 100ms | < 300ms | < 500ms |
| WS /ws/dashboard | < 500ms event delivery |
```

---

## 6. ALERTES OPÉRATIONNELLES

### Canaux

```
Slack #ops         → Alertes infra et incidents (immédiat)
Email Nova         → Digest quotidien + alertes critiques
Sentry             → Errors et performance (dashboard)
UptimeRobot        → Uptime checks externes
```

### Matrice d'alertes

| Alerte | Condition | Sévérité | Canal | Action |
|--------|-----------|----------|-------|--------|
| API down | /health returns 503 × 2 checks | 🔴 Critical | Slack + email | Runbook #1 |
| High error rate | > 5% 5xx in 5min | 🔴 Critical | Slack + Sentry | Runbook #2 |
| Redis down | Redis ping fails | 🔴 Critical | Slack + email | Runbook #3 |
| DB down | Supabase unreachable | 🔴 Critical | Slack + email | Runbook #4 |
| Celery workers dead | 0 active workers | 🔴 Critical | Slack | Runbook #5 |
| High latency | POST /v1/track P95 > 200ms | 🟡 Warning | Slack | Runbook #6 |
| Redis memory high | > 70% | 🟡 Warning | Slack | Runbook #7 |
| Queue backlog | > 100 pending tasks | 🟡 Warning | Slack | Runbook #8 |
| Certificate expiry | < 14 days | 🟡 Warning | Email | Runbook #9 |
| Disk usage high | Supabase > 400MB (Free) | 🟡 Warning | Email | Runbook #10 |

---

## 7. RUNBOOKS

### Runbook #1 — API down

```
Symptôme : /health retourne 503 ou timeout
Sévérité : 🔴 Critical
Impact   : Les SDK clients reçoivent des erreurs. Le dashboard ne charge pas.

Étapes :
1. Vérifier Railway Dashboard → Service agentshield-api
   - Le service est-il déployé ? (vert dans Railway)
   - Y a-t-il un deploy en cours qui a échoué ?
   - Les logs montrent-ils une erreur au démarrage ?

2. Si le service est crashé :
   → Railway > Service > Deployments > Redeploy previous
   → Vérifier que le redeploy est stable (logs)

3. Si le service tourne mais /health est 503 :
   → Vérifier quelle dépendance est down (Redis? DB? Celery?)
   → Suivre le runbook correspondant (#3, #4, #5)

4. Si rien ne marche :
   → Railway > Service > Restart
   → Si toujours down → vérifier les variables d'env (ENV.md)
   → Dernière option : rollback le dernier deploy

Résolution confirmée quand : /health retourne 200, Sentry montre 0 errors
```

### Runbook #2 — High error rate

```
Symptôme : > 5% de réponses 5xx sur 5 minutes
Sévérité : 🔴 Critical

Étapes :
1. Ouvrir Sentry → Filtrer par "5xx" → Identifier l'erreur la plus fréquente
2. Si c'est une erreur de DB → Runbook #4
3. Si c'est une erreur de Redis → Runbook #3
4. Si c'est un bug de code :
   → Identifier le commit qui a introduit le bug
   → Rollback : Railway > Redeploy previous deployment
   → Hotfix : fix + test + deploy
5. Si c'est un service externe (Claude API, Brevo, Slack) :
   → Vérifier le status page du service
   → Le code devrait fail gracefully (pas de 5xx pour un service externe down)
   → Si le code ne gère pas le cas → c'est un bug, fix le fallback

Résolution : error rate < 1% pendant 10 minutes
```

### Runbook #3 — Redis down

```
Symptôme : Redis ping fails, /health shows redis: error
Sévérité : 🔴 Critical
Impact   : Cache miss → latence élevée. Rate limiting désactivé. Budget checks fail open.

Étapes :
1. Vérifier Railway → Service Redis
   → Est-il running? Memory? Connections?

2. Si Redis est OOM (Out of Memory) :
   → Railway > Redis > Restart
   → Si récurrent → upgrader le plan Railway Redis
   → Vérifier les TTL (des clés sans TTL qui s'accumulent?)

3. Si Redis est unreachable :
   → Vérifier le REDIS_URL dans les variables d'env
   → Vérifier que le service Redis est dans le même projet Railway
   → Railway > Redis > Restart

4. Impact sur AgentShield :
   → POST /v1/track : budget check skip (fail open), latence augmentée
   → Dashboard : pas de cache, requêtes directes DB (plus lent)
   → Alertes : les Celery tasks continuent (Redis est aussi le broker — si Redis est down, Celery est down aussi)
   → Conséquence : les tasks s'accumulent et sont exécutées au retour de Redis

Résolution : redis.ping() OK, latence revenue à la normale
```

### Runbook #4 — Database down

```
Symptôme : Supabase unreachable
Sévérité : 🔴 Critical
Impact   : Rien ne fonctionne (pas de lecture, pas d'écriture)

Étapes :
1. Vérifier le Supabase Dashboard → Project status
   → Maintenance en cours ? (Supabase notifie par email)
   → Quota dépassé ? (Free tier limits)

2. Si Supabase est en maintenance :
   → Attendre. Durée typique : 5-15 minutes.
   → Communiquer si > 15 minutes

3. Si quota dépassé :
   → Upgrader vers Supabase Pro ($25/mois)
   → Lancer le cleanup des données expirées : celery call maintenance.cleanup_expired_data

4. Si erreur de connexion :
   → Vérifier SUPABASE_URL et les clés dans les env vars
   → Vérifier que l'IP de Railway n'est pas bloquée

Résolution : health check DB OK, dashboard charge les données
```

### Runbook #5 — Celery workers dead

```
Symptôme : 0 active Celery workers
Impact   : Les alertes ne se déclenchent pas. Les agrégations ne se calculent pas. Les PDF ne se génèrent pas. Le dashboard montre des données stale.

Étapes :
1. Vérifier Railway → Service agentshield-worker
   → Logs : pourquoi le worker a crashé ?
   → OOM ? → augmenter la mémoire
   → Erreur Python ? → fix le bug

2. Restart : Railway > agentshield-worker > Restart

3. Vérifier aussi agentshield-beat :
   → Beat doit tourner sur exactement 1 instance
   → Si beat est mort → les tasks schedulées ne sont pas envoyées

4. Après restart :
   → Vérifier les tasks en queue : celery inspect reserved
   → Les tasks accumulées vont être traitées automatiquement

Résolution : celery inspect active retourne des workers
```

### Runbook #6 — High latency POST /v1/track

```
Symptôme : P95 > 200ms (cible: 50ms)

Étapes :
1. Identifier le bottleneck via Sentry performance :
   → Redis slow ? → cache miss, check Redis memory
   → DB slow ? → query lente, check Supabase slow query log
   → PII scan slow ? → regex trop complexe ?
   → Guardrail check slow ? → trop de règles ? cache expiré ?

2. Quick fixes :
   → Redis cache expiré → les clés se re-remplissent, attendre 5min
   → DB slow query → vérifier les index (ARCH.md section 3)
   → Trop de requêtes → vérifier le rate limiting

3. Si la charge est trop élevée :
   → Augmenter APP_WORKERS (2 → 4)
   → Si ça ne suffit pas → ajouter une instance Railway

Résolution : P95 < 50ms pendant 30 minutes
```

### Runbook #7 — Redis memory high

```
Symptôme : Redis memory > 70%

Étapes :
1. Vérifier quelles clés prennent de la place :
   → redis-cli --bigkeys
   → Les webhook batches s'accumulent ?
   → Les budget counters ont des TTL corrects ?

2. Cleanup immédiat :
   → Flush analytics cache : redis-cli KEYS "analytics:*" | xargs redis-cli DEL
   → Les autres caches se re-remplissent naturellement (TTL)

3. Si récurrent :
   → Upgrader Redis (Railway plan supérieur)
   → Réduire les TTL des caches non-critiques
   → Vérifier que les Celery results expirent (result_expires=3600)

Résolution : memory < 60%
```

---

## 8. INCIDENT MANAGEMENT

### Processus

```
1. DETECT   — Alerte reçue (Sentry, UptimeRobot, Slack)
2. ASSESS   — Identifier la sévérité et l'impact
3. ACT      — Suivre le runbook correspondant
4. VERIFY   — Confirmer la résolution (health check OK, Sentry clean)
5. DOCUMENT — Logger dans CHANGELOG.md si impact visible pour les utilisateurs
```

### Communication

```
Si downtime > 5 minutes et impact visible :
  1. Tweet depuis @NovaShips : "We're aware of an issue with AgentShield and are working on a fix. Updates here."
  2. Status page update (si un jour on en a un)
  3. Post-mortem dans les 24h (interne)
```

### Sévérité

```
🔴 Critical — Le produit est down ou les données sont corrompues
   → Action immédiate, tout le reste est en pause
   → Objectif résolution : < 30 minutes

🟡 Warning — Feature dégradée ou performance réduite
   → Action dans l'heure
   → Objectif résolution : < 4 heures

🟢 Info — Anomalie détectée mais pas d'impact immédiat
   → Investigation dans la journée
   → Fix dans la semaine
```

---

## 9. CHECKLIST MONITORING SETUP

```
□ Sentry configuré (backend + frontend)
□ Sentry alerts configurées (error rate, slow transactions)
□ Sentry filter_sensitive_data actif (pas d'API keys dans les events)
□ UptimeRobot configuré sur /health et sur app.agentshield.one
□ Health check teste Redis, DB, Celery
□ Logging en JSON structuré
□ Pas de données sensibles dans les logs
□ Railway logs accessible
□ Slack #ops channel créé et alertes connectées
□ Runbooks lus et compris
```

---

> **Règle :** Le monitoring n'est pas optionnel. Un produit en production sans monitoring c'est conduire sans rétroviseurs.
> Chaque alerte a un runbook. Chaque runbook a des étapes claires. Pas de "it depends".
