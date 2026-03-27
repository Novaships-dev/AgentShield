# ARCH.md — Architecture technique AgentShield

> Ce fichier définit l'architecture complète du projet. Claude Code le lit avant toute tâche qui touche à la structure du code, aux endpoints, à la base de données, ou aux interactions entre services.
> Cohérent avec : CONTEXT.md (source de vérité projet)
> Dernière mise à jour : mars 2026

---

## 1. VUE D'ENSEMBLE

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                             │
│                                                                 │
│   SDK Python         │  Callbacks          │  API directe       │
│   @shield()          │  LangChain/CrewAI   │  POST /v1/track    │
└──────────┬───────────┴──────────┬──────────┴──────────┬─────────┘
           │                      │                     │
           ▼                      ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (FastAPI)                       │
│                      api.agentshield.one                          │
│                      Port 8000 — Railway                         │
│                                                                  │
│  ── MODULE MONITOR ──                                            │
│  /v1/track           → Ingestion des événements de coût          │
│  /v1/agents          → CRUD agents                               │
│  /v1/analytics       → Données agrégées pour le dashboard        │
│  /v1/alerts          → Gestion des seuils et alertes             │
│  /v1/budgets         → Budget caps et kill switch                │
│  /v1/forecasts       → Projections de coûts                      │
│  /v1/recommendations → Cost Autopilot (Claude API)               │
│  /v1/reports         → Génération de rapports PDF                │
│                                                                  │
│  ── MODULE REPLAY ──                                             │
│  /v1/sessions        → Liste et détail des sessions              │
│  /v1/sessions/:id    → Timeline step-by-step                     │
│  /v1/sessions/:id/share → Générer URL de partage                 │
│  /v1/steps           → Détail d'un step individuel               │
│                                                                  │
│  ── MODULE PROTECT ──                                            │
│  /v1/guardrails      → CRUD règles de protection                 │
│  /v1/pii             → Config PII redaction                      │
│  /v1/violations      → Historique des violations détectées        │
│                                                                  │
│  ── TRANSVERSAL ──                                               │
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
│ 19 tables │ │ Pub/Sub    │ │ Alerts        │ │ Brevo           │
│ RLS activé│ │            │ │ Smart Alerts  │ │ Slack API       │
│           │ │ Rate limits│ │ Anomaly detect│ │ Claude API      │
│           │ │ Cache prix │ │ Forecast calc │ │ Sentry          │
│           │ │ WS pub/sub │ │ Cost Autopilot│ │ Plausible       │
│           │ │ Budget ctrs│ │ PDF reports   │ │                 │
│           │ │ Session agg│ │ PII scan      │ │                 │
│           │ │ Guardrail  │ │ Guardrail eval│ │                 │
│           │ │ cache      │ │ Webhook disp. │ │                 │
│           │ │            │ │ Cleanup       │ │                 │
└───────────┘ └────────────┘ └───────────────┘ └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                        │
│                     app.agentshield.one                            │
│                     Vercel — Dark mode exclusivement              │
│                                                                  │
│  /                        → Landing page + pricing               │
│  /login                   → Auth (Supabase)                      │
│  /signup                  → Onboarding guidé interactif          │
│                                                                  │
│  ── MONITOR ──                                                   │
│  /dashboard               → Vue principale (coûts temps réel WS) │
│  /dashboard/agents        → Liste et détail par agent            │
│  /dashboard/agents/[id]   → Détail agent + forecast + recomm.   │
│  /dashboard/alerts        → Configuration seuils + anomaly       │
│  /dashboard/budgets       → Budget caps par agent                │
│  /dashboard/forecast      → Projection fin de mois              │
│  /dashboard/reports       → Rapports PDF                         │
│  /dashboard/team          → Cost attribution par équipe (Team)   │
│                                                                  │
│  ── REPLAY ──                                                    │
│  /dashboard/sessions      → Liste des sessions                   │
│  /dashboard/sessions/[id] → Timeline step-by-step               │
│  /share/[token]           → Vue partagée publique (read-only)    │
│                                                                  │
│  ── PROTECT ──                                                   │
│  /dashboard/guardrails    → Config guardrails                    │
│  /dashboard/pii           → Config PII redaction                 │
│  /dashboard/violations    → Historique violations                │
│                                                                  │
│  ── TRANSVERSAL ──                                               │
│  /dashboard/audit         → Audit log (Team)                     │
│  /dashboard/customize     → Dashboard drag-and-drop (Team)       │
│  /dashboard/settings      → Profil, API keys, billing, webhooks  │
│  /docs                    → Documentation publique SDK + API     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. STRUCTURE DU MONOREPO

```
agentshield/
│
├── docs/                          ← Documentation projet (28 fichiers)
├── skills/                        ← Skills Claude Code (21 fichiers)
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
│   │   │       │
│   │   │       │── # MODULE MONITOR
│   │   │       ├── track.py           ← POST /v1/track — ingestion événements
│   │   │       ├── agents.py          ← CRUD agents
│   │   │       ├── analytics.py       ← Données agrégées
│   │   │       ├── alerts.py          ← Gestion seuils + alertes
│   │   │       ├── budgets.py         ← Budget caps + kill switch
│   │   │       ├── forecasts.py       ← Projections de coûts
│   │   │       ├── recommendations.py ← Cost Autopilot
│   │   │       ├── reports.py         ← Génération PDF
│   │   │       │
│   │   │       │── # MODULE REPLAY
│   │   │       ├── sessions.py        ← CRUD sessions + timeline
│   │   │       ├── steps.py           ← Détail steps individuels
│   │   │       ├── share.py           ← URLs de partage
│   │   │       │
│   │   │       │── # MODULE PROTECT
│   │   │       ├── guardrails.py      ← CRUD règles de protection
│   │   │       ├── pii.py             ← Config PII redaction
│   │   │       ├── violations.py      ← Historique violations
│   │   │       │
│   │   │       │── # TRANSVERSAL
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
│   │   │   ├── session.py            ← Session, Step (Replay)
│   │   │   ├── alert.py              ← Alert, AlertRule
│   │   │   ├── budget.py             ← BudgetCap, BudgetStatus
│   │   │   ├── anomaly.py            ← AnomalyBaseline, AnomalyEvent
│   │   │   ├── guardrail.py          ← GuardrailRule, Violation (Protect)
│   │   │   ├── pii.py                ← PIIConfig, PIIPattern (Protect)
│   │   │   ├── api_key.py            ← APIKey
│   │   │   ├── webhook.py            ← WebhookEndpoint, WebhookDelivery
│   │   │   ├── share.py              ← SharedSession (Replay)
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
│   │   │   ├── session.py            ← SessionResponse, StepResponse (Replay)
│   │   │   ├── recommendation.py     ← RecommendationResponse
│   │   │   ├── guardrail.py          ← GuardrailCreate, ViolationResponse
│   │   │   ├── pii.py                ← PIIConfigUpdate
│   │   │   ├── share.py              ← ShareCreate, ShareResponse
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
│   │   │   ├── smart_alerts.py       ← Diagnostic IA via Claude API
│   │   │   ├── budgets.py            ← Vérification caps + kill switch logic
│   │   │   ├── anomaly.py            ← Baseline calculation + spike detection
│   │   │   ├── forecast.py           ← Projection linéaire + tendance
│   │   │   ├── sessions.py           ← Agrégation sessions + steps (Replay)
│   │   │   ├── replay.py             ← Timeline construction + sharing (Replay)
│   │   │   ├── guardrails.py         ← Évaluation des règles (Protect)
│   │   │   ├── pii.py                ← Détection + redaction PII (Protect)
│   │   │   ├── recommendations.py    ← Cost Autopilot via Claude API
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
│   │   │   ├── tasks_smart_alerts.py ← Tasks : diagnostic IA async
│   │   │   ├── tasks_anomaly.py      ← Tasks : baseline update, spike detect
│   │   │   ├── tasks_aggregation.py  ← Tasks : agrégation horaire/daily
│   │   │   ├── tasks_forecast.py     ← Tasks : recalcul projections
│   │   │   ├── tasks_recommendations.py ← Tasks : Cost Autopilot async
│   │   │   ├── tasks_guardrails.py   ← Tasks : évaluation async des règles
│   │   │   ├── tasks_pii.py          ← Tasks : scan + redaction PII
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
│   │   │   ├── guardrail_check.py    ← Vérification guardrails avant ingestion
│   │   │   ├── pii_check.py          ← PII redaction sur les contenus
│   │   │   └── audit.py              ← Auto-log des actions (Team)
│   │   │
│   │   ├── websocket/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py            ← Connection manager (par org)
│   │   │   ├── auth.py               ← Auth WebSocket (JWT token)
│   │   │   └── handlers.py           ← Message handlers
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── supabase.py           ← Client Supabase
│   │       ├── redis.py              ← Client Redis
│   │       ├── pii_patterns.py       ← Regex patterns PII
│   │       └── errors.py             ← Exceptions custom + handlers
│   │
│   ├── migrations/
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_track.py
│   │   ├── test_analytics.py
│   │   ├── test_alerts.py
│   │   ├── test_smart_alerts.py
│   │   ├── test_budgets.py
│   │   ├── test_anomaly.py
│   │   ├── test_forecast.py
│   │   ├── test_sessions.py
│   │   ├── test_replay.py
│   │   ├── test_guardrails.py
│   │   ├── test_pii.py
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
│   │   │   ├── layout.tsx            ← Root layout (dark mode only)
│   │   │   ├── page.tsx              ← Landing page
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (onboarding)/
│   │   │   │   └── setup/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        ← Dashboard layout (sidebar, nav, WS)
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── dashboard/agents/page.tsx
│   │   │   │   ├── dashboard/agents/[id]/page.tsx
│   │   │   │   ├── dashboard/sessions/page.tsx       ← REPLAY
│   │   │   │   ├── dashboard/sessions/[id]/page.tsx  ← REPLAY
│   │   │   │   ├── dashboard/alerts/page.tsx
│   │   │   │   ├── dashboard/budgets/page.tsx
│   │   │   │   ├── dashboard/forecast/page.tsx
│   │   │   │   ├── dashboard/guardrails/page.tsx     ← PROTECT
│   │   │   │   ├── dashboard/pii/page.tsx            ← PROTECT
│   │   │   │   ├── dashboard/violations/page.tsx     ← PROTECT
│   │   │   │   ├── dashboard/reports/page.tsx
│   │   │   │   ├── dashboard/team/page.tsx
│   │   │   │   ├── dashboard/audit/page.tsx
│   │   │   │   ├── dashboard/customize/page.tsx
│   │   │   │   └── dashboard/settings/page.tsx
│   │   │   ├── share/
│   │   │   │   └── [token]/page.tsx  ← Replay partagé (public, read-only)
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
│   │   │   │   ├── ForecastChart.tsx
│   │   │   │   ├── AnomalyTimeline.tsx
│   │   │   │   └── TeamAttribution.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopNav.tsx
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   ├── AgentTable.tsx
│   │   │   │   ├── AlertBanner.tsx
│   │   │   │   ├── BudgetGauge.tsx
│   │   │   │   ├── ForecastBanner.tsx
│   │   │   │   ├── RecommendationCard.tsx
│   │   │   │   ├── SmartAlertCard.tsx      ← Diagnostic IA
│   │   │   │   ├── AnomalyAlert.tsx
│   │   │   │   └── WidgetGrid.tsx
│   │   │   ├── replay/                     ← MODULE REPLAY
│   │   │   │   ├── SessionList.tsx
│   │   │   │   ├── SessionTimeline.tsx     ← Timeline step-by-step
│   │   │   │   ├── StepDetail.tsx          ← Input/output d'un step
│   │   │   │   ├── StepCostBadge.tsx       ← Coût par step
│   │   │   │   ├── SessionStats.tsx        ← KPIs de la session
│   │   │   │   └── ShareButton.tsx
│   │   │   ├── protect/                    ← MODULE PROTECT
│   │   │   │   ├── GuardrailList.tsx
│   │   │   │   ├── GuardrailForm.tsx
│   │   │   │   ├── PIIConfig.tsx
│   │   │   │   ├── ViolationList.tsx
│   │   │   │   └── KillSwitchToggle.tsx
│   │   │   ├── onboarding/
│   │   │   │   ├── StepInstallSDK.tsx
│   │   │   │   ├── StepCopyAPIKey.tsx
│   │   │   │   ├── StepSendFirstEvent.tsx
│   │   │   │   └── StepDashboardLive.tsx
│   │   │   ├── landing/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── ModuleCards.tsx         ← Monitor / Replay / Protect
│   │   │   │   ├── Pricing.tsx
│   │   │   │   ├── Testimonials.tsx
│   │   │   │   └── CTA.tsx
│   │   │   └── shared/
│   │   │       ├── Logo.tsx
│   │   │       ├── ThemeProvider.tsx
│   │   │       ├── ModuleBadge.tsx         ← Badge "Monitor" / "Replay" / "Protect"
│   │   │       └── LoadingSpinner.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   └── server.ts
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   ├── stripe.ts
│   │   │   └── utils.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useAgents.ts
│   │   │   ├── useAnalytics.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useForecast.ts
│   │   │   ├── useBudgets.ts
│   │   │   ├── useSessions.ts          ← REPLAY
│   │   │   ├── useGuardrails.ts        ← PROTECT
│   │   │   ├── useViolations.ts        ← PROTECT
│   │   │   └── useSubscription.ts
│   │   │
│   │   └── types/
│   │       ├── agent.ts
│   │       ├── event.ts
│   │       ├── session.ts              ← REPLAY
│   │       ├── step.ts                 ← REPLAY
│   │       ├── alert.ts
│   │       ├── budget.ts
│   │       ├── forecast.ts
│   │       ├── recommendation.ts
│   │       ├── guardrail.ts            ← PROTECT
│   │       ├── violation.ts            ← PROTECT
│   │       ├── pii.ts                  ← PROTECT
│   │       ├── webhook.ts
│   │       ├── audit.ts
│   │       ├── team.ts
│   │       └── subscription.ts
│   │
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── sdk/                              ← SDK Python — package PyPI
│   ├── agentshield/
│   │   ├── __init__.py              ← Exports (shield, session, set_budget)
│   │   ├── client.py                ← Client HTTP (requests + retry)
│   │   ├── shield.py                ← Décorateur @shield + capture
│   │   ├── sessions.py              ← Context manager session()
│   │   ├── steps.py                 ← Step tracking (Replay)
│   │   ├── budgets.py               ← set_budget() + BudgetExceededError
│   │   ├── guardrails.py            ← Client-side guardrail check (Protect)
│   │   ├── pii.py                   ← Client-side PII redaction (Protect)
│   │   ├── pricing.py               ← Table prix locale (fallback)
│   │   ├── models.py                ← Dataclasses
│   │   ├── exceptions.py            ← Exceptions SDK
│   │   └── integrations/
│   │       ├── __init__.py
│   │       ├── langchain.py         ← LangChainCallback
│   │       ├── crewai.py            ← CrewAICallback
│   │       ├── autogen.py           ← AutoGenCallback
│   │       └── llamaindex.py        ← LlamaIndexCallback
│   │
│   ├── tests/
│   │   ├── test_shield.py
│   │   ├── test_client.py
│   │   ├── test_sessions.py
│   │   ├── test_budgets.py
│   │   ├── test_guardrails.py
│   │   ├── test_pii.py
│   │   ├── test_pricing.py
│   │   └── test_integrations.py
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

## 3. SCHÉMA BASE DE DONNÉES (19 tables)

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
    modules_enabled        TEXT[] NOT NULL DEFAULT '{monitor}',
    pii_redaction_enabled  BOOLEAN NOT NULL DEFAULT true,
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
    is_frozen       BOOLEAN NOT NULL DEFAULT false,
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
    step            INT,
    step_name       TEXT,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INT NOT NULL DEFAULT 0,
    output_tokens   INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    cost_usd        DECIMAL(12, 6) NOT NULL,
    input_text      TEXT,
    output_text     TEXT,
    input_redacted  TEXT,
    output_redacted TEXT,
    workflow        TEXT,
    user_label      TEXT,
    team_label      TEXT,
    status          TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
    duration_ms     INT,
    metadata        JSONB DEFAULT '{}',
    guardrail_violations JSONB DEFAULT '[]',
    tracked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_org_time ON events (organization_id, tracked_at DESC);
CREATE INDEX idx_events_agent_time ON events (agent_id, tracked_at DESC);
CREATE INDEX idx_events_org_agent ON events (organization_id, agent_id);
CREATE INDEX idx_events_session ON events (organization_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_events_team ON events (organization_id, team_label) WHERE team_label IS NOT NULL;
CREATE INDEX idx_events_status ON events (organization_id, status) WHERE status != 'success';

-- ============================================================
-- SESSIONS — Agrégation Replay
-- ============================================================

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id      TEXT NOT NULL,
    agent_ids       UUID[] NOT NULL DEFAULT '{}',
    total_steps     INT NOT NULL DEFAULT 0,
    total_cost_usd  DECIMAL(12, 6) NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    status          TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial', 'running')),
    duration_ms     INT,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',
    UNIQUE(organization_id, session_id)
);

CREATE INDEX idx_sessions_org_time ON sessions (organization_id, started_at DESC);
CREATE INDEX idx_sessions_status ON sessions (organization_id, status);

-- ============================================================
-- SHARED SESSIONS (Replay public links)
-- ============================================================

CREATE TABLE shared_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id      TEXT NOT NULL,
    share_token     TEXT UNIQUE NOT NULL,
    created_by      UUID REFERENCES auth.users(id),
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    error_count     INT NOT NULL DEFAULT 0,
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
    error_count     INT NOT NULL DEFAULT 0,
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
                                        'requests_daily', 'requests_hourly', 'anomaly',
                                        'error_rate', 'guardrail_violation')),
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
    smart_diagnosis TEXT,
    suggested_fix   TEXT,
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
    metric          TEXT NOT NULL CHECK (metric IN ('cost_hourly', 'requests_hourly', 'error_rate_hourly')),
    hour_of_day     INT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    mean            DECIMAL(12, 6) NOT NULL DEFAULT 0,
    stddev          DECIMAL(12, 6) NOT NULL DEFAULT 0,
    sample_count    INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, agent_id, metric, hour_of_day, day_of_week)
);

-- ============================================================
-- GUARDRAILS (Protect)
-- ============================================================

CREATE TABLE guardrail_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('keyword', 'topic', 'regex', 'category')),
    config          JSONB NOT NULL,
    action          TEXT NOT NULL DEFAULT 'log'
                    CHECK (action IN ('log', 'block', 'redact')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guardrail_violations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    guardrail_id    UUID NOT NULL REFERENCES guardrail_rules(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_id      TEXT,
    matched_content TEXT,
    action_taken    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_violations_org_time ON guardrail_violations (organization_id, created_at DESC);

-- ============================================================
-- PII CONFIGURATION (Protect)
-- ============================================================

CREATE TABLE pii_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patterns_enabled TEXT[] NOT NULL DEFAULT '{email,phone,credit_card,ssn}',
    custom_patterns  JSONB DEFAULT '[]',
    action          TEXT NOT NULL DEFAULT 'redact'
                    CHECK (action IN ('redact', 'hash', 'log_only')),
    store_original  BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id)
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
-- ROW LEVEL SECURITY — 19 tables
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregations_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregations_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
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
    ├── 3. Vérifier guardrails (middleware guardrail_check) [Protect]
    │      → Charger les règles actives depuis Redis cache
    │      → Évaluer input_text + output_text contre les règles
    │      → Si violation + action=block → retourner 403
    │      → Si violation + action=log → logger et continuer
    │      → Si violation + action=redact → masquer le contenu
    │
    ├── 4. PII redaction (middleware pii_check) [Protect]
    │      → Scanner input_text + output_text
    │      → Stocker la version redacted dans input_redacted / output_redacted
    │      → Si store_original=false → ne PAS stocker input_text / output_text
    │
    ├── 5. Vérifier limites du plan (middleware plan_limits)
    │
    ├── 6. Valider le payload (schema Pydantic)
    │
    ├── 7. Calculer le coût si non fourni
    │      → services/pricing.py → Redis cache (TTL 1h)
    │
    ├── 8. Auto-créer l'agent si nouveau
    │
    ├── 9. Insérer l'événement dans la table events
    │
    ├── 10. Mettre à jour/créer la session (si session_id fourni) [Replay]
    │       → UPSERT sessions : incrémenter total_steps, total_cost, etc.
    │
    ├── 11. Mettre à jour le budget counter dans Redis
    │
    ├── 12. Publier sur Redis Pub/Sub pour WebSocket
    │       → Channel : ws:{organization_id}
    │
    ├── 13. Dispatch tasks Celery (async) :
    │       → check_alert_thresholds
    │       → check_anomaly
    │       → dispatch_webhooks (si configurés)
    │       → log_guardrail_violations (si violations détectées)
    │
    └── 14. Retourner 201 + event_id + cost + budget status + violations
            → Latence cible : < 50ms p95
```

### 4.2 — Smart Alert (Celery task)

```
smart_alert_diagnosis(alert_id, organization_id)
    │
    ├── 1. Charger le contexte de l'alerte
    │      → Derniers events de l'agent, baseline, anomalie
    │
    ├── 2. Appel Claude API avec le contexte :
    │      "Alert fired: agent 'support-agent' cost $23.47 today (threshold: $20).
    │       Recent pattern: step 4 costs 3x more than usual.
    │       Last 10 events show model gpt-4o with avg 2400 input tokens.
    │       Diagnose the probable cause and suggest a fix."
    │
    ├── 3. Parser la réponse structurée
    │      → { diagnosis: "...", suggested_fix: "...", confidence: 0.85 }
    │
    ├── 4. Stocker dans alert_history (smart_diagnosis, suggested_fix)
    │
    └── 5. Inclure le diagnostic dans la notification (email/Slack)
```

### 4.3 — Replay session timeline (GET /v1/sessions/:id)

```
Frontend → FastAPI /v1/sessions/:id
    │
    ├── 1. Auth JWT (Supabase token) OU share_token (public)
    │
    ├── 2. Charger la session depuis la table sessions
    │
    ├── 3. Charger tous les events de cette session (ordonnés par step)
    │      → events WHERE session_id = :id ORDER BY step ASC, tracked_at ASC
    │
    ├── 4. Pour chaque event/step, inclure :
    │      → step number, step_name, agent, model
    │      → input_redacted (ou input_text si autorisé)
    │      → output_redacted (ou output_text si autorisé)
    │      → cost, tokens, duration, status
    │      → guardrail_violations si présentes
    │
    ├── 5. Formater en timeline ordonnée
    │
    └── 6. Retourner JSON
```

### 4.4 — Guardrail evaluation (middleware sync + Celery async)

```
Pendant l'ingestion (sync — middleware) :
    │
    ├── 1. Charger les guardrail_rules actives (Redis cache TTL 5min)
    │
    ├── 2. Pour chaque règle, évaluer :
    │      ├── keyword : input_text/output_text contient le mot ?
    │      ├── regex : match le pattern ?
    │      ├── topic : classification basique par mots-clés groupés
    │      └── category : liste noire de catégories
    │
    ├── 3. Si match :
    │      ├── action=block → rejeter l'event (403)
    │      ├── action=redact → masquer le contenu matché
    │      └── action=log → attacher la violation à l'event
    │
    └── 4. Dispatch async : log_guardrail_violation (Celery)
           → Insérer dans guardrail_violations
           → Incrémenter counter WebSocket
           → Déclencher alerte si configurée
```

### 4.5 — PII redaction (middleware sync)

```
Pendant l'ingestion (sync — avant stockage) :
    │
    ├── 1. Charger pii_config de l'org (Redis cache TTL 5min)
    │
    ├── 2. Scanner input_text + output_text avec les patterns :
    │      ├── email : regex email standard
    │      ├── phone : regex phone US/EU/international
    │      ├── credit_card : regex Luhn-validé
    │      ├── ssn : regex SSN format
    │      └── custom : patterns définis par l'org
    │
    ├── 3. Appliquer l'action :
    │      ├── redact → remplacer par [REDACTED:email], [REDACTED:phone], etc.
    │      ├── hash → remplacer par SHA-256 hash
    │      └── log_only → noter la position mais garder le contenu
    │
    ├── 4. Stocker :
    │      → input_redacted = version nettoyée
    │      → output_redacted = version nettoyée
    │      → Si store_original=true → garder input_text/output_text
    │      → Si store_original=false → input_text/output_text = NULL
    │
    └── 5. Le Replay affiche par défaut les versions redacted
```

### 4.6 — WebSocket temps réel

```
Frontend ←→ FastAPI WebSocket /ws/dashboard
    │
    ├── Events reçus en temps réel :
    │      ├── new_event       → nouveau tracking event
    │      ├── alert_fired     → alerte déclenchée
    │      ├── smart_alert     → diagnostic IA disponible
    │      ├── anomaly         → spike détecté
    │      ├── budget_warning  → cap bientôt atteint
    │      ├── budget_frozen   → agent kill switch activé
    │      ├── session_update  → session en cours mise à jour (Replay)
    │      ├── violation       → guardrail violation détectée (Protect)
    │      └── pii_detected    → PII trouvé et redacted (Protect)
```

---

## 5. AUTHENTIFICATION — TRIPLE SYSTÈME

```
┌──────────────────────────────────────────────────┐
│  FRONTEND (Dashboard)                              │
│  Auth : Supabase JWT                               │
│  Middleware : verify_jwt()                          │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│  SDK / API DIRECTE                                 │
│  Auth : API Key (Bearer token)                     │
│  Format : ags_live_xxxxxxxxxxxxxxxxxxxx            │
│  Prefix : ags_live_xxxx                            │
│  Hash : SHA-256 en DB                              │
│  Middleware : verify_api_key()                      │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│  WEBSOCKET                                         │
│  Auth : JWT envoyé à la connexion                  │
│  Middleware : verify_ws_token()                     │
└──────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────┐
│  SHARED SESSION (Replay public)                    │
│  Auth : share_token dans l'URL                     │
│  Read-only, pas de JWT requis                      │
│  Expiration configurable                           │
└──────────────────────────────────────────────────┘
```

---

## 6. CACHING STRATEGY

```
Redis — 9 usages :

1. PRICING TABLE          → pricing:{provider}:{model}           TTL 1h
2. API KEY VALIDATION     → apikey:{key_hash}                    TTL 5min
3. RATE LIMIT COUNTERS    → ratelimit:{org}:{endpoint}:{window}  TTL window
4. BUDGET COUNTERS        → budget:{org}:{agent}:{period}         TTL period
5. FORECAST CACHE         → forecast:{org}                        TTL 1h
6. ANALYTICS CACHE        → analytics:{org}:{query_hash}          TTL 30s
7. GUARDRAIL RULES CACHE  → guardrails:{org}                      TTL 5min
8. PII CONFIG CACHE       → pii:{org}                             TTL 5min
9. WEBSOCKET PUB/SUB      → Channel ws:{org}                      N/A
```

---

## 7. DÉCISIONS ARCHITECTURALES

### Pourquoi 3 modules dans 1 produit ?
Le marché a Helicone (Monitor), LangSmith (Replay-like), et rien de mature pour Protect. En combinant les trois, on crée un produit sticky — le user ne peut pas facilement remplacer un module sans perdre l'intégration des deux autres. Le fait que Replay s'ouvre depuis une Smart Alert, et que Protect empêche la récurrence, crée un cycle vertueux.

### Pourquoi stocker les inputs/outputs (Replay) ?
C'est la valeur #1 de Replay : voir exactement ce que l'agent a fait. Mais c'est aussi le risque #1 (PII, données sensibles). D'où PII redaction par défaut et store_original=false par défaut. Le user doit opt-in pour garder les contenus bruts.

### Pourquoi PII redaction côté serveur ET client ?
Le SDK fait un premier pass de redaction avant d'envoyer (protection en transit). Le serveur fait un second pass (protection au repos). Double couche de sécurité.

### Pourquoi les guardrails sont sync (middleware) ?
Un guardrail avec action=block doit empêcher l'event AVANT qu'il soit stocké. Si c'était async, l'event serait déjà en DB. Le check doit être rapide (< 5ms) d'où le cache Redis des règles.

### Pourquoi un monorepo ?
Un seul repo avec backend/, frontend/, sdk/. Plus simple pour Claude Code, types partagés, deploys synchronisés.

### Pourquoi pas de proxy ?
Notre position marché. On ne touche pas au trafic réseau. On capture les métadonnées et les traces via le SDK/décorateur.

---

## 8. CONTRAINTES DE PERFORMANCE

```
POST /v1/track :
    - Latence p50 : < 30ms
    - Latence p95 : < 50ms (incluant guardrail check + PII scan)
    - Latence p99 : < 100ms
    - Throughput : 5000 req/s par instance

Guardrail check (sync middleware) :
    - Latence max : < 5ms (règles en cache Redis)

PII scan (sync middleware) :
    - Latence max : < 10ms (regex patterns en mémoire)

Dashboard API :
    - Latence p50 : < 200ms
    - Latence p95 : < 500ms

Replay session load :
    - Latence p50 : < 300ms (session complète avec steps)
    - Latence p95 : < 800ms

WebSocket :
    - Délai event → dashboard : < 500ms
    - Max connexions par instance : 1000

Smart Alert diagnosis :
    - Délai : < 30s (async, Claude API call)

Agrégations Celery :
    - Fréquence : toutes les 5 minutes
    - Durée max : < 30s par run
```

---

> **Règle :** Ce fichier est la vérité sur l'architecture d'AgentShield.
> Si une décision archi contredit ce fichier → mettre ce fichier à jour ET logger la décision dans CHANGELOG.md.
