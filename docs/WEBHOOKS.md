# WEBHOOKS.md — Webhooks AgentShield

> Ce fichier définit tous les webhooks du projet : entrants (Stripe, Slack) et sortants (vers les clients). Claude Code le lit avant de toucher au traitement des webhooks ou à leur dispatch.
> Cohérent avec : API.md (endpoints), QUEUE.md (tasks), INTEGRATIONS.md (services), SECURITY.md (signatures)
> Dernière mise à jour : mars 2026

---

## 1. VUE D'ENSEMBLE

```
WEBHOOKS ENTRANTS (reçus par AgentShield)
┌──────────────────────────────────────────────┐
│                                              │
│  Stripe ──→ POST /v1/billing/webhooks        │
│             (checkout, invoice, subscription) │
│                                              │
│  Slack  ──→ POST /v1/slack/events            │
│             (slash commands, interactions)    │
│                                              │
└──────────────────────────────────────────────┘

WEBHOOKS SORTANTS (envoyés par AgentShield)
┌──────────────────────────────────────────────┐
│                                              │
│  AgentShield ──→ URL client configurée       │
│                  (alerts, events, violations) │
│                                              │
│  AgentShield ──→ Slack webhook URL           │
│                  (alertes simples)           │
│                                              │
└──────────────────────────────────────────────┘
```

---

# WEBHOOKS ENTRANTS

## 2. STRIPE WEBHOOKS

### Endpoint : POST /v1/billing/webhooks

### Vérification de signature

```python
# app/api/v1/billing.py

import stripe
from fastapi import Request, HTTPException

@router.post("/billing/webhooks")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.stripe_webhook_secret,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")

    await handle_stripe_event(event)
    return {"received": True}
```

### Événements gérés

| Stripe Event | Action AgentShield |
|-------------|-------------------|
| `checkout.session.completed` | Activer le plan acheté, mettre à jour l'org |
| `invoice.paid` | Confirmer le renouvellement, reset du cycle |
| `invoice.payment_failed` | Marquer l'org en grace period (7 jours), notifier le owner par email |
| `customer.subscription.updated` | Upgrade/downgrade : mettre à jour plan, limites, modules_enabled |
| `customer.subscription.deleted` | Retour au plan Free, désactiver les modules |

### Handlers détaillés

```python
# app/services/stripe.py

async def handle_checkout_completed(event: dict) -> None:
    """Activate plan after successful checkout."""
    session = event["data"]["object"]
    org_id = session["metadata"]["organization_id"]
    plan = session["metadata"]["plan"]

    plan_config = PLAN_CONFIGS[plan]

    await db.from_("organizations").update({
        "plan": plan,
        "stripe_customer_id": session["customer"],
        "stripe_subscription_id": session["subscription"],
        "max_agents": plan_config["max_agents"],
        "max_requests": plan_config["max_requests"],
        "history_days": plan_config["history_days"],
        "modules_enabled": plan_config["modules"],
    }).eq("id", org_id).execute()

    # Audit log
    await log_audit(org_id, "plan.upgraded", "organization", org_id, {"plan": plan})

    # Email de bienvenue plan payant
    await send_plan_activated_email(org_id, plan)


async def handle_payment_failed(event: dict) -> None:
    """Handle failed payment — grace period."""
    invoice = event["data"]["object"]
    customer_id = invoice["customer"]

    org = await get_org_by_stripe_customer(customer_id)
    if not org:
        return

    # Grace period : 7 jours avant downgrade
    grace_end = datetime.utcnow() + timedelta(days=7)

    # Notifier le owner
    await send_payment_failed_email(org["id"], grace_end)

    # Logger
    await log_audit(org["id"], "billing.payment_failed", "organization", org["id"], {
        "grace_period_ends": grace_end.isoformat(),
    })


async def handle_subscription_deleted(event: dict) -> None:
    """Downgrade to Free when subscription is cancelled."""
    subscription = event["data"]["object"]
    customer_id = subscription["customer"]

    org = await get_org_by_stripe_customer(customer_id)
    if not org:
        return

    await db.from_("organizations").update({
        "plan": "free",
        "stripe_subscription_id": None,
        "max_agents": 1,
        "max_requests": 10000,
        "history_days": 7,
        "modules_enabled": ["monitor"],
    }).eq("id", org["id"]).execute()

    await log_audit(org["id"], "plan.downgraded", "organization", org["id"], {"plan": "free"})
    await send_plan_downgraded_email(org["id"])
```

### Plan configs

```python
PLAN_CONFIGS = {
    "free": {
        "max_agents": 1,
        "max_requests": 10_000,
        "history_days": 7,
        "modules": ["monitor"],
    },
    "starter": {
        "max_agents": 5,
        "max_requests": 100_000,
        "history_days": 30,
        "modules": ["monitor", "replay"],
    },
    "pro": {
        "max_agents": 999_999,
        "max_requests": 500_000,
        "history_days": 90,
        "modules": ["monitor", "replay", "protect"],
    },
    "team": {
        "max_agents": 999_999,
        "max_requests": 999_999_999,
        "history_days": 365,
        "modules": ["monitor", "replay", "protect"],
    },
}
```

### Idempotence

```python
async def handle_stripe_event(event: dict) -> None:
    """Process a Stripe event with idempotence check."""
    event_id = event["id"]

    # Vérifier si déjà traité
    existing = await redis.get(f"stripe_event:{event_id}")
    if existing:
        return  # Déjà traité

    # Traiter
    handler = STRIPE_HANDLERS.get(event["type"])
    if handler:
        await handler(event)

    # Marquer comme traité (TTL 48h)
    await redis.setex(f"stripe_event:{event_id}", 172800, "processed")
```

### Règles
- Toujours vérifier la signature Stripe avant de traiter
- Idempotence via Redis (même event reçu 2 fois = traité 1 fois)
- Retourner 200 rapidement (Stripe retry après 5s sans réponse)
- Les opérations longues (emails) sont dispatchées en Celery tasks
- Logger chaque event Stripe dans l'audit log

---

## 3. SLACK WEBHOOKS ENTRANTS

### Endpoint : POST /v1/slack/events

### Vérification de signature Slack

```python
# app/api/v1/slack.py

import hmac
import hashlib

@router.post("/slack/events")
async def slack_events(request: Request):
    body = await request.body()
    timestamp = request.headers.get("X-Slack-Request-Timestamp")
    signature = request.headers.get("X-Slack-Signature")

    # Vérifier la fraîcheur (< 5 min)
    if abs(time.time() - int(timestamp)) > 300:
        raise HTTPException(status_code=400, detail="Request too old")

    # Vérifier la signature
    sig_basestring = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        settings.slack_signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    data = await request.json()

    # Slack URL verification challenge
    if data.get("type") == "url_verification":
        return {"challenge": data["challenge"]}

    await handle_slack_event(data)
    return {"ok": True}
```

### Slash commands

```python
# POST /v1/slack/commands

@router.post("/slack/commands")
async def slack_command(request: Request):
    form = await request.form()
    command = form.get("command")
    text = form.get("text", "").strip()
    user_id = form.get("user_id")
    team_id = form.get("team_id")

    # Vérifier la signature Slack (même logique)
    verify_slack_signature(request)

    # Router les commandes
    org = await get_org_by_slack_team(team_id)
    if not org:
        return slack_response("AgentShield is not connected to this workspace.")

    if command == "/shield":
        return await handle_shield_command(org, text, user_id)

    return slack_response("Unknown command.")


async def handle_shield_command(org: dict, text: str, user_id: str) -> dict:
    """Route /shield subcommands."""
    parts = text.split(maxsplit=1)
    subcommand = parts[0] if parts else "help"
    args = parts[1] if len(parts) > 1 else ""

    handlers = {
        "status": cmd_status,
        "agent": cmd_agent,
        "session": cmd_session,
        "violations": cmd_violations,
        "forecast": cmd_forecast,
        "help": cmd_help,
    }

    handler = handlers.get(subcommand, cmd_help)
    return await handler(org, args)
```

### Réponses Slack (Block Kit)

```python
async def cmd_status(org: dict, args: str) -> dict:
    """Handler for /shield status."""
    analytics = await get_today_analytics(org["id"])
    forecast = await get_forecast(org["id"])
    violations = await get_recent_violations(org["id"], limit=3)

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "📊 AgentShield Status"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Today:* ${analytics['cost_today']:.2f}"},
                {"type": "mrkdwn", "text": f"*This month:* ${analytics['cost_month']:.2f}"},
                {"type": "mrkdwn", "text": f"*Projected EOM:* ${forecast['projected']:.0f}"},
                {"type": "mrkdwn", "text": f"*Active agents:* {analytics['active_agents']}"},
            ]
        },
    ]

    if violations:
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"⚠️ *{len(violations)} recent violations*"}
        })

    blocks.append({
        "type": "actions",
        "elements": [{
            "type": "button",
            "text": {"type": "plain_text", "text": "Open Dashboard"},
            "url": f"https://app.agentshield.io/dashboard",
        }]
    })

    return {"response_type": "ephemeral", "blocks": blocks}
```

---

# WEBHOOKS SORTANTS

## 4. SYSTÈME DE WEBHOOKS SORTANTS

### Événements disponibles

| Event type | Description | Payload key | Batching |
|-----------|-------------|-------------|----------|
| `event.tracked` | Chaque event tracké | event | Oui (max 1/10s) |
| `alert.fired` | Alerte déclenchée | alert | Non |
| `smart_alert.diagnosed` | Diagnostic IA prêt | smart_alert | Non |
| `anomaly.detected` | Anomalie détectée | anomaly | Non |
| `budget.warning` | Budget > 80% | budget | Non |
| `budget.exceeded` | Budget cap atteint | budget | Non |
| `agent.frozen` | Kill switch activé | agent | Non |
| `session.completed` | Session terminée | session | Non |
| `guardrail.violated` | Violation guardrail | violation | Non |
| `pii.detected` | PII trouvé et redacté | pii | Non |

### Payload standard

```json
{
    "id": "wh_550e8400-e29b-41d4-a716-446655440000",
    "type": "alert.fired",
    "api_version": "v1",
    "created_at": "2026-03-15T14:23:01Z",
    "organization_id": "uuid",
    "data": {
        "alert_rule_id": "uuid",
        "alert_name": "Daily cost alert",
        "agent": "support-agent",
        "metric": "cost_daily",
        "current_value": 23.47,
        "threshold": 20.00,
        "overage_pct": 17.4,
        "dashboard_url": "https://app.agentshield.io/dashboard/agents/uuid"
    }
}
```

### Payloads par event type

```json
// event.tracked (batched)
{
    "type": "event.tracked",
    "data": {
        "events": [
            {
                "event_id": "uuid",
                "agent": "support-agent",
                "model": "gpt-4o",
                "cost_usd": 0.034,
                "session_id": "ticket-123",
                "status": "success",
                "tracked_at": "2026-03-15T14:23:01Z"
            }
        ],
        "count": 1
    }
}

// anomaly.detected
{
    "type": "anomaly.detected",
    "data": {
        "agent": "support-agent",
        "metric": "cost_hourly",
        "current_value": 34.21,
        "baseline_mean": 4.80,
        "baseline_stddev": 1.20,
        "z_score": 24.5,
        "multiplier": "7.1x above normal",
        "hour": "2026-03-15T14:00:00Z"
    }
}

// session.completed
{
    "type": "session.completed",
    "data": {
        "session_id": "ticket-123",
        "agents": ["classifier", "responder"],
        "total_steps": 12,
        "total_cost_usd": 0.47,
        "duration_ms": 263000,
        "status": "success",
        "replay_url": "https://app.agentshield.io/dashboard/sessions/ticket-123"
    }
}

// guardrail.violated
{
    "type": "guardrail.violated",
    "data": {
        "rule_id": "uuid",
        "rule_name": "No competitor mentions",
        "agent": "chatbot",
        "session_id": "sess-456",
        "action_taken": "blocked",
        "matched_content": "[REDACTED]"
    }
}

// budget.exceeded
{
    "type": "budget.exceeded",
    "data": {
        "agent": "support-agent",
        "current_usd": 52.30,
        "max_usd": 50.00,
        "period": "monthly",
        "action": "freeze",
        "is_frozen": true
    }
}
```

---

## 5. SIGNATURE DES WEBHOOKS SORTANTS

### Signature HMAC SHA-256

```python
# app/services/webhooks.py

import hmac
import hashlib
import json
import time

def sign_and_send_webhook(endpoint: WebhookEndpoint, payload: dict) -> WebhookDelivery:
    """Sign and send a webhook payload."""
    timestamp = int(time.time())
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)

    # Signature = HMAC-SHA256(secret, "{timestamp}.{payload}")
    message = f"{timestamp}.{payload_json}"
    signature = hmac.new(
        endpoint.secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-AGS-Signature": f"sha256={signature}",
        "X-AGS-Timestamp": str(timestamp),
        "X-AGS-Event": payload["type"],
        "X-AGS-Delivery-Id": payload["id"],
        "User-Agent": "AgentShield-Webhook/1.0",
    }

    return headers, payload_json
```

### Vérification côté client (documentation publique)

```python
# Exemple pour les clients qui reçoivent nos webhooks

import hmac
import hashlib
import time

def verify_webhook(payload: bytes, signature: str, timestamp: str, secret: str) -> bool:
    """Verify an AgentShield webhook signature."""
    # 1. Vérifier la fraîcheur (< 5 minutes)
    if abs(time.time() - int(timestamp)) > 300:
        return False

    # 2. Recalculer la signature
    message = f"{timestamp}.{payload.decode()}"
    expected = "sha256=" + hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    # 3. Comparer en constant-time
    return hmac.compare_digest(expected, signature)
```

---

## 6. DISPATCH ET RETRY

### Flow de dispatch

```
Event se produit (alerte, anomalie, etc.)
    │
    ├── 1. Chercher les webhook endpoints de l'org qui écoutent cet event type
    │
    ├── 2. Pour chaque endpoint :
    │      ├── Créer un WebhookDelivery en DB (status: pending)
    │      └── Dispatch Celery task : webhooks.dispatch(delivery_id)
    │
    └── 3. Celery task :
           ├── Signer le payload
           ├── Envoyer la requête HTTP (timeout 10s)
           ├── Si 2xx → marquer delivered
           ├── Si 4xx → marquer failed (pas de retry, erreur client)
           ├── Si 5xx → retry selon le schedule
           └── Si timeout → retry selon le schedule
```

### Schedule de retry

```
Tentative 1 : immédiat
Tentative 2 : après 1 minute
Tentative 3 : après 5 minutes
Tentative 4 : après 30 minutes
Tentative 5 : après 2 heures

Après 5 échecs :
  → Marquer le delivery comme "failed"
  → Envoyer un email au owner : "Webhook delivery failed"
  → Après 3 deliveries failed consécutives sur le même endpoint :
    → Désactiver l'endpoint (is_active = false)
    → Notifier le owner : "Webhook endpoint disabled"
```

### Implémentation

```python
# app/workers/tasks_webhooks.py

RETRY_DELAYS = [0, 60, 300, 1800, 7200]  # secondes

@shared_task(name="webhooks.dispatch", bind=True, max_retries=5)
def dispatch_webhook(self, delivery_id: str) -> None:
    delivery = get_delivery(delivery_id)
    endpoint = get_endpoint(delivery.endpoint_id)

    if not endpoint.is_active:
        mark_delivery_skipped(delivery_id)
        return

    headers, payload_json = sign_and_send_webhook(endpoint, delivery.payload)

    try:
        response = httpx.post(
            endpoint.url,
            content=payload_json,
            headers=headers,
            timeout=10.0,
        )

        update_delivery(delivery_id, status_code=response.status_code)

        if response.status_code >= 200 and response.status_code < 300:
            mark_delivery_delivered(delivery_id)
            return

        if response.status_code >= 400 and response.status_code < 500:
            mark_delivery_failed(delivery_id, f"Client error: {response.status_code}")
            return

        # 5xx — retry
        attempt = self.request.retries
        if attempt < len(RETRY_DELAYS) - 1:
            raise self.retry(countdown=RETRY_DELAYS[attempt + 1])
        else:
            mark_delivery_failed(delivery_id, f"Server error after 5 attempts: {response.status_code}")
            check_endpoint_health(endpoint.id)

    except httpx.TimeoutException:
        attempt = self.request.retries
        if attempt < len(RETRY_DELAYS) - 1:
            update_delivery(delivery_id, status_code=0, error="timeout")
            raise self.retry(countdown=RETRY_DELAYS[attempt + 1])
        else:
            mark_delivery_failed(delivery_id, "Timeout after 5 attempts")
            check_endpoint_health(endpoint.id)
```

---

## 7. BATCHING (event.tracked)

### Problème
Un client actif peut envoyer des centaines d'events par minute. Envoyer un webhook pour chaque event noierait le endpoint du client.

### Solution
Les webhooks `event.tracked` sont batchés : max 1 envoi toutes les 10 secondes par endpoint.

```python
# app/workers/tasks_webhooks.py

@shared_task(name="webhooks.dispatch_batch")
def dispatch_batch(organization_id: str) -> None:
    """Collect and send batched event.tracked webhooks."""
    # 1. Récupérer les events des 10 dernières secondes depuis Redis
    events = redis.lrange(f"webhook_batch:{organization_id}", 0, -1)
    redis.delete(f"webhook_batch:{organization_id}")

    if not events:
        return

    # 2. Parser les events
    parsed = [json.loads(e) for e in events]

    # 3. Construire le payload batch
    payload = {
        "id": f"wh_{uuid4()}",
        "type": "event.tracked",
        "api_version": "v1",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "organization_id": organization_id,
        "data": {
            "events": parsed,
            "count": len(parsed),
        }
    }

    # 4. Envoyer à chaque endpoint qui écoute event.tracked
    endpoints = get_active_endpoints(organization_id, "event.tracked")
    for endpoint in endpoints:
        create_and_dispatch_delivery(endpoint, payload)
```

### Accumulation dans Redis

```python
# Dans le service tracking, après insertion de l'event :

async def queue_webhook_batch(org_id: str, event_summary: dict):
    """Add event to the webhook batch queue."""
    key = f"webhook_batch:{org_id}"
    await redis.rpush(key, json.dumps(event_summary))
    await redis.expire(key, 30)  # TTL sécurité

    # Déclencher le batch toutes les 10s (debounce via Redis)
    lock_key = f"webhook_batch_lock:{org_id}"
    if await redis.set(lock_key, "1", nx=True, ex=10):
        dispatch_batch.apply_async(
            args=[org_id],
            countdown=10,
        )
```

---

## 8. SLACK ALERTES SIMPLES (WEBHOOK)

Séparé du Slack bot interactif. Les alertes simples utilisent les Incoming Webhooks Slack (pas l'API complète).

### Configuration
- Le user colle son Slack webhook URL dans la config d'une alert rule
- Format : `https://hooks.slack.com/services/T.../B.../xxx`

### Envoi

```python
# app/services/slack.py

async def send_slack_alert(webhook_url: str, alert: dict) -> None:
    """Send a simple Slack alert via incoming webhook."""
    blocks = format_alert_blocks(alert)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            webhook_url,
            json={"blocks": blocks},
            timeout=10.0,
        )
        if response.status_code != 200:
            raise SlackDeliveryError(f"Slack returned {response.status_code}")
```

### Format des alertes Slack

```python
def format_alert_blocks(alert: dict) -> list:
    """Format an alert as Slack Block Kit."""
    emoji = "🔴" if alert["severity"] == "critical" else "⚠️"
    
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"{emoji} *{alert['type']}* — {alert['agent']}\n"
                    f"Current: *${alert['value']:.2f}* | "
                    f"Threshold: ${alert['threshold']:.2f} | "
                    f"Overage: +{alert['overage_pct']:.1f}%"
                ),
            },
        },
    ]

    # Smart Alert diagnosis (si disponible)
    if alert.get("smart_diagnosis"):
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*Diagnosis:* {alert['smart_diagnosis']}\n"
                    f"*Suggested fix:* {alert['suggested_fix']}"
                ),
            },
        })

    # Lien dashboard
    blocks.append({
        "type": "actions",
        "elements": [{
            "type": "button",
            "text": {"type": "plain_text", "text": "View in Dashboard"},
            "url": alert["dashboard_url"],
        }],
    })

    return blocks
```

### Disponibilité par plan
- **Starter+** : alertes Slack simples via webhook URL
- **Team** : Slack bot interactif (slash commands) via Slack OAuth

---

## 9. DASHBOARD DE LIVRAISON

### Vue dans /dashboard/settings → Webhooks

```
┌──────────────────────────────────────────────────────────────┐
│ Webhook Endpoints                                [+ New]     │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ https://myapp.com/agentshield-hook                       │ │
│ │ Events: alert.fired, anomaly.detected, budget.exceeded   │ │
│ │ Status: 🟢 Active | Last delivery: 2 min ago | 98% rate │ │
│ │ [Test] [Edit] [Disable]                                  │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Recent Deliveries                                            │
│                                                              │
│ Time     │ Event          │ Endpoint        │ Status │ Code  │
│ 14:23:01 │ alert.fired    │ myapp.com/...   │ ✅     │ 200   │
│ 14:20:15 │ anomaly        │ myapp.com/...   │ ✅     │ 200   │
│ 13:55:03 │ alert.fired    │ myapp.com/...   │ ❌     │ 503   │
│          │                │                 │ retry 2/5      │
└──────────────────────────────────────────────────────────────┘
```

### Test webhook

```
Bouton [Test] → envoie un payload de test :

{
    "id": "wh_test_xxx",
    "type": "test",
    "api_version": "v1",
    "created_at": "2026-03-15T14:23:01Z",
    "data": {
        "message": "This is a test webhook from AgentShield.",
        "organization": "your-org-name"
    }
}
```

---

## 10. SÉCURITÉ — RÉCAPITULATIF

| Aspect | Entrant (Stripe/Slack) | Sortant (vers clients) |
|--------|----------------------|----------------------|
| Signature | Vérifiée (Stripe sig / Slack sig) | Générée (HMAC SHA-256) |
| Timestamp | Vérifié (< 5 min) | Inclus dans le header |
| Idempotence | Event ID en Redis (TTL 48h) | Delivery ID unique |
| Timeout | N/A | 10s par requête |
| Retry | N/A (Stripe/Slack gèrent) | 5 tentatives avec backoff |
| HTTPS | Obligatoire (Stripe/Slack forcent) | Obligatoire (URLs http rejetées) |
| Secrets | Stockés chiffrés en DB | Générés aléatoirement, affichés 1 fois |

---

> **Règle :** Les webhooks sont un contrat avec les clients. Le format des payloads ne change JAMAIS de manière breaking sans incrément de version API.
> Les signatures sont obligatoires des deux côtés. Pas de webhook non signé.
