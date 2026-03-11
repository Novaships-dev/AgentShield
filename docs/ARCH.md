# ARCH.md — Architecture technique AgentCostGuard

> Ce fichier définit l'architecture complète du projet. Claude Code le lit avant toute tâche qui touche à la structure du code, aux endpoints, à la base de données, ou aux interactions entre services.
> Cohérent avec : CONTEXT.md (source de vérité projet)
> Dernière mise à jour : mars 2026

---

## 1. VUE D'ENSEMBLE

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                             │
│                                                                 │
│   Développeur avec SDK Python    │    Développeur avec API      │
│   pip install agentcostguard     │    POST /v1/track            │
└──────────────┬───────────────────┴──────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (FastAPI)                       │
│                      api.agentcostguard.io                       │
│                      Port 8000 — Railway                         │
│                                                                  │
│  /v1/track           → Ingestion des événements de coût          │
│  /v1/agents          → CRUD agents                               │
│  /v1/analytics       → Données agrégées pour le dashboard        │
│  /v1/alerts          → Gestion des seuils et alertes             │
│  /v1/budgets         → Budget caps et auto-freeze                │
│  /v1/forecasts       → Projections de coûts                      │
│  /v1/sessions        → Session/workflow costing                  │
│  /v1/recommendations → Optimisations IA (Claude API)             │
│  /v1/reports         → Génération de rapports PDF                │
│  /v1/billing         → Stripe webhooks + gestion abonnement      │
│  /v1/auth            → Proxy vers Supabase Auth                  │
│  /v1/api-keys        → Création / révocation des API keys        │
│  /v1/webhooks        → Gestion webhooks sortants                 │
│  /v1/audit           → Audit log (Team)                          │
│  /v1/teams           → Team management + cost attribution        │
│  /v1/slack           → Slack OAuth + slash commands              │
│  /ws/dashboard       → WebSocket temps réel                      │
└──────┬──────────┬──────────────────┬──────────────┬─────────────┘
       │          │                  │              │
       ▼          ▼                  ▼              ▼
┌───────────┐ ┌────────────┐ ┌───────────────┐ ┌─────────────────┐
│ Supabase  │ │   Redis    │ │Celery Workers │ │Services externes│
│ PostgreSQL│ │ Cache +    │ │  Railway      │ │                 │
│           │ │ Broker +   │ │               │ │ Stripe          │
│ 14 tables │ │ Pub/Sub    │ │ Alerts        │ │ Brevo           │
│ RLS activé│ │            │ │ Aggregation   │ │ Slack API       │
│           │ │ Rate limits│ │ Anomaly detect│ │ Claude API      │
│           │ │ Cache prix │ │ Forecast calc │ │ Sentry          │
│           │ │ WS pub/sub │ │ PDF reports   │ │ Plausible       │
│           │ │ Budget ctrs│ │ Recommendations│ │                │
│           │ │ Session agg│ │ Cleanup       │ │                 │
│           │ │            │ │ Webhook dispatch││                │
└───────────┘ └────────────┘ └───────────────┘ └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                        │
│                     app.agentcostguard.io                         │
│                     Vercel                                        │
│                                                                  │
│  /                       → Landing page + pricing                │
│  /login                  → Auth (Supabase)                       │
│  /signup                 → Onboarding guidé interactif           │
│  /dashboard              → Vue principale (coûts temps réel WS)  │
│  /dashboard/agents       → Liste et détail par agent             │
│  /dashboard/agents/[id]  → Détail agent + forecast + recomm.    │
│  /dashboard/sessions     → Coût par session/workflow             │
│  /dashboard/alerts       → Configuration seuils + anomaly rules  │
│  /dashboard/budgets      → Budget caps par agent                 │
│  /dashboard/forecast     → Projection fin de mois               │
│  /dashboard/reports      → Rapports PDF                          │
│  /dashboard/team         → Cost attribution par équipe (Team)    │
│  /dashboard/audit        → Audit log (Team)                      │
│  /dashboard/settings     → Profil, API keys, billing, webhooks   │
│  /dashboard/customize    → Dashboard drag-and-drop (Team)        │
│  /docs                   → Documentation publique SDK + API      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. STRUCTURE DU MONOREPO

```
agentcostguard/
│
├── docs/                          ← Documentation projet (25 fichiers)
├── skills/                        ← Skills Claude Code (17 fichiers)
│
├── backend/                       ← FastAPI — Python 3.12+
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               ← Point d'entrée FastAPI, CORS, middleware
│   │   ├── config.py             ← Settings Pydantic (env vars)
│   │   ├── dependencies.py       ← Dépendances injectées (auth, db, rate limit)
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py          ← Router principal v1
│   │   │       ├── track.py           ← POST /v1/track — ingestion événements
│   │   │       ├── agents.py          ← CRUD agents
│   │   │       ├── analytics.py       ← Données agrégées
│   │   │       ├── alerts.py          ← Gestion seuils + alertes
│   │   │       ├── budgets.py         ← Budget caps + auto-freeze
│   │   │       ├── forecasts.py       ← Projections de coûts
│   │   │       ├── sessions.py        ← Session/workflow costing
│   │   │       ├── recommendations.py ← Optimisations IA
│   │   │       ├── reports.py         ← Génération PDF
│   │   │       ├── billing.py         ← Stripe webhooks + abonnement
│   │   │       ├── auth.py            ← Auth endpoints
│   │   │       ├── api_keys.py        ← Création / révocation API keys
│   │   │       ├── webhooks.py        ← Gestion webhooks sortants
│   │   │       ├── audit.py           ← Audit log
│   │   │       ├── teams.py           ← Team management + attribution
│   │   │       ├── slack.py           ← Slack OAuth + slash commands
│   │   │       └── ws.py             ← WebSocket endpoint
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py               ← User, Organization, Team
│   │   │   ├── agent.py              ← Agent
│   │   │   ├── event.py              ← TrackingEvent
│   │   │   ├── session.py            ← Session (workflow grouping)
│   │   │   ├── alert.py              ← Alert, AlertRule
│   │   │   ├── budget.py             ← BudgetCap, BudgetStatus
│   │   │   ├── anomaly.py            ← AnomalyBaseline, AnomalyEvent
│   │   │   ├── api_key.py            ← APIKey
│   │   │   ├── webhook.py            ← WebhookEndpoint, WebhookDelivery
│   │   │   ├── audit_log.py          ← AuditEntry
│   │   │   └── subscription.py       ← Subscription, Invoice
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── track.py              ← TrackEventRequest/Response
│   │   │   ├── agent.py              ← AgentCreate, AgentResponse
│   │   │   ├── analytics.py          ← AnalyticsQuery, AnalyticsResponse
│   │   │   ├── alert.py              ← AlertRuleCreate, AlertResponse
│   │   │   ├── budget.py             ← BudgetCapCreate, BudgetStatus
│   │   │   ├── forecast.py           ← ForecastResponse
│   │   │   ├── session.py            ← SessionCostResponse
│   │   │   ├── recommendation.py     ← RecommendationResponse
│   │   │   ├── webhook.py            ← WebhookCreate, WebhookResponse
│   │   │   ├── audit.py              ← AuditEntryResponse
│   │   │   ├── team.py               ← TeamCreate, CostAttribution
│   │   │   └── billing.py            ← SubscriptionResponse, CheckoutRequest
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── tracking.py           ← Logique d'ingestion + calcul coût
│   │   │   ├── pricing.py            ← Table des prix par modèle + calcul
│   │   │   ├── analytics.py          ← Agrégation des métriques
│   │   │   ├── alerts.py             ← Évaluation des seuils + déclenchement
│   │   │   ├── budgets.py            ← Vérification caps + auto-freeze logic
│   │   │   ├── anomaly.py            ← Baseline calculation + spike detection
│   │   │   ├── forecast.py           ← Projection linéaire + tendance
│   │   │   ├── sessions.py           ← Agrégation coûts par session
│   │   │   ├── recommendations.py    ← Appel Claude API pour optimisations
│   │   │   ├── stripe.py             ← Interaction Stripe
│   │   │   ├── brevo.py              ← Envoi d'emails
│   │   │   ├── slack.py              ← Notifications + bot interactif
│   │   │   ├── webhooks.py           ← Dispatch webhooks sortants + retry
│   │   │   ├── audit.py              ← Logging des actions
│   │   │   ├── teams.py              ← Cost attribution par team/member
│   │   │   ├── pdf.py                ← Génération rapports PDF
│   │   │   ├── onboarding.py         ← Logique onboarding guidé
│   │   │   └── api_keys.py           ← Hash, validation, rotation
│   │   │
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py         ← Config Celery + Redis broker
│   │   │   ├── tasks_alerts.py       ← Tasks : check seuils, send alerts
│   │   │   ├── tasks_anomaly.py      ← Tasks : baseline update, spike detect
│   │   │   ├── tasks_aggregation.py  ← Tasks : agrégation horaire/daily
│   │   │   ├── tasks_forecast.py     ← Tasks : recalcul projections
│   │   │   ├── tasks_recommendations.py ← Tasks : analyse Claude API async
│   │   │   ├── tasks_reports.py      ← Tasks : génération PDF async
│   │   │   ├── tasks_webhooks.py     ← Tasks : dispatch webhooks + retry
│   │   │   └── tasks_maintenance.py  ← Tasks : cleanup, sync pricing
│   │   │
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               ← Vérification JWT + API key
│   │   │   ├── rate_limit.py         ← Rate limiting par plan
│   │   │   ├── plan_limits.py        ← Vérification limites (agents, requêtes)
│   │   │   ├── budget_check.py       ← Vérification budget cap avant ingestion
│   │   │   └── audit.py              ← Auto-log des actions (Team)
│   │   │
│   │   ├── websocket/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py            ← Connection manager (par org)
│   │   │   ├── auth.py               ← Auth WebSocket (JWT token)
│   │   │   └── handlers.py           ← Message handlers (subscribe/unsubscribe)
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── supabase.py           ← Client Supabase
│   │       ├── redis.py              ← Client Redis
│   │       └── errors.py             ← Exceptions custom + handlers
│   │
│   ├── migrations/
│   │   └── ...                       ← Migrations SQL Supabase
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py               ← Fixtures pytest
│   │   ├── test_track.py
│   │   ├── test_analytics.py
│   │   ├── test_alerts.py
│   │   ├── test_budgets.py
│   │   ├── test_anomaly.py
│   │   ├── test_forecast.py
│   │   ├── test_sessions.py
│   │   ├── test_recommendations.py
│   │   ├── test_billing.py
│   │   ├── test_api_keys.py
│   │   ├── test_webhooks.py
│   │   ├── test_websocket.py
│   │   └── test_pricing.py
│   │
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                          ← Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            ← Root layout (dark mode, fonts)
│   │   │   ├── page.tsx              ← Landing page
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (onboarding)/
│   │   │   │   └── setup/page.tsx    ← Onboarding guidé step-by-step
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        ← Dashboard layout (sidebar, nav, WS)
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── dashboard/agents/page.tsx
│   │   │   │   ├── dashboard/agents/[id]/page.tsx
│   │   │   │   ├── dashboard/sessions/page.tsx
│   │   │   │   ├── dashboard/alerts/page.tsx
│   │   │   │   ├── dashboard/budgets/page.tsx
│   │   │   │   ├── dashboard/forecast/page.tsx
│   │   │   │   ├── dashboard/reports/page.tsx
│   │   │   │   ├── dashboard/team/page.tsx
│   │   │   │   ├── dashboard/audit/page.tsx
│   │   │   │   ├── dashboard/customize/page.tsx
│   │   │   │   └── dashboard/settings/page.tsx
│   │   │   └── docs/
│   │   │       └── page.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   ← shadcn/ui components
│   │   │   ├── charts/
│   │   │   │   ├── CostOverTime.tsx
│   │   │   │   ├── CostByAgent.tsx
│   │   │   │   ├── CostByProvider.tsx
│   │   │   │   ├── CostByModel.tsx
│   │   │   │   ├── ForecastChart.tsx       ← Projection avec zone de confiance
│   │   │   │   ├── AnomalyTimeline.tsx     ← Spikes détectés sur timeline
│   │   │   │   └── TeamAttribution.tsx     ← Répartition par équipe
│   │   │   ├── dashboard/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopNav.tsx
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   ├── AgentTable.tsx
│   │   │   │   ├── SessionTable.tsx
│   │   │   │   ├── AlertBanner.tsx
│   │   │   │   ├── BudgetGauge.tsx         ← Jauge visuelle budget consommé
│   │   │   │   ├── ForecastBanner.tsx      ← "Projected: $X by end of month"
│   │   │   │   ├── RecommendationCard.tsx  ← Suggestion d'optimisation
│   │   │   │   ├── AnomalyAlert.tsx        ← Notification spike détecté
│   │   │   │   └── WidgetGrid.tsx          ← Container drag-and-drop (Team)
│   │   │   ├── onboarding/
│   │   │   │   ├── StepInstallSDK.tsx
│   │   │   │   ├── StepCopyAPIKey.tsx
│   │   │   │   ├── StepSendFirstEvent.tsx
│   │   │   │   └── StepDashboardLive.tsx
│   │   │   ├── landing/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── Pricing.tsx
│   │   │   │   ├── Testimonials.tsx
│   │   │   │   └── CTA.tsx
│   │   │   └── shared/
│   │   │       ├── Logo.tsx
│   │   │       ├── ThemeProvider.tsx
│   │   │       └── LoadingSpinner.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   └── server.ts
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts          ← Client WebSocket + reconnection
│   │   │   ├── stripe.ts
│   │   │   └── utils.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useAgents.ts
│   │   │   ├── useAnalytics.ts
│   │   │   ├── useWebSocket.ts       ← Hook WebSocket avec auto-reconnect
│   │   │   ├── useForecast.ts
│   │   │   ├── useBudgets.ts
│   │   │   ├── useSessions.ts
│   │   │   └── useSubscription.ts
│   │   │
│   │   └── types/
│   │       ├── agent.ts
│   │       ├── event.ts
│   │       ├── session.ts
│   │       ├── alert.ts
│   │       ├── budget.ts
│   │       ├── forecast.ts
│   │       ├── recommendation.ts
│   │       ├── webhook.ts
│   │       ├── audit.ts
│   │       ├── team.ts
│   │       └── subscription.ts
│   │
│   ├── public/
│   │   ├── logo.svg
│   │   └── og-image.png
│   │
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── sdk/                              ← SDK Python — package PyPI
│   ├── agentcostguard/
│   │   ├── __init__.py              ← Exports publics (track, session, set_budget)
│   │   ├── client.py                ← Client HTTP (requests + retry)
│   │   ├── tracker.py               ← Décorateur @track + context manager
│   │   ├── sessions.py              ← Context manager session()
│   │   ├── budgets.py               ← set_budget() + BudgetExceededError
│   │   ├── pricing.py               ← Table prix locale (fallback)
│   │   ├── models.py                ← Dataclasses (TrackEvent, etc.)
│   │   └── exceptions.py            ← Exceptions SDK
│   │
│   ├── tests/
│   │   ├── test_tracker.py
│   │   ├── test_client.py
│   │   ├── test_sessions.py
│   │   ├── test_budgets.py
│   │   └── test_pricing.py
│   │
│   ├── pyproject.toml
│   ├── README.md
│   └── .env.example
│
├── .github/
│   └── workflows/
│       ├── ci-backend.yml
│       ├── ci-frontend.yml
│       ├── ci-sdk.yml
│       ├── deploy-backend.yml
│       ├── deploy-frontend.yml
│       └── publish-sdk.yml
│
├── .devcontainer/
│   └── devcontainer.json
│
├── .gitignore
├── README.md
└── LICENSE
```

---

## 3. SCHÉMA BASE DE DONNÉES

### Tables principales (14 tables)

```sql
-- ============================================================
-- USERS & ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    slug                   TEXT UNIQUE NOT NULL,
    plan                   TEXT NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free', 'starter', 'pro', 'team')),
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    max_agents             INT NOT NULL DEFAULT 1,
    max_requests           INT NOT NULL DEFAULT 10000,
    history_days           INT NOT NULL DEFAULT 7,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'owner'
                    CHECK (role IN ('owner', 'admin', 'member')),
    team_label      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AGENTS
-- ============================================================

CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, name)
);

-- ============================================================
-- TRACKING EVENTS — Table principale à haut volume
-- ============================================================

CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id      TEXT,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INT NOT NULL DEFAULT 0,
    output_tokens   INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    cost_usd        DECIMAL(12, 6) NOT NULL,
    workflow        TEXT,
    user_label      TEXT,
    team_label      TEXT,
    metadata        JSONB DEFAULT '{}',
    tracked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_org_time ON events (organization_id, tracked_at DESC);
CREATE INDEX idx_events_agent_time ON events (agent_id, tracked_at DESC);
CREATE INDEX idx_events_org_agent ON events (organization_id, agent_id);
CREATE INDEX idx_events_session ON events (organization_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_events_team ON events (organization_id, team_label) WHERE team_label IS NOT NULL;

-- ============================================================
-- AGRÉGATIONS — Pré-calculées par Celery
-- ============================================================

CREATE TABLE aggregations_hourly (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    hour            TIMESTAMPTZ NOT NULL,
    total_requests  INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12, 6) NOT NULL DEFAULT 0,
    UNIQUE(organization_id, agent_id, provider, model, hour)
);

CREATE TABLE aggregations_daily (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    day             DATE NOT NULL,
    total_requests  INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12, 6) NOT NULL DEFAULT 0,
    UNIQUE(organization_id, agent_id, provider, model, day)
);

-- ============================================================
-- ALERTES
-- ============================================================

CREATE TABLE alert_rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id         UUID REFERENCES agents(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    metric           TEXT NOT NULL
                     CHECK (metric IN ('cost_daily', 'cost_weekly', 'cost_monthly',
                                        'requests_daily', 'requests_hourly', 'anomaly')),
    threshold        DECIMAL(12, 2),
    channel          TEXT NOT NULL
                     CHECK (channel IN ('email', 'slack', 'both', 'webhook')),
    slack_webhook    TEXT,
    webhook_url      TEXT,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    cooldown_minutes INT NOT NULL DEFAULT 60,
    last_triggered   TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_rule_id   UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    triggered_value DECIMAL(12, 6) NOT NULL,
    threshold       DECIMAL(12, 2) NOT NULL,
    channel         TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BUDGET CAPS
-- ============================================================

CREATE TABLE budget_caps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE,
    max_usd         DECIMAL(12, 2) NOT NULL,
    period          TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    action          TEXT NOT NULL DEFAULT 'freeze'
                    CHECK (action IN ('freeze', 'alert_only')),
    current_usage   DECIMAL(12, 6) NOT NULL DEFAULT 0,
    is_frozen       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, agent_id, period)
);

-- ============================================================
-- ANOMALY DETECTION
-- ============================================================

CREATE TABLE anomaly_baselines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    metric          TEXT NOT NULL CHECK (metric IN ('cost_hourly', 'requests_hourly')),
    hour_of_day     INT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    mean            DECIMAL(12, 6) NOT NULL DEFAULT 0,
    stddev          DECIMAL(12, 6) NOT NULL DEFAULT 0,
    sample_count    INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, agent_id, metric, hour_of_day, day_of_week)
);

-- ============================================================
-- API KEYS
-- ============================================================

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL,
    key_prefix      TEXT NOT NULL,
    last_used_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WEBHOOKS SORTANTS
-- ============================================================

CREATE TABLE webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    events          TEXT[] NOT NULL DEFAULT '{}',
    secret          TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id     UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status_code     INT,
    attempt         INT NOT NULL DEFAULT 1,
    next_retry_at   TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG (Team plan)
-- ============================================================

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id),
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     UUID,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org_time ON audit_log (organization_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregations_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregations_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Pattern RLS : l'utilisateur ne voit que les données de son organization
-- Voir SECURITY.md pour les policies complètes
```

---

## 4. FLUX DE DONNÉES

### 4.1 — Ingestion d'un événement (POST /v1/track)

```
SDK/API → FastAPI
    │
    ├── 1. Valider API key (middleware auth)
    │      → Redis cache pour éviter un hit DB à chaque requête
    │
    ├── 2. Vérifier budget cap (middleware budget_check)
    │      → Redis counter : usage actuel vs max_usd
    │      → Si frozen → retourner 429 + BudgetExceededError
    │
    ├── 3. Vérifier limites du plan (middleware plan_limits)
    │      → Redis counter : requêtes ce mois / max autorisé
    │
    ├── 4. Valider le payload (schema Pydantic)
    │
    ├── 5. Calculer le coût si non fourni
    │      → services/pricing.py : lookup modèle → prix par token
    │      → Redis cache de la table de prix (TTL 1h)
    │
    ├── 6. Auto-créer l'agent si nouveau nom
    │      → INSERT ... ON CONFLICT DO NOTHING
    │
    ├── 7. Insérer l'événement dans la table events
    │      → Supabase direct insert
    │
    ├── 8. Mettre à jour le budget counter dans Redis
    │      → INCRBYFLOAT budget:{org}:{agent}:{period}
    │
    ├── 9. Publier sur Redis Pub/Sub pour WebSocket
    │      → Channel : ws:{organization_id}
    │      → Le frontend reçoit l'event en temps réel
    │
    ├── 10. Dispatch tasks Celery (async, ne bloque pas) :
    │       → check_alert_thresholds
    │       → check_anomaly (compare à la baseline)
    │       → dispatch_webhooks (si configurés)
    │
    └── 11. Retourner 201 + event_id + cost calculé
            → Latence cible : < 50ms p95
```

### 4.2 — Anomaly detection (Celery task)

```
check_anomaly(organization_id, agent_id, event)
    │
    ├── 1. Charger la baseline pour cet agent/heure/jour
    │      → anomaly_baselines table
    │
    ├── 2. Calculer le z-score de l'event actuel
    │      → z = (valeur - mean) / stddev
    │
    ├── 3. Si z > 3 (3 sigma) → anomalie détectée
    │      ├── Créer une alerte automatique
    │      ├── Publier sur WebSocket (AnomalyAlert)
    │      └── Dispatch send_alert (email/slack)
    │
    └── 4. Mettre à jour la baseline (moving average)
           → Recalcul incrémental mean + stddev
```

### 4.3 — Cost forecast (Celery scheduled task — toutes les heures)

```
calculate_forecasts(organization_id)
    │
    ├── 1. Charger les coûts daily du mois en cours
    │
    ├── 2. Calculer la tendance linéaire (linear regression)
    │
    ├── 3. Projeter jusqu'à fin de mois
    │      → projected_total = current_total + (daily_avg * jours_restants)
    │
    ├── 4. Calculer intervalle de confiance (±15%)
    │
    ├── 5. Stocker dans Redis (TTL 1h)
    │      → forecast:{org_id} = {projected, confidence_low, confidence_high}
    │
    └── 6. Si projected > budget mensuel → alerte proactive
```

### 4.4 — WebSocket temps réel

```
Frontend (dashboard) ←→ FastAPI WebSocket /ws/dashboard
    │
    ├── 1. Connection : client envoie JWT token
    │      → Vérification auth → extraction org_id
    │
    ├── 2. Subscribe : client rejoint le channel Redis ws:{org_id}
    │
    ├── 3. Events reçus en temps réel :
    │      ├── new_event     → nouveau tracking event
    │      ├── alert_fired   → alerte déclenchée
    │      ├── anomaly       → spike détecté
    │      ├── budget_warning → cap bientôt atteint
    │      └── budget_frozen → agent auto-freeze
    │
    ├── 4. Reconnection automatique côté client
    │      → Exponential backoff + fallback polling
    │
    └── 5. Heartbeat toutes les 30s pour garder la connexion
```

### 4.5 — Dashboard analytics (GET /v1/analytics)

```
Frontend → FastAPI /v1/analytics
    │
    ├── 1. Auth JWT (Supabase token)
    │
    ├── 2. Parser les filtres (date range, agent, provider, model, team)
    │
    ├── 3. Query les tables d'agrégation (pas events directement)
    │      → aggregations_daily pour les vues > 24h
    │      → aggregations_hourly pour les vues < 24h
    │      → events uniquement pour le temps réel (dernière heure)
    │
    ├── 4. Formater la réponse
    │      → Séries temporelles pour les graphiques
    │      → Totaux pour les KPI cards
    │      → Top agents / modèles / providers
    │      → Répartition par team (si Team plan)
    │
    └── 5. Retourner JSON
            → Redis cache 30s pour les requêtes identiques
```

---

## 5. AUTHENTIFICATION — TRIPLE SYSTÈME

```
┌──────────────────────────────────────────────────┐
│              FRONTEND (Dashboard)                  │
│                                                    │
│  Auth : Supabase JWT                               │
│  Flow : login → Supabase Auth → JWT → header       │
│  Utilisé pour : dashboard, settings, billing       │
│  Middleware : verify_jwt()                          │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              SDK / API DIRECTE                     │
│                                                    │
│  Auth : API Key (Bearer token)                     │
│  Flow : user crée une key → key_hash en DB         │
│  Utilisé pour : POST /v1/track uniquement          │
│  Middleware : verify_api_key()                      │
│  Stockage : SHA-256 hash en DB, jamais en clair    │
│  Format : acg_live_xxxxxxxxxxxxxxxxxxxx            │
│  Prefix visible : acg_live_xxxx (pour identification)│
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              WEBSOCKET                             │
│                                                    │
│  Auth : JWT envoyé à la connexion                  │
│  Flow : connect → send JWT → verify → subscribe    │
│  Utilisé pour : dashboard temps réel               │
│  Middleware : verify_ws_token()                     │
└──────────────────────────────────────────────────┘
```

---

## 6. RATE LIMITING

```
Par plan, via Redis sliding window :

| Plan    | POST /v1/track | Dashboard API  | WebSocket msgs |
|---------|----------------|----------------|----------------|
| Free    | 100/min        | 30/min         | 10/min         |
| Starter | 500/min        | 60/min         | 30/min         |
| Pro     | 2000/min       | 120/min        | 60/min         |
| Team    | 5000/min       | 200/min        | 120/min        |

Header de réponse :
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1711234567
```

---

## 7. CACHING STRATEGY

```
Redis est utilisé pour 7 choses :

1. PRICING TABLE
   Key   : pricing:{provider}:{model}
   Value : {input_per_token, output_per_token}
   TTL   : 1 heure

2. API KEY VALIDATION
   Key   : apikey:{key_hash}
   Value : {organization_id, plan, is_active}
   TTL   : 5 minutes

3. RATE LIMIT COUNTERS
   Key   : ratelimit:{org_id}:{endpoint}:{window}
   Value : counter
   TTL   : durée de la window (1 min)

4. BUDGET COUNTERS
   Key   : budget:{org_id}:{agent_id}:{period}
   Value : current_usage (float)
   TTL   : durée du period (1 day / 1 week / 1 month)

5. FORECAST CACHE
   Key   : forecast:{org_id}
   Value : {projected, confidence_low, confidence_high, calculated_at}
   TTL   : 1 heure

6. ANALYTICS CACHE
   Key   : analytics:{org_id}:{query_hash}
   Value : JSON réponse
   TTL   : 30 secondes

7. WEBSOCKET PUB/SUB
   Channel : ws:{org_id}
   Messages : new_event, alert_fired, anomaly, budget_warning
```

---

## 8. PATTERN MULTI-TENANT

```
Toute donnée est scopée par organization_id.

Règles :
- Chaque user appartient à exactement 1 organization
- Chaque requête DB inclut un filtre organization_id
- RLS Supabase appliqué sur TOUTES les tables (14 tables)
- Le plan Free crée automatiquement une organization (1 user = 1 org)
- Le plan Team permet d'inviter des membres dans la même org
- Un user ne peut JAMAIS voir les données d'une autre org
- Le team_label sur users et events permet l'attribution par équipe

Hiérarchie :
Organization
    ├── Users (owner, admin, member) — avec team_label
    ├── Agents
    ├── Events (avec session_id et team_label)
    ├── Sessions (agrégées depuis events)
    ├── Alert Rules
    ├── Budget Caps
    ├── Anomaly Baselines
    ├── API Keys
    ├── Webhook Endpoints
    ├── Audit Log
    └── Subscription
```

---

## 9. ENVIRONNEMENTS

```
┌─────────────┬─────────────────┬─────────────────┬──────────────────┐
│             │ Development     │ Staging         │ Production       │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Backend     │ localhost:8000  │ staging-api.    │ api.             │
│             │                 │ agentcostguard  │ agentcostguard   │
│             │                 │ .io             │ .io              │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Frontend    │ localhost:3000  │ staging-app.    │ app.             │
│             │                 │ agentcostguard  │ agentcostguard   │
│             │                 │ .io             │ .io              │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ WebSocket   │ ws://localhost  │ wss://staging-  │ wss://api.       │
│             │ :8000/ws        │ api.../ws       │ .../ws           │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Database    │ Supabase local  │ Supabase        │ Supabase         │
│             │ (Docker)        │ projet staging  │ projet prod      │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Redis       │ localhost:6379  │ Railway Redis   │ Railway Redis    │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Stripe      │ Test mode       │ Test mode       │ Live mode        │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Slack       │ Test workspace  │ Test workspace  │ Production       │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Brevo       │ Sandbox         │ Sandbox         │ Production       │
└─────────────┴─────────────────┴─────────────────┴──────────────────┘
```

---

## 10. DÉCISIONS ARCHITECTURALES

### Pourquoi un monorepo ?
Un seul repo avec backend/, frontend/, sdk/. Plus simple à gérer pour une équipe de 1. Les types sont partagés, les deploys sont synchronisés, Claude Code a tout le contexte en un seul endroit.

### Pourquoi des agrégations pré-calculées ?
La table events va grossir vite (100K+ lignes/mois dès le début). Querier directement pour le dashboard serait lent. Les agrégations horaires et daily sont calculées par Celery toutes les 5 minutes.

### Pourquoi WebSocket + Redis Pub/Sub ?
Le dashboard doit montrer les events en temps réel sans polling. Redis Pub/Sub est le bridge entre le worker qui insère l'event et le WebSocket qui le pousse au frontend. Chaque org a son channel pour l'isolation.

### Pourquoi z-score pour l'anomaly detection ?
C'est simple, efficace, et ne nécessite pas de ML. Un z-score > 3 (3 sigma) capture les vrais spikes sans trop de faux positifs. La baseline se met à jour en continu (moving average) pour s'adapter aux patterns de chaque agent.

### Pourquoi le budget check dans un middleware ?
Le check doit se faire AVANT l'insertion de l'event, pas après. C'est un middleware qui bloque la requête si le budget est atteint. Le counter Redis est atomique (INCRBYFLOAT) pour éviter les race conditions.

### Pourquoi pas de proxy ?
Notre position marché est d'être simple et non-intrusif. Un proxy crée un point de défaillance, complexifie le setup, et nous met en compétition directe avec Helicone/Portkey. On track les métadonnées, pas le trafic.

### Pourquoi Supabase Auth plutôt que custom ?
C'est le launch — on ne reinvente pas l'auth. Supabase Auth gère email + Google OAuth + JWT + RLS. On peut migrer plus tard si nécessaire.

### Pourquoi Celery + Redis plutôt que des background tasks FastAPI ?
Les alertes, anomalies, forecasts et agrégations doivent survivre à un restart du serveur. Celery avec Redis comme broker donne de la fiabilité, du retry, du scheduling (beat pour les tâches périodiques).

---

## 11. CONTRAINTES DE PERFORMANCE

```
Endpoint POST /v1/track :
    - Latence p50 : < 30ms
    - Latence p95 : < 50ms
    - Latence p99 : < 100ms
    - Throughput : 5000 req/s par instance

Dashboard API :
    - Latence p50 : < 200ms
    - Latence p95 : < 500ms

WebSocket :
    - Délai event → dashboard : < 500ms
    - Max connexions par instance : 1000

Agrégations Celery :
    - Fréquence : toutes les 5 minutes
    - Durée max : < 30s par run

Anomaly detection :
    - Délai event → anomaly check : < 10s

Forecast :
    - Recalcul : toutes les heures
    - Durée max : < 5s par org

Alertes :
    - Délai entre dépassement et notification : < 2 minutes

Budget check :
    - Latence ajoutée au POST /v1/track : < 5ms
    - Zero race condition (Redis atomic ops)
```

---

> **Règle :** Ce fichier est la vérité sur l'architecture d'AgentCostGuard.
> Si une décision archi contredit ce fichier → mettre ce fichier à jour ET logger la décision dans CHANGELOG.md.
