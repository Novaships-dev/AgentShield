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
│  /v1/track          → Ingestion des événements de coût           │
│  /v1/agents         → CRUD agents                                │
│  /v1/analytics      → Données agrégées pour le dashboard         │
│  /v1/alerts         → Gestion des seuils et alertes              │
│  /v1/reports        → Génération de rapports PDF                 │
│  /v1/billing        → Stripe webhooks + gestion abonnement       │
│  /v1/auth           → Proxy vers Supabase Auth                   │
│  /v1/api-keys       → Création / révocation des API keys         │
│  /v1/recommendations→ Optimisations IA (Claude API)              │
└──────────┬──────────────────┬──────────────────┬────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌────────────────┐ ┌─────────────────────────┐
│   Supabase       │ │   Redis        │ │   Celery Workers        │
│   PostgreSQL     │ │   Cache +      │ │   Railway               │
│                  │ │   Broker       │ │                         │
│  - users         │ │                │ │  - aggregate_costs      │
│  - organizations │ │  - rate limits │ │  - check_alert_thresholds│
│  - agents        │ │  - cache prix  │ │  - send_alert_slack     │
│  - events        │ │  - session     │ │  - send_alert_email     │
│  - alerts        │ │  - queue tasks │ │  - generate_pdf_report  │
│  - api_keys      │ │                │ │  - cleanup_old_events   │
│  - subscriptions │ │                │ │  - sync_pricing_table   │
│  - invoices      │ │                │ │                         │
│  RLS activé      │ │                │ │                         │
└──────────────────┘ └────────────────┘ └─────────────────────────┘
                                                  │
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │      Services externes       │
                                   │                              │
                                   │  - Stripe (paiements)        │
                                   │  - Brevo (emails)            │
                                   │  - Slack API (webhooks)      │
                                   │  - Claude API (recommandations)│
                                   │  - Sentry (monitoring)       │
                                   │  - Plausible (analytics)     │
                                   └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 14)                        │
│                     app.agentcostguard.io                         │
│                     Vercel                                        │
│                                                                  │
│  /                  → Landing page + pricing                     │
│  /login             → Auth (Supabase)                            │
│  /signup            → Onboarding                                 │
│  /dashboard         → Vue principale (coûts temps réel)          │
│  /dashboard/agents  → Liste et détail par agent                  │
│  /dashboard/alerts  → Configuration des seuils                   │
│  /dashboard/reports → Rapports PDF                               │
│  /dashboard/settings→ Profil, API keys, billing, team            │
│  /docs              → Documentation publique SDK + API           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. STRUCTURE DU MONOREPO

```
agentcostguard/
│
├── docs/                          ← Documentation projet (25 fichiers)
├── skills/                        ← Skills Claude Code (14 fichiers)
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
│   │   │       ├── router.py     ← Router principal v1
│   │   │       ├── track.py      ← POST /v1/track — ingestion événements
│   │   │       ├── agents.py     ← CRUD agents
│   │   │       ├── analytics.py  ← Données agrégées
│   │   │       ├── alerts.py     ← Gestion seuils + alertes
│   │   │       ├── reports.py    ← Génération PDF
│   │   │       ├── billing.py    ← Stripe webhooks + abonnement
│   │   │       ├── auth.py       ← Auth endpoints
│   │   │       ├── api_keys.py   ← Création / révocation API keys
│   │   │       └── recommendations.py ← Optimisations IA
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py           ← User, Organization
│   │   │   ├── agent.py          ← Agent
│   │   │   ├── event.py          ← TrackingEvent
│   │   │   ├── alert.py          ← Alert, AlertRule
│   │   │   ├── api_key.py        ← APIKey
│   │   │   └── subscription.py   ← Subscription, Invoice
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── track.py          ← TrackEventRequest, TrackEventResponse
│   │   │   ├── agent.py          ← AgentCreate, AgentResponse
│   │   │   ├── analytics.py      ← AnalyticsQuery, AnalyticsResponse
│   │   │   ├── alert.py          ← AlertRuleCreate, AlertResponse
│   │   │   └── billing.py        ← SubscriptionResponse, CheckoutRequest
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── tracking.py       ← Logique d'ingestion + calcul coût
│   │   │   ├── pricing.py        ← Table des prix par modèle + calcul
│   │   │   ├── analytics.py      ← Agrégation des métriques
│   │   │   ├── alerts.py         ← Évaluation des seuils + déclenchement
│   │   │   ├── stripe.py         ← Interaction Stripe
│   │   │   ├── brevo.py          ← Envoi d'emails
│   │   │   ├── slack.py          ← Envoi notifications Slack
│   │   │   ├── recommendations.py← Appel Claude API pour optimisations
│   │   │   ├── pdf.py            ← Génération rapports PDF
│   │   │   └── api_keys.py       ← Hash, validation, rotation
│   │   │
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py     ← Config Celery + Redis broker
│   │   │   ├── tasks_alerts.py   ← Tasks : check seuils, send alerts
│   │   │   ├── tasks_aggregation.py ← Tasks : agrégation horaire/daily
│   │   │   ├── tasks_reports.py  ← Tasks : génération PDF async
│   │   │   └── tasks_maintenance.py ← Tasks : cleanup, sync pricing
│   │   │
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py           ← Vérification JWT + API key
│   │   │   ├── rate_limit.py     ← Rate limiting par plan
│   │   │   └── plan_limits.py    ← Vérification limites (agents, requêtes)
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── supabase.py       ← Client Supabase
│   │       ├── redis.py          ← Client Redis
│   │       └── errors.py         ← Exceptions custom + handlers
│   │
│   ├── migrations/
│   │   └── ...                   ← Migrations SQL Supabase
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py           ← Fixtures pytest
│   │   ├── test_track.py
│   │   ├── test_analytics.py
│   │   ├── test_alerts.py
│   │   ├── test_billing.py
│   │   ├── test_api_keys.py
│   │   └── test_pricing.py
│   │
│   ├── pyproject.toml            ← Dépendances Python
│   ├── Dockerfile                ← Image backend
│   └── .env.example              ← Template variables d'environnement
│
├── frontend/                      ← Next.js 14 + TypeScript
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        ← Root layout (dark mode, fonts)
│   │   │   ├── page.tsx          ← Landing page
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx    ← Dashboard layout (sidebar, nav)
│   │   │   │   ├── dashboard/page.tsx         ← Vue principale
│   │   │   │   ├── dashboard/agents/page.tsx  ← Liste agents
│   │   │   │   ├── dashboard/agents/[id]/page.tsx ← Détail agent
│   │   │   │   ├── dashboard/alerts/page.tsx  ← Config alertes
│   │   │   │   ├── dashboard/reports/page.tsx ← Rapports
│   │   │   │   └── dashboard/settings/page.tsx← Settings
│   │   │   └── docs/
│   │   │       └── page.tsx      ← Documentation publique
│   │   │
│   │   ├── components/
│   │   │   ├── ui/               ← shadcn/ui components
│   │   │   ├── charts/
│   │   │   │   ├── CostOverTime.tsx    ← Graphique coûts temps réel
│   │   │   │   ├── CostByAgent.tsx     ← Répartition par agent
│   │   │   │   ├── CostByProvider.tsx  ← Répartition par provider
│   │   │   │   └── CostByModel.tsx     ← Répartition par modèle
│   │   │   ├── dashboard/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopNav.tsx
│   │   │   │   ├── StatsCards.tsx      ← KPI cards (MRR, coût total, etc.)
│   │   │   │   ├── AgentTable.tsx      ← Table agents avec tri/filtre
│   │   │   │   └── AlertBanner.tsx     ← Banner dépassement seuil
│   │   │   ├── landing/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── Pricing.tsx
│   │   │   │   └── CTA.tsx
│   │   │   └── shared/
│   │   │       ├── Logo.tsx
│   │   │       ├── ThemeProvider.tsx
│   │   │       └── LoadingSpinner.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts     ← Client browser
│   │   │   │   └── server.ts     ← Client server-side
│   │   │   ├── api.ts            ← Fetch wrapper vers le backend FastAPI
│   │   │   ├── stripe.ts         ← Helpers Stripe côté front
│   │   │   └── utils.ts          ← Formatters (dates, montants, etc.)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts        ← Hook auth Supabase
│   │   │   ├── useAgents.ts      ← Hook données agents
│   │   │   ├── useAnalytics.ts   ← Hook données analytics
│   │   │   └── useSubscription.ts← Hook état abonnement
│   │   │
│   │   └── types/
│   │       ├── agent.ts
│   │       ├── event.ts
│   │       ├── alert.ts
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
│   ├── Dockerfile              ← Image frontend (si besoin)
│   └── .env.example
│
├── sdk/                          ← SDK Python — package PyPI
│   ├── agentcostguard/
│   │   ├── __init__.py          ← Exports publics (track, Client)
│   │   ├── client.py            ← Client HTTP (requests + retry)
│   │   ├── tracker.py           ← Décorateur @track + context manager
│   │   ├── pricing.py           ← Table prix locale (fallback)
│   │   ├── models.py            ← Dataclasses (TrackEvent, etc.)
│   │   └── exceptions.py        ← Exceptions SDK
│   │
│   ├── tests/
│   │   ├── test_tracker.py
│   │   ├── test_client.py
│   │   └── test_pricing.py
│   │
│   ├── pyproject.toml           ← Config PyPI
│   ├── README.md                ← Doc PyPI
│   └── .env.example
│
├── .github/
│   └── workflows/
│       ├── ci-backend.yml       ← Lint + tests backend
│       ├── ci-frontend.yml      ← Lint + tests frontend
│       ├── ci-sdk.yml           ← Tests SDK
│       ├── deploy-backend.yml   ← Deploy Railway
│       ├── deploy-frontend.yml  ← Deploy Vercel
│       └── publish-sdk.yml      ← Publish PyPI
│
├── .devcontainer/
│   └── devcontainer.json        ← Config Codespace
│
├── .gitignore
├── README.md
└── LICENSE
```

---

## 3. SCHÉMA BASE DE DONNÉES

### Tables principales

```sql
-- ============================================================
-- USERS & ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'starter', 'pro', 'team')),
    stripe_customer_id   TEXT,
    stripe_subscription_id TEXT,
    max_agents      INT NOT NULL DEFAULT 1,
    max_requests    INT NOT NULL DEFAULT 10000,
    history_days    INT NOT NULL DEFAULT 7,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'owner'
                    CHECK (role IN ('owner', 'admin', 'member')),
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
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    input_tokens    INT NOT NULL DEFAULT 0,
    output_tokens   INT NOT NULL DEFAULT 0,
    total_tokens    INT NOT NULL DEFAULT 0,
    cost_usd        DECIMAL(12, 6) NOT NULL,
    workflow        TEXT,
    user_label      TEXT,
    metadata        JSONB DEFAULT '{}',
    tracked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_events_org_time ON events (organization_id, tracked_at DESC);
CREATE INDEX idx_events_agent_time ON events (agent_id, tracked_at DESC);
CREATE INDEX idx_events_org_agent ON events (organization_id, agent_id);

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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    metric          TEXT NOT NULL
                    CHECK (metric IN ('cost_daily', 'cost_weekly', 'cost_monthly',
                                       'requests_daily', 'requests_hourly')),
    threshold       DECIMAL(12, 2) NOT NULL,
    channel         TEXT NOT NULL
                    CHECK (channel IN ('email', 'slack', 'both')),
    slack_webhook   TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    cooldown_minutes INT NOT NULL DEFAULT 60,
    last_triggered  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Pattern RLS : l'utilisateur ne voit que les données de son organization
CREATE POLICY "users_own_org" ON users
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

-- Même pattern pour toutes les tables avec organization_id
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
    ├── 2. Vérifier limites du plan (middleware plan_limits)
    │      → Redis counter : requêtes ce mois / max autorisé
    │
    ├── 3. Valider le payload (schema Pydantic)
    │
    ├── 4. Calculer le coût si non fourni
    │      → services/pricing.py : lookup modèle → prix par token
    │      → Redis cache de la table de prix (TTL 1h)
    │
    ├── 5. Auto-créer l'agent si nouveau nom
    │      → INSERT ... ON CONFLICT DO NOTHING
    │
    ├── 6. Insérer l'événement dans la table events
    │      → Supabase direct insert
    │
    ├── 7. Dispatch task Celery : check_alert_thresholds
    │      → Async — ne bloque pas la réponse
    │
    └── 8. Retourner 201 + event_id + cost calculé
            → Latence cible : < 50ms p95
```

### 4.2 — Vérification des alertes (Celery task)

```
check_alert_thresholds(organization_id, agent_id)
    │
    ├── 1. Charger les alert_rules actives pour cet org/agent
    │
    ├── 2. Pour chaque rule :
    │      ├── Calculer la valeur courante (cost_daily, etc.)
    │      │   → Query sur aggregations ou events
    │      │
    │      ├── Comparer au threshold
    │      │
    │      ├── Vérifier le cooldown (last_triggered + cooldown_minutes)
    │      │
    │      └── Si dépassé ET cooldown expiré :
    │          ├── Dispatch send_alert_slack ou send_alert_email
    │          ├── Insérer dans alert_history
    │          └── Mettre à jour last_triggered
    │
    └── Fin
```

### 4.3 — Dashboard analytics (GET /v1/analytics)

```
Frontend → FastAPI /v1/analytics
    │
    ├── 1. Auth JWT (Supabase token)
    │
    ├── 2. Parser les filtres (date range, agent, provider, model)
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
    │
    └── 5. Retourner JSON
            → Redis cache 30s pour les requêtes identiques
```

---

## 5. AUTHENTIFICATION — DOUBLE SYSTÈME

AgentCostGuard a deux types de clients avec deux méthodes d'auth différentes.

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
```

---

## 6. RATE LIMITING

```
Par plan, via Redis sliding window :

| Plan    | Requêtes /v1/track | Requêtes dashboard |
|---------|--------------------|--------------------|
| Free    | 100/min            | 30/min             |
| Starter | 500/min            | 60/min             |
| Pro     | 2000/min           | 120/min            |
| Team    | 5000/min           | 200/min            |

Header de réponse :
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1711234567
```

---

## 7. CACHING STRATEGY

```
Redis est utilisé pour 4 choses :

1. PRICING TABLE
   Key   : pricing:{provider}:{model}
   Value : {input_per_token, output_per_token}
   TTL   : 1 heure
   Miss  : fallback sur table locale dans le SDK

2. API KEY VALIDATION
   Key   : apikey:{key_hash}
   Value : {organization_id, plan, is_active}
   TTL   : 5 minutes
   Miss  : query Supabase → populate cache

3. RATE LIMIT COUNTERS
   Key   : ratelimit:{org_id}:{endpoint}:{window}
   Value : counter
   TTL   : durée de la window (1 min)

4. ANALYTICS CACHE
   Key   : analytics:{org_id}:{query_hash}
   Value : JSON réponse
   TTL   : 30 secondes
```

---

## 8. PATTERN MULTI-TENANT

```
Toute donnée est scopée par organization_id.

Règles :
- Chaque user appartient à exactement 1 organization
- Chaque requête DB inclut un filtre organization_id
- RLS Supabase appliqué sur TOUTES les tables
- Le plan Free crée automatiquement une organization (1 user = 1 org)
- Le plan Team permet d'inviter des membres dans la même org
- Un user ne peut JAMAIS voir les données d'une autre org

Hiérarchie :
Organization
    ├── Users (owner, admin, member)
    ├── Agents
    ├── Events
    ├── Alert Rules
    ├── API Keys
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
│ Database    │ Supabase local  │ Supabase        │ Supabase         │
│             │ (Docker)        │ projet staging  │ projet prod      │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Redis       │ localhost:6379  │ Railway Redis   │ Railway Redis    │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Stripe      │ Test mode       │ Test mode       │ Live mode        │
├─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ Brevo       │ Sandbox         │ Sandbox         │ Production       │
└─────────────┴─────────────────┴─────────────────┴──────────────────┘
```

---

## 10. DÉCISIONS ARCHITECTURALES

### Pourquoi un monorepo ?

Un seul repo avec backend/, frontend/, sdk/. Plus simple à gérer pour une équipe de 1. Les types sont partagés, les deploys sont synchronisés, Claude Code a tout le contexte en un seul endroit.

### Pourquoi des agrégations pré-calculées ?

La table events va grossir vite (100K+ lignes/mois dès le début). Querier directement pour le dashboard serait lent. Les agrégations horaires et daily sont calculées par Celery toutes les 5 minutes. Le dashboard query les agrégations, pas les events bruts (sauf pour le temps réel < 1h).

### Pourquoi Redis pour le rate limiting ?

Les counters doivent être atomiques et rapides. PostgreSQL ajouterait de la latence sur chaque requête /v1/track. Redis sliding window est le standard pour ça.

### Pourquoi pas de proxy ?

Notre position marché est d'être simple et non-intrusif. Un proxy crée un point de défaillance, complexifie le setup, et nous met en compétition directe avec Helicone/Portkey. On track les métadonnées, pas le trafic.

### Pourquoi Supabase Auth plutôt que custom ?

C'est le launch — on ne reinvente pas l'auth. Supabase Auth gère email + Google OAuth + JWT + RLS. On peut migrer plus tard si nécessaire.

### Pourquoi Celery + Redis plutôt que des background tasks FastAPI ?

Les alertes et les agrégations doivent survivre à un restart du serveur. Celery avec Redis comme broker donne de la fiabilité, du retry, du scheduling (beat pour les agrégations périodiques). Les background tasks FastAPI meurent avec le process.

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

Agrégations Celery :
    - Fréquence : toutes les 5 minutes
    - Durée max : < 30s par run

Alertes :
    - Délai entre dépassement et notification : < 2 minutes
```

---

> **Règle :** Ce fichier est la vérité sur l'architecture d'AgentCostGuard.
> Si une décision archi contredit ce fichier → mettre ce fichier à jour ET logger la décision dans CHANGELOG.md.
