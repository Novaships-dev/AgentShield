# TESTS.md — Stratégie de tests AgentShield

> Ce fichier définit comment tester chaque partie du projet : backend, frontend, SDK, intégrations. Claude Code le lit avant d'écrire un test.
> Cohérent avec : CONVENTIONS.md (naming), ARCH.md (structure), DEPLOY.md (CI/CD)
> Dernière mise à jour : mars 2026

---

## 1. STACK DE TESTS

| Composant | Framework | Runner | Coverage |
|-----------|-----------|--------|----------|
| Backend (FastAPI) | pytest + pytest-asyncio | pytest | ≥ 80% |
| Celery tasks | pytest + celery eager mode | pytest | ≥ 70% |
| SDK Python | pytest + respx (mock HTTP) | pytest | ≥ 90% |
| Frontend (Next.js) | Vitest + Testing Library | vitest | ≥ 60% |
| E2E | Playwright | playwright test | Smoke tests critiques |

---

## 2. BACKEND — PYTEST

### Structure

```
backend/tests/
├── conftest.py              ← Fixtures globales
├── test_track.py            ← POST /v1/track (le plus critique)
├── test_agents.py           ← CRUD agents
├── test_analytics.py        ← GET /v1/analytics
├── test_alerts.py           ← Alert rules + history
├── test_smart_alerts.py     ← Diagnostic IA
├── test_budgets.py          ← Budget caps + kill switch
├── test_anomaly.py          ← Anomaly detection z-score
├── test_forecast.py         ← Cost forecast
├── test_sessions.py         ← Sessions + Replay timeline
├── test_replay.py           ← Share links, comparaison
├── test_guardrails.py       ← Guardrail evaluation
├── test_pii.py              ← PII redaction patterns
├── test_recommendations.py  ← Cost Autopilot
├── test_billing.py          ← Stripe webhooks + checkout
├── test_api_keys.py         ← Create, verify, revoke
├── test_webhooks.py         ← Webhooks sortants + signature
├── test_websocket.py        ← WebSocket connexion + events
├── test_pricing.py          ← Pricing engine calcul
├── test_auth.py             ← JWT + API key verification
├── test_rate_limit.py       ← Rate limiting Redis
└── test_health.py           ← Health check endpoint
```

### Fixtures globales

```python
# backend/tests/conftest.py

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from decimal import Decimal

from app.config import Settings
from app.main import app
from httpx import AsyncClient, ASGITransport

# ── App client ──────────────────────────────────
@pytest_asyncio.fixture
async def client():
    """Async test client for FastAPI."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

# ── Mock Redis ──────────────────────────────────
@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    redis = AsyncMock()
    redis.get.return_value = None
    redis.setex.return_value = True
    redis.incr.return_value = 1
    redis.pipeline.return_value = AsyncMock()
    return redis

# ── Mock Supabase ───────────────────────────────
@pytest.fixture
def mock_db():
    """Mock Supabase client."""
    db = AsyncMock()
    db.from_.return_value = db
    db.select.return_value = db
    db.insert.return_value = db
    db.update.return_value = db
    db.eq.return_value = db
    db.single.return_value = db
    db.execute.return_value = MagicMock(data=None, count=0)
    return db

# ── Test org + user ─────────────────────────────
@pytest.fixture
def test_org():
    """Test organization."""
    return {
        "id": str(uuid4()),
        "name": "test-org",
        "slug": "test-org",
        "plan": "pro",
        "max_agents": 999999,
        "max_requests": 500000,
        "history_days": 90,
        "modules_enabled": ["monitor", "replay", "protect"],
        "pii_redaction_enabled": True,
    }

@pytest.fixture
def test_user(test_org):
    """Test user."""
    return {
        "id": str(uuid4()),
        "organization_id": test_org["id"],
        "email": "test@example.com",
        "role": "owner",
    }

# ── API key fixtures ────────────────────────────
@pytest.fixture
def test_api_key():
    """Test API key (raw + hash)."""
    raw = "ags_live_test1234567890abcdefghijklmno"
    import hashlib
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return {"raw": raw, "hash": key_hash, "prefix": "ags_live_test"}

@pytest.fixture
def auth_headers(test_api_key):
    """Authorization headers with test API key."""
    return {"Authorization": f"Bearer {test_api_key['raw']}"}

# ── Celery eager mode ───────────────────────────
@pytest.fixture(autouse=True)
def celery_eager(settings):
    """Run Celery tasks synchronously in tests."""
    settings.celery_task_always_eager = True
```

### Naming convention

```python
# Pattern : test_{function}_{scenario}_{expected_result}

def test_track_event_valid_payload_returns_201():
def test_track_event_missing_agent_returns_422():
def test_track_event_unknown_model_returns_warning():
def test_track_event_budget_exceeded_returns_429():
def test_track_event_guardrail_block_returns_403():
def test_track_event_pii_redacted_before_storage():
def test_track_event_auto_creates_agent():
def test_track_event_session_upserted():
def test_track_event_websocket_published():
def test_track_event_free_plan_ignores_input_text():
```

### Exemples de tests critiques

```python
# backend/tests/test_track.py

@pytest.mark.asyncio
async def test_track_event_valid_payload_returns_201(client, auth_headers, mock_db, mock_redis):
    """POST /v1/track with valid payload returns 201 with event_id and cost."""
    response = await client.post("/v1/track", json={
        "agent": "test-agent",
        "model": "gpt-4o",
        "input_tokens": 100,
        "output_tokens": 50,
    }, headers=auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert "event_id" in data
    assert data["agent"] == "test-agent"
    assert data["cost_usd"] is not None
    assert data["budget_status"] == "ok"


@pytest.mark.asyncio
async def test_track_event_pii_redacted_before_storage(client, auth_headers, mock_db):
    """Input/output text is PII-redacted before being stored."""
    response = await client.post("/v1/track", json={
        "agent": "test-agent",
        "model": "gpt-4o",
        "input_tokens": 100,
        "output_tokens": 50,
        "input_text": "My email is john@example.com and my phone is +33612345678",
        "output_text": "Hello John, I see your email john@example.com",
    }, headers=auth_headers)

    assert response.status_code == 201
    assert "email" in response.json()["pii_detected"]

    # Vérifier que le DB insert a reçu la version redactée
    insert_call = mock_db.from_.call_args_list
    stored_data = insert_call[-1]  # Dernier insert
    assert "[REDACTED:email]" in stored_data["input_redacted"]
    assert "[REDACTED:phone]" in stored_data["input_redacted"]


@pytest.mark.asyncio
async def test_track_event_guardrail_block_returns_403(client, auth_headers, mock_redis):
    """Event blocked by guardrail returns 403."""
    # Setup : guardrail rule "block" on keyword "competitor_name"
    mock_redis.get.return_value = json.dumps([{
        "id": str(uuid4()),
        "name": "No competitors",
        "type": "keyword",
        "config": {"keywords": ["competitor_name"], "case_sensitive": False, "match_mode": "substring"},
        "action": "block",
        "agent_id": None,
    }])

    response = await client.post("/v1/track", json={
        "agent": "test-agent",
        "model": "gpt-4o",
        "input_tokens": 100,
        "output_tokens": 50,
        "output_text": "You should try competitor_name instead",
    }, headers=auth_headers)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "guardrail_blocked"
```

### Tests pricing engine

```python
# backend/tests/test_pricing.py

def test_calculate_cost_gpt4o():
    """GPT-4o cost calculation is correct."""
    cost = pricing_service.calculate_cost("openai", "gpt-4o", input_tokens=1000, output_tokens=500)
    # Input: 1000 * 2.50 / 1M = 0.002500
    # Output: 500 * 10.00 / 1M = 0.005000
    # Total: 0.007500
    assert cost == Decimal("0.007500")

def test_calculate_cost_unknown_model_returns_none():
    """Unknown model returns None."""
    cost = pricing_service.calculate_cost("unknown", "mystery-model", 100, 50)
    assert cost is None

def test_model_alias_resolution():
    """Model aliases resolve to canonical names."""
    assert resolve_model("sonnet") == "claude-sonnet-4-6"
    assert resolve_model("gpt4o") == "gpt-4o"
    assert resolve_model("gemini") == "gemini-pro"

def test_provider_detection():
    """Provider is detected from model name."""
    assert detect_provider("gpt-4o") == "openai"
    assert detect_provider("claude-sonnet-4-6") == "anthropic"
    assert detect_provider("gemini-flash") == "google"
    assert detect_provider("custom-model") is None
```

### Tests anomaly detection

```python
# backend/tests/test_anomaly.py

def test_anomaly_spike_detected():
    """Z-score > 3 triggers anomaly detection."""
    baseline = {"mean": 10.0, "stddev": 2.0, "sample_count": 100}
    current_value = 25.0  # z = (25 - 10) / 2 = 7.5

    result = check_anomaly(current_value, baseline)
    assert result["is_anomaly"] is True
    assert result["z_score"] > 3
    assert result["type"] == "spike"

def test_anomaly_normal_not_detected():
    """Normal value does not trigger anomaly."""
    baseline = {"mean": 10.0, "stddev": 2.0, "sample_count": 100}
    current_value = 12.0  # z = (12 - 10) / 2 = 1.0

    result = check_anomaly(current_value, baseline)
    assert result["is_anomaly"] is False

def test_anomaly_insufficient_samples_skips():
    """Agent with < 100 events skips anomaly detection."""
    baseline = {"mean": 10.0, "stddev": 2.0, "sample_count": 50}
    result = check_anomaly(100.0, baseline)
    assert result["is_anomaly"] is False
    assert result["reason"] == "insufficient_samples"
```

---

## 3. SDK — PYTEST + RESPX

### Structure

```
sdk/tests/
├── conftest.py              ← Mock API, fixtures
├── test_shield.py           ← @shield() décorateur
├── test_client.py           ← HTTP client + retry
├── test_sessions.py         ← session() context manager
├── test_budgets.py          ← set_budget() + BudgetExceededError
├── test_guardrails.py       ← Client-side guardrail check
├── test_pii.py              ← PII redaction patterns
├── test_extractors.py       ← Auto-extraction OpenAI/Anthropic/Google
├── test_pricing.py          ← Calcul de coût local
└── test_integrations.py     ← LangChain/CrewAI/AutoGen/LlamaIndex
```

### Mock API

```python
# sdk/tests/conftest.py

import respx
import pytest

@pytest.fixture
def mock_api():
    """Mock AgentShield API responses."""
    with respx.mock(base_url="https://api.agentshield.io") as mock:
        mock.post("/v1/track").respond(201, json={
            "event_id": "test-uuid",
            "agent": "test-agent",
            "cost_usd": 0.023,
            "budget_remaining_usd": 47.0,
            "budget_status": "ok",
            "guardrail_violations": [],
            "pii_detected": [],
            "warnings": [],
        })
        yield mock

@pytest.fixture
def mock_api_budget_exceeded():
    """Mock API returning budget exceeded."""
    with respx.mock(base_url="https://api.agentshield.io") as mock:
        mock.post("/v1/track").respond(429, json={
            "error": {
                "code": "budget_exceeded",
                "message": "Budget exceeded",
                "details": {"agent": "test", "current_usd": 52.0, "max_usd": 50.0, "period": "monthly"},
            }
        })
        yield mock
```

### Tests critiques SDK

```python
# sdk/tests/test_shield.py

def test_shield_never_blocks_on_api_failure(mock_api):
    """SDK NEVER blocks developer code, even if AgentShield API fails."""
    mock_api.post("/v1/track").respond(500)

    @shield(agent="test")
    def my_function():
        return "success"

    result = my_function()
    assert result == "success"  # Le code du dev fonctionne TOUJOURS

def test_shield_raises_budget_exceeded(mock_api_budget_exceeded):
    """SDK raises BudgetExceededError on 429 budget."""
    @shield(agent="test")
    def my_function():
        return "success"

    with pytest.raises(BudgetExceededError) as exc_info:
        my_function()
    assert exc_info.value.current_usd == 52.0
    assert exc_info.value.max_usd == 50.0

def test_shield_async_support(mock_api):
    """@shield works with async functions."""
    @shield(agent="test")
    async def my_async_function():
        return "async_success"

    import asyncio
    result = asyncio.run(my_async_function())
    assert result == "async_success"
    assert mock_api["POST /v1/track"].called
```

### Tests PII

```python
# sdk/tests/test_pii.py

def test_pii_email_redacted():
    text = "Contact me at john@example.com please"
    redacted, detected = redact_pii(text)
    assert "[REDACTED:email]" in redacted
    assert "john@example.com" not in redacted
    assert "email" in detected

def test_pii_phone_redacted():
    text = "Call me at +33 6 12 34 56 78"
    redacted, detected = redact_pii(text)
    assert "[REDACTED:phone]" in redacted
    assert "phone" in detected

def test_pii_credit_card_luhn_valid():
    text = "My card is 4111-1111-1111-1111"
    redacted, detected = redact_pii(text)
    assert "[REDACTED:cc]" in redacted
    assert "credit_card" in detected

def test_pii_credit_card_luhn_invalid_not_redacted():
    text = "Reference number: 1234-5678-9012-3456"
    redacted, detected = redact_pii(text)
    assert "credit_card" not in detected  # Luhn check fails

def test_pii_multiple_types():
    text = "Email john@test.com, phone +1-555-123-4567, SSN 123-45-6789"
    redacted, detected = redact_pii(text)
    assert "email" in detected
    assert "phone" in detected
    assert "ssn" in detected
    assert "john@test.com" not in redacted

def test_pii_no_false_positives_on_normal_text():
    text = "The weather is nice today. Let's discuss the project timeline."
    redacted, detected = redact_pii(text)
    assert redacted == text
    assert detected == []
```

---

## 4. FRONTEND — VITEST

### Structure

```
frontend/src/__tests__/
├── components/
│   ├── StatsCards.test.tsx
│   ├── AgentTable.test.tsx
│   ├── BudgetGauge.test.tsx
│   ├── SessionTimeline.test.tsx
│   └── GuardrailForm.test.tsx
├── hooks/
│   ├── useAgents.test.ts
│   ├── useWebSocket.test.ts
│   └── useSessions.test.ts
└── lib/
    ├── api.test.ts
    └── utils.test.ts
```

### Exemples

```typescript
// src/__tests__/components/BudgetGauge.test.tsx

import { render, screen } from "@testing-library/react";
import { BudgetGauge } from "@/components/dashboard/BudgetGauge";

describe("BudgetGauge", () => {
  it("shows green bar under 60%", () => {
    render(<BudgetGauge agentName="test" currentUsd={25} maxUsd={50} period="monthly" isFrozen={false} />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ "--gauge-color": "var(--success)" });
  });

  it("shows red bar over 80%", () => {
    render(<BudgetGauge agentName="test" currentUsd={45} maxUsd={50} period="monthly" isFrozen={false} />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ "--gauge-color": "var(--error)" });
  });

  it("shows frozen state", () => {
    render(<BudgetGauge agentName="test" currentUsd={52} maxUsd={50} period="monthly" isFrozen={true} />);
    expect(screen.getByText("Frozen")).toBeInTheDocument();
  });
});
```

---

## 5. E2E — PLAYWRIGHT

### Smoke tests (post-deploy)

```typescript
// e2e/smoke.spec.ts

import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("https://app.agentshield.io");
  await expect(page).toHaveTitle(/AgentShield/);
  await expect(page.locator("text=Start Free")).toBeVisible();
});

test("login flow works", async ({ page }) => {
  await page.goto("https://app.agentshield.io/login");
  await page.fill("[name=email]", "test@agentshield.io");
  await page.click("text=Send Magic Link");
  await expect(page.locator("text=Check your email")).toBeVisible();
});

test("dashboard loads after auth", async ({ page }) => {
  // Utiliser un token de test injecté
  await page.goto("https://app.agentshield.io/dashboard");
  await expect(page.locator("text=Today")).toBeVisible();
  await expect(page.locator("text=This Month")).toBeVisible();
});

test("POST /v1/track returns 201", async ({ request }) => {
  const response = await request.post("https://api.agentshield.io/v1/track", {
    headers: { Authorization: `Bearer ${process.env.TEST_API_KEY}` },
    data: {
      agent: "e2e-test-agent",
      model: "gpt-4o",
      input_tokens: 10,
      output_tokens: 5,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.event_id).toBeDefined();
});
```

---

## 6. CE QU'ON TESTE EN PRIORITÉ

### Tier 1 — Critique (si ça casse, le produit est mort)

```
✅ POST /v1/track — happy path, erreurs, edge cases
✅ API key verification — valid, invalid, revoked
✅ Pricing engine — calcul correct pour chaque provider
✅ PII redaction — chaque pattern, faux positifs
✅ Budget check — freeze, alert_only, Redis counter
✅ Guardrail evaluation — keyword, regex, block vs log
✅ Session UPSERT — création, update, fermeture
```

### Tier 2 — Important (si ça casse, certaines features ne marchent pas)

```
✅ Analytics aggregation — requêtes, résultats
✅ Alert rules — création, évaluation, cooldown
✅ Anomaly detection — z-score, baseline, insufficient data
✅ Forecast — regression, confidence interval
✅ Stripe webhooks — chaque event type
✅ WebSocket — connexion, auth, events
✅ SDK @shield() — sync, async, error handling
```

### Tier 3 — Nice to have (si ça casse, c'est gênant mais pas bloquant)

```
✅ Share links — création, expiration, access
✅ Session comparison
✅ PDF generation
✅ Slack bot responses
✅ Audit log entries
✅ Frontend components
```

---

## 7. CI COVERAGE TARGETS

```
Backend  : ≥ 80% (fail CI if under)
SDK      : ≥ 90% (c'est le produit — tolérance zéro)
Frontend : ≥ 60% (les composants UI sont plus difficiles à tester)
E2E      : Smoke tests uniquement (pas de coverage)
```

### Commandes CI

```bash
# Backend
cd backend && pytest tests/ -v --cov=app --cov-report=term-missing --cov-fail-under=80

# SDK
cd sdk && pytest tests/ -v --cov=agentshield --cov-report=term-missing --cov-fail-under=90

# Frontend
cd frontend && npx vitest run --coverage --coverage.thresholds.lines=60

# E2E (post-deploy uniquement)
cd e2e && npx playwright test smoke.spec.ts
```

---

## 8. RÈGLES DE TESTS

```
1. Chaque nouveau endpoint → au moins 3 tests (happy path, auth error, validation error)
2. Chaque bug fix → un test qui reproduit le bug AVANT de le fixer
3. Chaque exception SDK → un test qui vérifie qu'elle est levée correctement
4. Les tests sont indépendants (pas d'ordre d'exécution, pas d'état partagé)
5. Les tests n'appellent JAMAIS de services externes (Stripe, Claude API, Brevo)
6. Les mocks reproduisent le comportement réel (pas juste "return True")
7. Les fixtures sont réutilisables et composables
8. Les tests lents (> 1s) sont marqués @pytest.mark.slow
9. Les noms de tests décrivent le scénario ET le résultat attendu
10. Pas de print() dans les tests — utiliser assert
```

---

> **Règle :** Les tests sont le filet de sécurité. Sans eux, chaque deploy est un acte de foi.
> Le SDK a le coverage le plus strict (90%) car c'est ce que les développeurs utilisent directement.
