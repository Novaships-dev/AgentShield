# API.md — Documentation API AgentShield

> Ce fichier documente TOUS les endpoints de l'API AgentShield. Claude Code le lit avant de créer ou modifier un endpoint. C'est aussi la base de la documentation publique pour les développeurs.
> Cohérent avec : ARCH.md (structure), SPEC.md (comportements), ERRORS.md (codes erreur), SECURITY.md (auth)
> Dernière mise à jour : mars 2026

---

## 1. BASE URL

```
Production : https://api.agentshield.io
Staging    : https://staging-api.agentshield.io
Local      : http://localhost:8000
```

Tous les endpoints sont préfixés `/v1/`.

---

## 2. AUTHENTIFICATION

Deux méthodes selon le contexte :

```
SDK / API directe :
  Authorization: Bearer ags_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Dashboard / Frontend :
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs... (JWT Supabase)
```

Voir SECURITY.md pour les détails de chaque méthode.

---

## 3. HEADERS COMMUNS

### Request

```
Content-Type: application/json
Authorization: Bearer <token_or_api_key>
X-Request-Id: <optional_client_request_id>
```

### Response

```
Content-Type: application/json
X-AGS-Request-Id: <uuid>
X-AGS-Plan: <free|starter|pro|team>
X-RateLimit-Limit: <max_requests_per_window>
X-RateLimit-Remaining: <remaining>
X-RateLimit-Reset: <unix_timestamp>
```

---

## 4. PAGINATION

Tous les endpoints de liste supportent la pagination :

```
GET /v1/agents?page=1&per_page=50

Response :
{
    "data": [...],
    "pagination": {
        "page": 1,
        "per_page": 50,
        "total": 234,
        "total_pages": 5
    }
}
```

- `page` : défaut 1, min 1
- `per_page` : défaut 50, min 1, max 100

---

# MODULE MONITOR

## 5. POST /v1/track

Ingestion d'un événement de coût. Endpoint principal du SDK.

### Auth : API Key

### Request

```json
{
    "agent": "support-agent",
    "model": "gpt-4o",
    "provider": "openai",
    "input_tokens": 1250,
    "output_tokens": 340,
    "cost_usd": 0.0234,
    "session_id": "ticket-123",
    "step": 3,
    "step_name": "classify",
    "input_text": "Customer says: I need help with billing",
    "output_text": "Category: billing_inquiry",
    "status": "success",
    "duration_ms": 450,
    "workflow": "customer-support",
    "user_label": "user_456",
    "team_label": "backend-team",
    "metadata": {"version": "2.1"}
}
```

### Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| agent | string | ✅ | Nom de l'agent (1-100 chars, alphanum + - + _) |
| model | string | — | Nom du modèle (gpt-4o, claude-sonnet-4-6, etc.) |
| provider | string | — | Provider (auto-détecté depuis model si omis) |
| input_tokens | int | — | Tokens d'entrée (≥ 0) |
| output_tokens | int | — | Tokens de sortie (≥ 0) |
| cost_usd | float | — | Coût en USD (auto-calculé si omis + model + tokens fournis) |
| session_id | string | — | ID de session pour Replay (max 200 chars) |
| step | int | — | Numéro du step dans la session (≥ 0) |
| step_name | string | — | Nom lisible du step (max 100 chars) |
| input_text | string | — | Texte d'entrée pour Replay (max 50K chars, PII redacté auto) |
| output_text | string | — | Texte de sortie pour Replay (max 50K chars, PII redacté auto) |
| status | string | — | "success" / "error" / "timeout" (défaut: "success") |
| duration_ms | int | — | Durée de l'appel en ms (≥ 0) |
| workflow | string | — | Catégorie de workflow (max 100 chars) |
| user_label | string | — | Label end-user (max 100 chars) |
| team_label | string | — | Label équipe (max 100 chars) |
| metadata | object | — | Données custom (max 10 clés, 500 chars/valeur) |

### Response 201

```json
{
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent": "support-agent",
    "cost_usd": 0.0234,
    "budget_remaining_usd": 47.23,
    "budget_status": "ok",
    "guardrail_violations": [],
    "pii_detected": ["email"],
    "warnings": []
}
```

### budget_status values

| Value | Signification |
|-------|---------------|
| "ok" | Pas de budget cap ou usage sous le seuil |
| "warning" | Usage > 80% du cap |
| "exceeded" | Usage ≥ 100% du cap, mode alert_only |

### Erreurs possibles
- 401 `auth_invalid_api_key` — clé invalide
- 403 `guardrail_blocked` — bloqué par un guardrail
- 403 `plan_required_starter` — input_text/output_text envoyés sur plan Free
- 422 `validation_error` — payload invalide
- 429 `rate_limit_exceeded` — trop de requêtes
- 429 `budget_exceeded` — budget cap atteint (mode freeze)
- 429 `plan_limit_requests` — limite requêtes du plan
- 429 `plan_limit_agents` — limite agents du plan

---

## 6. GET /v1/agents

Liste des agents de l'organisation.

### Auth : JWT

### Query params

| Param | Type | Description |
|-------|------|-------------|
| page | int | Page (défaut 1) |
| per_page | int | Par page (défaut 50) |
| status | string | Filtrer : "active" / "warning" / "frozen" / "inactive" |
| search | string | Recherche par nom |

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "name": "support-agent",
            "description": "Customer support AI agent",
            "is_active": true,
            "is_frozen": false,
            "status": "active",
            "cost_today_usd": 4.23,
            "cost_month_usd": 127.50,
            "cost_trend_pct": 12.3,
            "requests_today": 187,
            "last_event_at": "2026-03-15T14:23:01Z",
            "created_at": "2026-03-01T10:00:00Z"
        }
    ],
    "pagination": { "page": 1, "per_page": 50, "total": 7, "total_pages": 1 }
}
```

---

## 7. GET /v1/agents/:id

Détail d'un agent avec métriques.

### Auth : JWT

### Response 200

```json
{
    "id": "uuid",
    "name": "support-agent",
    "description": "Customer support AI agent",
    "is_active": true,
    "is_frozen": false,
    "status": "active",
    "metrics": {
        "cost_today_usd": 4.23,
        "cost_week_usd": 28.70,
        "cost_month_usd": 127.50,
        "cost_trend_pct": 12.3,
        "requests_today": 187,
        "requests_month": 4520,
        "avg_cost_per_request": 0.028,
        "avg_tokens_per_request": 1580,
        "error_rate_pct": 2.1,
        "top_model": "gpt-4o",
        "top_model_pct": 78.5
    },
    "budget_cap": {
        "max_usd": 50.0,
        "period": "monthly",
        "current_usd": 42.30,
        "percentage": 84.6,
        "action": "freeze"
    },
    "forecast": {
        "projected_eom_usd": 312.00,
        "confidence_low": 265.00,
        "confidence_high": 359.00
    },
    "last_event_at": "2026-03-15T14:23:01Z",
    "created_at": "2026-03-01T10:00:00Z"
}
```

---

## 8. GET /v1/analytics

Données agrégées pour le dashboard.

### Auth : JWT

### Query params

| Param | Type | Description |
|-------|------|-------------|
| range | string | "today" / "7d" / "30d" / "90d" / "custom" |
| start | datetime | Début de la période (requis si range=custom) |
| end | datetime | Fin de la période (requis si range=custom) |
| agent_id | uuid | Filtrer par agent |
| provider | string | Filtrer par provider |
| model | string | Filtrer par modèle |
| team_label | string | Filtrer par équipe |
| granularity | string | "hour" / "day" (auto si omis) |

### Response 200

```json
{
    "summary": {
        "total_cost_usd": 284.30,
        "total_requests": 12340,
        "total_tokens": 18500000,
        "active_agents": 7,
        "avg_cost_per_request": 0.023,
        "error_rate_pct": 1.8
    },
    "timeseries": [
        { "timestamp": "2026-03-15T00:00:00Z", "cost_usd": 12.47, "requests": 540 },
        { "timestamp": "2026-03-15T01:00:00Z", "cost_usd": 8.23, "requests": 380 }
    ],
    "by_agent": [
        { "agent_id": "uuid", "agent_name": "support-agent", "cost_usd": 127.50, "pct": 44.8 }
    ],
    "by_provider": [
        { "provider": "openai", "cost_usd": 190.48, "pct": 67.0 }
    ],
    "by_model": [
        { "model": "gpt-4o", "provider": "openai", "cost_usd": 156.20, "pct": 54.9 }
    ],
    "by_team": [
        { "team_label": "backend", "cost_usd": 128.30, "pct": 45.1 }
    ]
}
```

---

## 9. POST /v1/alerts — Créer une alert rule

### Auth : JWT | Plan : Starter+

### Request

```json
{
    "name": "Daily cost alert",
    "agent_id": "uuid",
    "metric": "cost_daily",
    "threshold": 20.00,
    "channel": "both",
    "slack_webhook": "https://hooks.slack.com/services/xxx",
    "cooldown_minutes": 60
}
```

### Response 201

```json
{
    "id": "uuid",
    "name": "Daily cost alert",
    "agent_id": "uuid",
    "metric": "cost_daily",
    "threshold": 20.00,
    "channel": "both",
    "cooldown_minutes": 60,
    "is_active": true,
    "created_at": "2026-03-15T14:00:00Z"
}
```

---

## 10. GET /v1/alerts

Liste des alert rules.

### Auth : JWT | Plan : Starter+

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "name": "Daily cost alert",
            "agent_id": "uuid",
            "agent_name": "support-agent",
            "metric": "cost_daily",
            "threshold": 20.00,
            "channel": "both",
            "is_active": true,
            "last_triggered": "2026-03-14T18:30:00Z",
            "cooldown_minutes": 60,
            "created_at": "2026-03-10T10:00:00Z"
        }
    ],
    "pagination": { ... }
}
```

---

## 11. GET /v1/alerts/history

Historique des alertes déclenchées.

### Auth : JWT | Plan : Starter+

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "alert_rule_id": "uuid",
            "alert_name": "Daily cost alert",
            "agent_name": "support-agent",
            "metric": "cost_daily",
            "triggered_value": 23.47,
            "threshold": 20.00,
            "channel": "email",
            "smart_diagnosis": "Step 4 is using gpt-4o with unusually long prompts...",
            "suggested_fix": "Switch step 4 to gpt-4o-mini or reduce prompt context.",
            "sent_at": "2026-03-15T14:23:01Z"
        }
    ],
    "pagination": { ... }
}
```

---

## 12. POST /v1/budgets — Créer un budget cap

### Auth : JWT (admin+) | Plan : Pro+

### Request

```json
{
    "agent_id": "uuid",
    "max_usd": 50.00,
    "period": "monthly",
    "action": "freeze"
}
```

`agent_id` = null pour un cap global (tous les agents).

### Response 201

```json
{
    "id": "uuid",
    "agent_id": "uuid",
    "agent_name": "support-agent",
    "max_usd": 50.00,
    "period": "monthly",
    "action": "freeze",
    "current_usd": 0.00,
    "percentage": 0.0,
    "is_frozen": false,
    "created_at": "2026-03-15T14:00:00Z"
}
```

---

## 13. GET /v1/forecasts

Projections de coûts fin de mois.

### Auth : JWT | Plan : Starter+

### Response 200

```json
{
    "organization": {
        "projected_eom_usd": 847.00,
        "confidence_low": 720.00,
        "confidence_high": 974.00,
        "current_month_usd": 284.30,
        "days_elapsed": 15,
        "days_remaining": 16,
        "calculated_at": "2026-03-15T14:00:00Z"
    },
    "by_agent": [
        {
            "agent_id": "uuid",
            "agent_name": "support-agent",
            "projected_eom_usd": 340.00,
            "pct_of_total": 40.1
        }
    ]
}
```

---

## 14. GET /v1/recommendations

Recommandations Cost Autopilot.

### Auth : JWT | Plan : Pro+

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "agent_id": "uuid",
            "agent_name": "support-agent",
            "current_model": "gpt-4o",
            "suggested_model": "gpt-4o-mini",
            "current_cost_per_call": 0.034,
            "suggested_cost_per_call": 0.011,
            "estimated_monthly_savings_usd": 85.00,
            "savings_pct": 67.0,
            "reasoning": "68% of calls are simple classification tasks...",
            "affected_calls_pct": 68.0,
            "is_dismissed": false,
            "generated_at": "2026-03-11T03:00:00Z"
        }
    ]
}
```

---

# MODULE REPLAY

## 15. GET /v1/sessions

Liste des sessions.

### Auth : JWT | Plan : Starter+

### Query params

| Param | Type | Description |
|-------|------|-------------|
| page, per_page | int | Pagination |
| range | string | "today" / "7d" / "30d" / "custom" |
| start, end | datetime | Période custom |
| agent_id | uuid | Filtrer par agent |
| status | string | "success" / "error" / "partial" / "running" |
| search | string | Recherche par session_id |
| min_cost | float | Coût minimum |
| max_cost | float | Coût maximum |

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "session_id": "ticket-123",
            "agents": ["classifier", "responder", "summarizer"],
            "total_steps": 12,
            "total_cost_usd": 0.47,
            "total_tokens": 15600,
            "status": "success",
            "duration_ms": 263000,
            "started_at": "2026-03-15T14:18:38Z",
            "ended_at": "2026-03-15T14:23:01Z"
        }
    ],
    "pagination": { ... }
}
```

---

## 16. GET /v1/sessions/:session_id

Timeline step-by-step d'une session.

### Auth : JWT ou share_token | Plan : Starter+

### Response 200

```json
{
    "session_id": "ticket-123",
    "status": "success",
    "total_cost_usd": 0.47,
    "total_tokens": 15600,
    "total_steps": 12,
    "duration_ms": 263000,
    "started_at": "2026-03-15T14:18:38Z",
    "ended_at": "2026-03-15T14:23:01Z",
    "agents_involved": ["classifier", "responder", "summarizer"],
    "steps": [
        {
            "event_id": "uuid",
            "step": 1,
            "step_name": "classify",
            "agent": "classifier",
            "model": "gpt-4o-mini",
            "input_redacted": "Customer says: I need help with [REDACTED:email]...",
            "output_redacted": "Category: billing_inquiry",
            "input_tokens": 120,
            "output_tokens": 8,
            "cost_usd": 0.001,
            "duration_ms": 320,
            "status": "success",
            "pii_detected": ["email"],
            "guardrail_violations": [],
            "tracked_at": "2026-03-15T14:18:38Z"
        },
        {
            "event_id": "uuid",
            "step": 2,
            "step_name": "retrieve_context",
            "agent": "responder",
            "model": "gpt-4o",
            "input_redacted": "Retrieve billing FAQ for category: billing_inquiry",
            "output_redacted": "FAQ content: ...",
            "input_tokens": 450,
            "output_tokens": 1200,
            "cost_usd": 0.018,
            "duration_ms": 2100,
            "status": "success",
            "pii_detected": [],
            "guardrail_violations": [],
            "tracked_at": "2026-03-15T14:18:39Z"
        }
    ]
}
```

**Note :** `input_text` et `output_text` (versions non-redactées) ne sont inclus QUE si `store_original=true` ET le user est owner/admin. Sinon seuls `input_redacted` et `output_redacted` sont retournés.

---

## 17. POST /v1/sessions/:session_id/share

Générer un lien de partage pour une session.

### Auth : JWT (admin+) | Plan : Pro+

### Request

```json
{
    "expires_in": "24h"
}
```

`expires_in` : "1h" / "24h" / "7d" / "never"

### Response 201

```json
{
    "share_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890-xK4fMn2p",
    "share_url": "https://app.agentshield.io/share/a1b2c3d4-e5f6-7890-abcd-ef1234567890-xK4fMn2p",
    "expires_at": "2026-03-16T14:23:01Z",
    "created_at": "2026-03-15T14:23:01Z"
}
```

---

# MODULE PROTECT

## 18. POST /v1/guardrails — Créer une règle

### Auth : JWT (admin+) | Plan : Pro+

### Request

```json
{
    "name": "No competitor mentions",
    "agent_id": null,
    "type": "keyword",
    "config": {
        "keywords": ["competitor_name", "rival_product"],
        "case_sensitive": false
    },
    "action": "block"
}
```

### Types de config

```json
// keyword
{ "keywords": ["word1", "word2"], "case_sensitive": false }

// topic
{ "topics": ["politics", "religion", "adult_content"] }

// regex
{ "pattern": "\\b(password|secret|api_key)\\b", "flags": "i" }

// category
{ "categories": ["hate_speech", "self_harm", "illegal"] }
```

### Response 201

```json
{
    "id": "uuid",
    "name": "No competitor mentions",
    "agent_id": null,
    "type": "keyword",
    "config": { ... },
    "action": "block",
    "is_active": true,
    "created_at": "2026-03-15T14:00:00Z"
}
```

---

## 19. GET /v1/guardrails

Liste des guardrail rules.

### Auth : JWT | Plan : Pro+

---

## 20. GET /v1/violations

Historique des violations de guardrails.

### Auth : JWT | Plan : Pro+

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "guardrail_id": "uuid",
            "guardrail_name": "No competitor mentions",
            "event_id": "uuid",
            "agent_name": "chatbot",
            "session_id": "sess-456",
            "matched_content": "competitor_name",
            "action_taken": "blocked",
            "created_at": "2026-03-15T14:23:01Z"
        }
    ],
    "pagination": { ... }
}
```

---

## 21. PUT /v1/pii — Configurer PII redaction

### Auth : JWT (admin+) | Plan : Pro+

### Request

```json
{
    "patterns_enabled": ["email", "phone", "credit_card", "ssn"],
    "custom_patterns": [
        { "name": "employee_id", "pattern": "EMP-\\d{6}" }
    ],
    "action": "redact",
    "store_original": false
}
```

### Response 200

```json
{
    "patterns_enabled": ["email", "phone", "credit_card", "ssn"],
    "custom_patterns": [
        { "name": "employee_id", "pattern": "EMP-\\d{6}" }
    ],
    "action": "redact",
    "store_original": false,
    "updated_at": "2026-03-15T14:00:00Z"
}
```

---

# TRANSVERSAL

## 22. POST /v1/api-keys — Créer une API key

### Auth : JWT (admin+)

### Request

```json
{
    "name": "Production Key"
}
```

### Response 201

```json
{
    "id": "uuid",
    "name": "Production Key",
    "key": "ags_live_xK4fMn2pR7bT9cW1dE3fG5hJ8kL0mN4",
    "key_prefix": "ags_live_xK4f",
    "created_at": "2026-03-15T14:00:00Z"
}
```

**⚠️ `key` est affiché UNE SEULE FOIS dans cette réponse. Il n'est jamais retourné par la suite.**

---

## 23. GET /v1/api-keys

Liste des API keys (sans la clé complète).

### Auth : JWT

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "name": "Production Key",
            "key_prefix": "ags_live_xK4f",
            "is_active": true,
            "last_used_at": "2026-03-15T14:23:01Z",
            "created_at": "2026-03-15T14:00:00Z"
        }
    ]
}
```

---

## 24. DELETE /v1/api-keys/:id — Révoquer

### Auth : JWT (admin+)

### Response 200

```json
{
    "id": "uuid",
    "name": "Production Key",
    "is_active": false,
    "revoked_at": "2026-03-15T15:00:00Z"
}
```

---

## 25. POST /v1/webhooks — Créer un webhook endpoint

### Auth : JWT (admin+) | Plan : Pro+

### Request

```json
{
    "url": "https://myapp.com/agentshield-webhook",
    "events": ["alert.fired", "anomaly.detected", "budget.exceeded"]
}
```

### Response 201

```json
{
    "id": "uuid",
    "url": "https://myapp.com/agentshield-webhook",
    "events": ["alert.fired", "anomaly.detected", "budget.exceeded"],
    "secret": "whsec_xK4fMn2pR7bT9cW1dE3f...",
    "is_active": true,
    "created_at": "2026-03-15T14:00:00Z"
}
```

**⚠️ `secret` est affiché UNE SEULE FOIS.**

---

## 26. POST /v1/billing/checkout — Créer une session Stripe

### Auth : JWT (owner)

### Request

```json
{
    "plan": "pro",
    "success_url": "https://app.agentshield.io/dashboard/settings?billing=success",
    "cancel_url": "https://app.agentshield.io/dashboard/settings?billing=cancel"
}
```

### Response 200

```json
{
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_xxx",
    "session_id": "cs_xxx"
}
```

---

## 27. POST /v1/billing/portal — Ouvrir le Stripe Portal

### Auth : JWT (owner)

### Response 200

```json
{
    "portal_url": "https://billing.stripe.com/p/session/xxx"
}
```

---

## 28. POST /v1/billing/webhooks — Stripe webhooks (entrant)

### Auth : Stripe signature verification (pas de JWT)

Événements gérés :
- `checkout.session.completed` → activer le plan
- `invoice.paid` → renouvellement OK
- `invoice.payment_failed` → grace period
- `customer.subscription.updated` → upgrade/downgrade
- `customer.subscription.deleted` → retour Free

### Response 200

```json
{ "received": true }
```

---

## 29. GET /v1/audit

Audit log (actions administratives).

### Auth : JWT | Plan : Team

### Query params

| Param | Type | Description |
|-------|------|-------------|
| page, per_page | int | Pagination |
| user_id | uuid | Filtrer par user |
| action | string | Filtrer par type d'action |
| resource_type | string | Filtrer par type de resource |
| start, end | datetime | Période |

### Response 200

```json
{
    "data": [
        {
            "id": "uuid",
            "user_email": "alice@team.com",
            "action": "api_key.created",
            "resource_type": "api_key",
            "resource_id": "uuid",
            "details": { "key_name": "Production Key" },
            "ip_address": "203.0.113.42",
            "created_at": "2026-03-15T14:23:01Z"
        }
    ],
    "pagination": { ... }
}
```

---

## 30. POST /v1/agents/:id/kill-switch

Activer/désactiver le kill switch d'un agent.

### Auth : JWT (admin+) | Plan : Pro+

### Request

```json
{
    "enabled": true
}
```

### Response 200

```json
{
    "agent_id": "uuid",
    "agent_name": "support-agent",
    "is_frozen": true,
    "frozen_by": "kill_switch",
    "frozen_at": "2026-03-15T14:23:01Z"
}
```

---

## 31. GET /v1/teams/attribution

Cost attribution par équipe.

### Auth : JWT | Plan : Team

### Response 200

```json
{
    "period": "2026-03",
    "total_cost_usd": 284.30,
    "teams": [
        {
            "team_label": "backend",
            "members": 4,
            "agents": 5,
            "cost_usd": 128.30,
            "pct": 45.1,
            "trend_pct": 12.0
        },
        {
            "team_label": "ml-team",
            "members": 3,
            "agents": 8,
            "cost_usd": 91.20,
            "pct": 32.1,
            "trend_pct": -8.0
        }
    ]
}
```

---

## 32. WS /ws/dashboard — WebSocket temps réel

### Auth : JWT (envoyé dans le premier message)

### Connect

```json
{ "type": "auth", "token": "eyJhbGciOi..." }
```

### Server events

```json
{ "type": "new_event", "data": { "event_id": "uuid", "agent": "support-agent", "cost_usd": 0.034 } }
{ "type": "alert_fired", "data": { "alert_name": "Daily cost", "agent": "support-agent", "value": 23.47 } }
{ "type": "smart_alert", "data": { "alert_id": "uuid", "diagnosis": "...", "suggested_fix": "..." } }
{ "type": "anomaly", "data": { "agent": "support-agent", "metric": "cost_hourly", "value": 34.21, "normal": 4.80 } }
{ "type": "budget_warning", "data": { "agent": "support-agent", "percentage": 85 } }
{ "type": "budget_frozen", "data": { "agent": "support-agent", "current_usd": 52.30, "max_usd": 50.00 } }
{ "type": "session_update", "data": { "session_id": "ticket-123", "total_steps": 5, "status": "running" } }
{ "type": "violation", "data": { "rule_name": "No competitors", "agent": "chatbot", "action": "blocked" } }
{ "type": "pii_detected", "data": { "agent": "support-agent", "types": ["email", "phone"] } }
{ "type": "report_ready", "data": { "report_id": "uuid", "download_url": "..." } }
```

### Heartbeat

```json
// Server → Client toutes les 30s
{ "type": "ping" }

// Client → Server
{ "type": "pong" }
```

---

## 33. GET /health

Health check (pas d'auth).

### Response 200

```json
{
    "status": "ok",
    "timestamp": "2026-03-15T14:23:01Z",
    "services": {
        "database": "ok",
        "redis": "ok",
        "celery": "ok"
    }
}
```

### Response 503

```json
{
    "status": "degraded",
    "timestamp": "2026-03-15T14:23:01Z",
    "services": {
        "database": "ok",
        "redis": "error",
        "celery": "ok"
    }
}
```

---

> **Règle :** Chaque endpoint ajouté au code DOIT être documenté ici.
> Les payloads de ce fichier sont le contrat avec les utilisateurs du SDK — ils ne changent jamais de manière breaking sans incrément de version API.
