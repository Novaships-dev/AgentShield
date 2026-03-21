# CONVENTIONS.md — Standards de code AgentShield

> Ce fichier définit toutes les conventions de code du projet. Claude Code le lit avant d'écrire la moindre ligne.
> Cohérent avec : CLAUDE.md (instructions), ARCH.md (structure)
> Dernière mise à jour : mars 2026

---

## 1. LANGUE

| Contexte | Langue |
|----------|--------|
| Code (variables, fonctions, classes) | Anglais |
| Commentaires dans le code | Anglais |
| Messages d'erreur (API, SDK, UI) | Anglais |
| UI (labels, boutons, textes) | Anglais |
| Documentation publique (docs site, README PyPI) | Anglais |
| Documentation interne (docs/, skills/) | Français autorisé |
| Commits | Anglais |
| Noms de fichiers | Anglais |

---

## 2. PYTHON — BACKEND + SDK

### Style général
- Python 3.12+ requis
- Formatter : Ruff (format + lint)
- Line length : 100 caractères max
- Quotes : double quotes `"` partout (Ruff default)
- Type hints obligatoires sur toutes les fonctions publiques
- Docstrings : Google style, en anglais, sur toutes les fonctions publiques

### Naming

```python
# Fichiers : snake_case
smart_alerts.py
pii_redaction.py

# Variables et fonctions : snake_case
cost_usd = 0.0234
def calculate_forecast(org_id: UUID) -> ForecastResult:

# Classes : PascalCase
class TrackEventRequest(BaseModel):
class BudgetExceededError(Exception):

# Constantes : UPPER_SNAKE_CASE
MAX_AGENTS_FREE = 1
DEFAULT_COOLDOWN_MINUTES = 60
PII_PATTERNS = ["email", "phone", "credit_card", "ssn"]

# Private : prefixed underscore
def _validate_api_key(key_hash: str) -> bool:
_redis_client: Redis | None = None
```

### Imports

```python
# Ordre strict (Ruff enforce automatiquement) :
# 1. Standard library
import hashlib
from datetime import datetime, timezone
from uuid import UUID

# 2. Third-party
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from celery import shared_task

# 3. Local
from app.config import settings
from app.models.event import Event
from app.services.pricing import calculate_cost
```

### FastAPI — Endpoints

```python
# Fichier : app/api/v1/track.py

router = APIRouter(prefix="/v1", tags=["tracking"])

@router.post(
    "/track",
    response_model=TrackEventResponse,
    status_code=201,
    summary="Track an AI API call",
    description="Record cost and metadata for a single AI API call.",
)
async def track_event(
    request: TrackEventRequest,
    org: Organization = Depends(get_current_org),
    db: AsyncClient = Depends(get_db),
) -> TrackEventResponse:
    """Track a single AI API call event."""
    # 1. Validate
    # 2. Process
    # 3. Return
```

### FastAPI — Pattern de chaque endpoint

```
1. Validation (Pydantic schema — automatique)
2. Auth check (Dependency injection — middleware)
3. Plan check (le plan autorise cette feature ?)
4. Rate limit check (middleware)
5. Business logic (appel au service layer)
6. Return response (Pydantic schema)
```

### Pydantic — Schemas

```python
# Fichier : app/schemas/track.py

class TrackEventRequest(BaseModel):
    """Request body for POST /v1/track."""

    agent: str = Field(..., min_length=1, max_length=100, description="Agent name")
    model: str | None = Field(None, max_length=100, description="Model name (e.g. gpt-4o)")
    provider: str | None = Field(None, description="Provider (auto-detected from model if omitted)")
    input_tokens: int = Field(0, ge=0)
    output_tokens: int = Field(0, ge=0)
    cost_usd: float | None = Field(None, ge=0, description="Cost in USD (auto-calculated if omitted)")
    session_id: str | None = Field(None, max_length=200)
    step: int | None = Field(None, ge=0)
    step_name: str | None = Field(None, max_length=100)
    input_text: str | None = Field(None, max_length=50000)
    output_text: str | None = Field(None, max_length=50000)
    status: str = Field("success", pattern="^(success|error|timeout)$")
    duration_ms: int | None = Field(None, ge=0)
    workflow: str | None = Field(None, max_length=100)
    user_label: str | None = Field(None, max_length=100)
    team_label: str | None = Field(None, max_length=100)
    metadata: dict | None = Field(None, description="Max 10 keys, 500 chars per value")

    model_config = {"json_schema_extra": {"examples": [...]}}


class TrackEventResponse(BaseModel):
    """Response for POST /v1/track."""

    event_id: UUID
    agent: str
    cost_usd: float | None
    budget_remaining_usd: float | None
    budget_status: str
    guardrail_violations: list[str]
    pii_detected: list[str]
    warnings: list[str]
```

### Services — Pattern

```python
# Fichier : app/services/tracking.py

class TrackingService:
    """Service for event tracking logic."""

    def __init__(self, db: AsyncClient, redis: Redis, config: Settings):
        self._db = db
        self._redis = redis
        self._config = config

    async def track_event(
        self,
        org: Organization,
        request: TrackEventRequest,
    ) -> TrackEventResponse:
        """Process and store a tracking event."""
        # Business logic here
        # NO direct HTTP response handling
        # NO FastAPI dependencies
        # Returns a domain object, not an HTTP response
```

### Celery — Tasks

```python
# Fichier : app/workers/tasks_alerts.py

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True,
    name="alerts.check_thresholds",
)
def check_alert_thresholds(self, organization_id: str, agent_id: str) -> None:
    """Check all active alert rules for threshold violations."""
    try:
        # Logic
        pass
    except Exception as exc:
        self.retry(exc=exc)
```

### Exceptions

```python
# Fichier : app/utils/errors.py

class AgentShieldError(Exception):
    """Base exception for AgentShield."""

    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class BudgetExceededError(AgentShieldError):
    def __init__(self, agent: str, current_usd: float, max_usd: float):
        super().__init__(
            message=f"Budget exceeded for agent '{agent}': ${current_usd:.2f}/${max_usd:.2f}",
            code="budget_exceeded",
            status_code=429,
        )
        self.agent = agent
        self.current_usd = current_usd
        self.max_usd = max_usd
```

### Tests

```python
# Fichier : backend/tests/test_track.py

# Naming : test_{function}_{scenario}_{expected_result}
def test_track_event_valid_payload_returns_201():
def test_track_event_missing_agent_returns_422():
def test_track_event_budget_exceeded_returns_429():
def test_track_event_invalid_api_key_returns_401():
def test_track_event_auto_creates_agent():
def test_track_event_pii_redacted_before_storage():
```

---

## 3. TYPESCRIPT — FRONTEND

### Style général
- TypeScript strict mode
- Formatter : Prettier (2 spaces, double quotes, trailing comma)
- ESLint : next/core-web-vitals + custom rules
- Line length : 100 caractères max

### Naming

```typescript
// Fichiers composants : PascalCase
StatsCards.tsx
SessionTimeline.tsx
GuardrailForm.tsx

// Fichiers utilitaires : camelCase
api.ts
websocket.ts
utils.ts

// Variables et fonctions : camelCase
const costToday = 12.47;
function formatCurrency(amount: number): string {}

// Composants : PascalCase
function BudgetGauge({ agent, budget }: BudgetGaugeProps) {}
export default function DashboardPage() {}

// Types et interfaces : PascalCase
interface Agent { id: string; name: string; }
type AlertChannel = "email" | "slack" | "both" | "webhook";

// Constants : UPPER_SNAKE_CASE
const MAX_WIDGETS = 12;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Hooks : use prefix
function useAgents() {}
function useWebSocket(orgId: string) {}
```

### Next.js — Structure des pages

```typescript
// Server Component par défaut (pas de "use client")
// app/(dashboard)/dashboard/agents/page.tsx

import { AgentTable } from "@/components/dashboard/AgentTable";

export default async function AgentsPage() {
  // Fetch data server-side
  return (
    <div>
      <h1>Agents</h1>
      <AgentTable />
    </div>
  );
}
```

```typescript
// Client Component quand nécessaire (interactivité, hooks, WebSocket)
// components/dashboard/AgentTable.tsx

"use client";

import { useState } from "react";
import { useAgents } from "@/hooks/useAgents";

export function AgentTable() {
  const { agents, isLoading } = useAgents();
  // ...
}
```

### Quand utiliser "use client"
- Le composant utilise useState, useEffect, useRef, ou un custom hook
- Le composant a des event handlers (onClick, onChange, etc.)
- Le composant utilise le WebSocket
- Le composant utilise des animations (GSAP, Framer Motion)
- **Sinon → Server Component par défaut**

### Composants — Pattern

```typescript
// Fichier : components/dashboard/BudgetGauge.tsx

"use client";

interface BudgetGaugeProps {
  agentName: string;
  currentUsd: number;
  maxUsd: number;
  period: "daily" | "weekly" | "monthly";
  isFrozen: boolean;
}

export function BudgetGauge({
  agentName,
  currentUsd,
  maxUsd,
  period,
  isFrozen,
}: BudgetGaugeProps) {
  const percentage = Math.min((currentUsd / maxUsd) * 100, 100);
  const color = percentage > 80 ? "red" : percentage > 60 ? "orange" : "green";

  return (
    // JSX
  );
}
```

### API calls — Pattern

```typescript
// Fichier : lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getSupabaseToken(); // or API key

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new ApiError(error.code, error.message, res.status);
  }

  return res.json();
}

// Usage in hooks
export const api = {
  track: (data: TrackRequest) => apiFetch<TrackResponse>("/v1/track", { method: "POST", body: JSON.stringify(data) }),
  agents: () => apiFetch<Agent[]>("/v1/agents"),
  analytics: (params: AnalyticsQuery) => apiFetch<AnalyticsResponse>(`/v1/analytics?${qs(params)}`),
};
```

### Hooks — Pattern

```typescript
// Fichier : hooks/useAgents.ts

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/types/agent";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.agents()
      .then(setAgents)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { agents, isLoading, error };
}
```

---

## 4. SQL — SUPABASE

### Naming

```sql
-- Tables : snake_case, pluriel
CREATE TABLE agents (...);
CREATE TABLE alert_rules (...);
CREATE TABLE guardrail_violations (...);

-- Colonnes : snake_case
organization_id UUID NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
is_active BOOLEAN NOT NULL DEFAULT true
cost_usd DECIMAL(12, 6)

-- Index : idx_{table}_{columns}
CREATE INDEX idx_events_org_time ON events (organization_id, tracked_at DESC);

-- Contraintes : {table}_{column}_check
CHECK (plan IN ('free', 'starter', 'pro', 'team'))
CHECK (status IN ('success', 'error', 'timeout'))

-- RLS policies : {action}_{table}_{description}
CREATE POLICY "select_own_org" ON agents FOR SELECT USING (...);
```

### Patterns obligatoires

```sql
-- Chaque table a :
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

-- RLS activé sur CHAQUE table (19 tables)
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Policy pattern : scope par organization_id
CREATE POLICY "users_own_org" ON {table_name}
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );
```

### Migrations

```
-- Fichier naming : {timestamp}_{description}.sql
-- Exemple : 20260401_001_create_organizations.sql
-- Exemple : 20260401_002_create_agents.sql
-- Exemple : 20260401_003_create_events.sql

-- Chaque migration est idempotente (IF NOT EXISTS)
-- Chaque migration a un commentaire en tête avec le résumé
-- Pas de DROP TABLE dans les migrations normales (sauf migration de rollback dédiée)
```

---

## 5. API — CONVENTIONS REST

### URL patterns

```
GET    /v1/agents              → Liste
GET    /v1/agents/:id          → Détail
POST   /v1/agents              → Créer
PUT    /v1/agents/:id          → Update complet
PATCH  /v1/agents/:id          → Update partiel
DELETE /v1/agents/:id          → Supprimer (soft delete)

POST   /v1/track               → Action (pas CRUD, donc POST)
GET    /v1/analytics            → Query avec filtres
GET    /v1/forecasts            → Données calculées
```

### Réponses

```json
// Succès simple
{
    "event_id": "uuid",
    "cost_usd": 0.0234
}

// Liste paginée
{
    "data": [...],
    "pagination": {
        "page": 1,
        "per_page": 50,
        "total": 234,
        "total_pages": 5
    }
}

// Erreur
{
    "error": {
        "code": "budget_exceeded",
        "message": "Budget exceeded for agent 'support-agent': $52.30/$50.00",
        "details": {
            "agent": "support-agent",
            "current_usd": 52.30,
            "max_usd": 50.00
        }
    }
}
```

### HTTP Status Codes utilisés

```
200 — OK (GET, PUT, PATCH, DELETE)
201 — Created (POST /v1/track, POST /v1/agents)
204 — No Content (DELETE quand rien à retourner)
400 — Bad Request (payload invalide — logique métier)
401 — Unauthorized (API key invalide, JWT expiré)
403 — Forbidden (plan insuffisant, guardrail block)
404 — Not Found
409 — Conflict (duplicate agent name, etc.)
422 — Unprocessable Entity (validation Pydantic échouée)
429 — Too Many Requests (rate limit OU budget exceeded)
500 — Internal Server Error
```

### Headers customs

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1711234567
X-AGS-Request-Id: uuid              ← Sur chaque réponse, pour le debug
X-AGS-Plan: pro                     ← Plan courant de l'org
X-AGS-Signature: sha256=abc...      ← Sur les webhooks sortants
X-AGS-Timestamp: 1711234567         ← Sur les webhooks sortants
```

---

## 6. GIT — WORKFLOW

### Branches
- `main` — seule branche, deploy continu
- Pas de branches feature pour le moment (solo dev)
- Si besoin futur : `feat/xxx`, `fix/xxx`, merge via PR

### Commits

```
Format : type: description courte en anglais

Types autorisés :
  feat     — nouvelle feature
  fix      — correction de bug
  refactor — restructuration sans changement fonctionnel
  docs     — documentation uniquement
  test     — ajout/modification de tests
  chore    — maintenance (deps, config, lint)
  style    — formatting uniquement (pas de changement logique)
  perf     — amélioration de performance

Exemples :
  feat: add POST /v1/track endpoint with auto-pricing
  fix: PII redaction missing international phone formats
  refactor: extract alert evaluation into dedicated service
  docs: complete SECURITY.md with RLS policies
  test: add e2e tests for onboarding flow
  chore: bump fastapi to 0.111.0
```

### Règles
- 1 commit = 1 changement logique
- Pas de commits avec des changements non liés
- Message en anglais, impératif, < 72 caractères
- Toujours push après commit (jamais de code local non pushé)

---

## 7. FICHIERS — ORGANISATION

### Pas de fichier > 300 lignes
Si un fichier dépasse 300 lignes → le découper. Exemples :
- `services/tracking.py` trop gros → extraire `services/pricing.py`
- `components/dashboard/AgentDetail.tsx` trop gros → extraire les sous-composants

### Un fichier = une responsabilité
- `services/alerts.py` → évaluation des seuils
- `services/smart_alerts.py` → diagnostic IA via Claude API
- Jamais les deux dans le même fichier

### Pas de code mort
- Pas de fonctions commentées "au cas où"
- Pas d'imports inutilisés
- Pas de variables non utilisées
- Ruff + ESLint catch ça automatiquement

---

## 8. DÉPENDANCES

### Ajout d'une dépendance — Checklist
1. Est-ce qu'on peut faire sans ? (souvent oui)
2. Le package est-il activement maintenu ? (dernier commit < 6 mois)
3. A-t-il des CVE connues non patchées ?
4. Quelle est sa taille ? (éviter les packages lourds pour une petite utilité)
5. Documenter pourquoi dans le commit message

### Versions
- Pinned dans pyproject.toml et package.json (pas de `^` sauf pour les mineurs)
- Lockfile committé (package-lock.json, uv.lock ou poetry.lock)

---

> **Règle :** Ce fichier est la référence pour tout le code du projet.
> En cas de doute sur un pattern → vérifier ici.
> En cas de contradiction avec un autre doc → ce fichier gagne pour les conventions de code.
