# SDK.md — SDK Python AgentShield

> Ce fichier définit le SDK Python `agentshield` : son API publique, son architecture interne, son packaging, et son comportement. Claude Code le lit avant de toucher au code dans sdk/.
> Cohérent avec : API.md (endpoints), SPEC.md (features), ERRORS.md (exceptions), PROTECT.md (PII/guardrails)
> Dernière mise à jour : mars 2026

---

## 1. EN UNE PHRASE

```bash
pip install agentshield
```

Le SDK est la porte d'entrée du produit. Si `@shield()` est pénible à utiliser, AgentShield est mort. L'expérience développeur prime sur tout.

---

## 2. API PUBLIQUE

### Imports principaux

```python
from agentshield import shield, session, set_budget, configure

from agentshield.exceptions import (
    AgentShieldError,
    AuthenticationError,
    AuthorizationError,
    BudgetExceededError,
    AgentFrozenError,
    GuardrailBlockedError,
    RateLimitError,
    ValidationError,
    ServerError,
    NetworkError,
)

# Intégrations frameworks
from agentshield.integrations import LangChainCallback
from agentshield.integrations import CrewAICallback
from agentshield.integrations import AutoGenCallback
from agentshield.integrations import LlamaIndexCallback
```

### configure() — Initialisation

```python
import agentshield

# Méthode 1 : variable d'environnement (recommandée)
# Le SDK lit automatiquement AGENTSHIELD_API_KEY
# Aucun appel configure() nécessaire

# Méthode 2 : configuration explicite
agentshield.configure(
    api_key="ags_live_xxxxx",           # Requis si pas de var env
    api_url="https://api.agentshield.io",  # Défaut, changeable pour self-host
    timeout=10,                          # Timeout HTTP en secondes (défaut 10)
    retry_max=3,                         # Retries max (défaut 3)
    retry_backoff=1.0,                   # Backoff initial en secondes (défaut 1.0)
    debug=False,                         # Active les logs SDK (défaut False)
    pii_redaction=True,                  # Redaction PII côté client (défaut True)
)
```

---

## 3. @shield() — DÉCORATEUR PRINCIPAL

### Usage basique

```python
from agentshield import shield

@shield(agent="my-agent")
def call_openai(prompt):
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response
```

### Usage complet

```python
@shield(
    agent="support-agent",          # Requis — nom de l'agent
    workflow="customer-support",     # Optionnel — catégorie
    user_label="user_456",          # Optionnel — end-user
    team_label="backend-team",      # Optionnel — équipe
    metadata={"version": "2.1"},    # Optionnel — données custom
)
def call_openai(prompt):
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response
```

### Ce que @shield() fait automatiquement

```
1. AVANT l'appel :
   → Vérifie que l'API key est configurée
   → Démarre un timer (pour duration_ms)

2. APRÈS l'appel (succès) :
   → Extrait le modèle, tokens, coût depuis la réponse
   → Détecte le provider depuis le type de réponse ou le model name
   → Extrait input_text (prompt) et output_text (response content)
   → Applique la PII redaction côté client (si activée)
   → Envoie POST /v1/track en async (non-blocking)
   → Retourne la réponse originale intacte

3. APRÈS l'appel (erreur) :
   → Envoie POST /v1/track avec status="error"
   → Re-raise l'exception originale (le SDK ne masque JAMAIS les erreurs de l'API IA)

4. Si POST /v1/track échoue :
   → Log l'erreur en debug mode
   → Ne JAMAIS bloquer le code du développeur
   → La réponse de l'API IA est retournée quoi qu'il arrive
```

### Extraction automatique des données

```python
# Le SDK détecte automatiquement le type de réponse :

# OpenAI
response.model           → model
response.usage.prompt_tokens    → input_tokens
response.usage.completion_tokens → output_tokens
response.choices[0].message.content → output_text

# Anthropic
response.model           → model
response.usage.input_tokens  → input_tokens
response.usage.output_tokens → output_tokens
response.content[0].text    → output_text

# Google Gemini
response.candidates[0].content.parts[0].text → output_text
response.usage_metadata.prompt_token_count → input_tokens
response.usage_metadata.candidates_token_count → output_tokens

# Inconnu → le dev doit passer les données manuellement via les params
```

### Async support

```python
from agentshield import shield

@shield(agent="my-agent")
async def call_openai_async(prompt):
    response = await openai_async_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response

# Le SDK détecte automatiquement si la fonction est async
# et utilise un transport async (httpx) pour le POST /v1/track
```

### Fallback manuel (quand l'extraction auto ne marche pas)

```python
from agentshield import shield

@shield(
    agent="custom-agent",
    model="custom-model-v3",
    provider="custom",
)
def call_custom_model(prompt):
    result = my_custom_api.call(prompt)

    # Injecter les données manuellement via le return
    shield.attach(
        input_tokens=len(prompt.split()),
        output_tokens=len(result.text.split()),
        cost_usd=result.billing.cost,
        input_text=prompt,
        output_text=result.text,
    )
    return result
```

---

## 4. session() — CONTEXT MANAGER REPLAY

### Usage

```python
from agentshield import shield, session

with session("ticket-123"):
    @shield(agent="classifier", step=1, step_name="classify")
    def classify(text):
        return openai.chat.completions.create(...)

    @shield(agent="responder", step=2, step_name="respond")
    def respond(category):
        return openai.chat.completions.create(...)

    category = classify("I need help with billing")
    response = respond(category)
```

### Comportement

```
1. session("ticket-123") ouvre un contexte
   → Tous les @shield() dans ce contexte héritent du session_id
   → Le step est auto-incrémenté si non fourni

2. À la sortie du context manager :
   → Si exception → la session est marquée "error"
   → Si normal → la session est marquée "success"
   → Pas d'appel API supplémentaire — le statut est déduit côté serveur
     (30 min sans event = session fermée)
```

### Sessions imbriquées

```python
# NON SUPPORTÉ — une seule session active par thread/coroutine
# Si session() est appelé dans un session() → ValueError
with session("outer"):
    with session("inner"):  # → ValueError: Nested sessions are not supported
        ...
```

### Thread safety

```python
# Chaque thread/coroutine a sa propre session via contextvars
import contextvars
_current_session = contextvars.ContextVar("agentshield_session", default=None)

# Donc safe pour :
# - Threading (chaque thread a son propre contexte)
# - Asyncio (chaque coroutine a son propre contexte)
```

---

## 5. set_budget() — BUDGET CAPS CÔTÉ CLIENT

### Usage

```python
from agentshield import set_budget, shield, BudgetExceededError

# Configurer un budget cap
set_budget(agent="my-agent", max_usd=50.0, period="monthly")

@shield(agent="my-agent")
def call_openai(prompt):
    response = openai.chat.completions.create(...)
    return response

# Le SDK vérifie le budget AVANT l'appel
try:
    result = call_openai("Hello")
except BudgetExceededError as e:
    print(f"Budget: ${e.current_usd}/{e.max_usd}")
    # Fallback : utiliser un modèle moins cher, queue, etc.
```

### Comportement

```
1. set_budget() enregistre le cap localement ET sur le serveur (POST /v1/budgets)
2. Avant chaque @shield() call :
   → Le SDK consulte le budget_status dans la dernière réponse track
   → Si budget_status == "exceeded" et action == "freeze" → BudgetExceededError
   → Le check côté serveur (middleware) est la source de vérité
   → Le check côté client est un fast-path pour éviter des appels API inutiles
3. Le budget_remaining_usd est mis à jour dans chaque réponse POST /v1/track
```

---

## 6. EXCEPTIONS

### Hiérarchie

```
AgentShieldError (base)
├── AuthenticationError          (401)
├── AuthorizationError           (403)
│   ├── GuardrailBlockedError    (403 — guardrail block)
│   └── PlanRequiredError        (403 — plan insuffisant)
├── ValidationError              (422)
├── RateLimitError               (429 — rate limit)
├── BudgetExceededError          (429 — budget cap)
├── AgentFrozenError             (400 — kill switch)
├── ServerError                  (500)
└── NetworkError                 (timeout, connexion refusée)
```

### Attributs communs

```python
class AgentShieldError(Exception):
    code: str              # Code erreur API (ex: "budget_exceeded")
    message: str           # Message lisible
    status_code: int       # HTTP status
    details: dict          # Données contextuelles
    request_id: str | None # X-AGS-Request-Id pour le debug
```

### Attributs spécifiques

```python
class BudgetExceededError(AgentShieldError):
    agent: str
    current_usd: float
    max_usd: float
    period: str

class GuardrailBlockedError(AgentShieldError):
    rule_id: str
    rule_name: str
    matched: str

class RateLimitError(AgentShieldError):
    limit: int
    remaining: int
    reset: int             # Unix timestamp
    retry_after: int       # Secondes

class AgentFrozenError(AgentShieldError):
    agent: str
    frozen_by: str         # "kill_switch" ou "budget_cap"
```

---

## 7. CLIENT HTTP INTERNE

### Architecture

```python
# sdk/agentshield/client.py

class AgentShieldClient:
    """HTTP client for the AgentShield API."""

    def __init__(self, api_key: str, api_url: str, timeout: int, retry_max: int, retry_backoff: float):
        self._api_key = api_key
        self._api_url = api_url.rstrip("/")
        self._timeout = timeout
        self._retry_max = retry_max
        self._retry_backoff = retry_backoff
        self._session = httpx.Client(timeout=timeout)
        self._async_session = httpx.AsyncClient(timeout=timeout)

    def track(self, event: TrackEvent) -> TrackResponse:
        """Send a tracking event (sync)."""
        return self._post("/v1/track", event.to_dict())

    async def track_async(self, event: TrackEvent) -> TrackResponse:
        """Send a tracking event (async)."""
        return await self._post_async("/v1/track", event.to_dict())
```

### Retry logic

```python
def _post(self, path: str, data: dict) -> dict:
    """POST with retry."""
    last_exc = None
    for attempt in range(self._retry_max + 1):
        try:
            response = self._session.post(
                f"{self._api_url}{path}",
                json=data,
                headers={"Authorization": f"Bearer {self._api_key}"},
            )

            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", 1))
                if attempt < self._retry_max:
                    time.sleep(retry_after)
                    continue
                raise RateLimitError.from_response(response)

            if response.status_code >= 500:
                if attempt < self._retry_max:
                    time.sleep(self._retry_backoff * (2 ** attempt))
                    continue
                raise ServerError.from_response(response)

            if response.status_code >= 400:
                raise AgentShieldError.from_response(response)

            return response.json()

        except httpx.TimeoutException as exc:
            last_exc = exc
            if attempt < self._retry_max:
                time.sleep(self._retry_backoff * (2 ** attempt))
                continue

    raise NetworkError(f"Request failed after {self._retry_max + 1} attempts", cause=last_exc)
```

### Principe fondamental

```
Le SDK ne bloque JAMAIS le code du développeur.

Si POST /v1/track échoue (timeout, 500, network error) :
  → Log l'erreur en debug mode
  → Retourne un TrackResponse vide
  → Le code du développeur continue normalement

Exceptions que le SDK lève au développeur :
  → BudgetExceededError (429 budget) — le dev DOIT gérer ça
  → AgentFrozenError (400) — le dev DOIT gérer ça
  → GuardrailBlockedError (403) — le dev DOIT gérer ça
  → AuthenticationError (401) — configuration incorrecte

Exceptions que le SDK avale silencieusement :
  → ServerError (500) — problème AgentShield, pas du dev
  → NetworkError — timeout, connexion refusée
  → RateLimitError — le SDK retry automatiquement
```

---

## 8. PII REDACTION CÔTÉ CLIENT

### Fonctionnement

```python
# sdk/agentshield/pii.py

import re

PII_PATTERNS = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "phone": re.compile(r"\+?[\d\s\-().]{7,20}"),
    "credit_card": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "ip": re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),
}

def redact_pii(text: str, patterns: list[str] | None = None) -> tuple[str, list[str]]:
    """Redact PII from text. Returns (redacted_text, detected_types)."""
    if not text:
        return text, []

    detected = []
    active_patterns = patterns or list(PII_PATTERNS.keys())

    for pii_type in active_patterns:
        pattern = PII_PATTERNS.get(pii_type)
        if pattern and pattern.search(text):
            detected.append(pii_type)
            text = pattern.sub(f"[REDACTED:{pii_type}]", text)

    return text, detected
```

### Quand la redaction s'applique

```
1. pii_redaction=True dans configure() (défaut)
2. Le SDK redacte input_text et output_text AVANT de les envoyer au serveur
3. Le serveur fait un SECOND pass de redaction (defense in depth)
4. Le développeur peut désactiver : agentshield.configure(pii_redaction=False)
   → Le serveur applique quand même sa propre redaction
```

---

## 9. INTÉGRATIONS FRAMEWORKS

### LangChain

```python
from agentshield.integrations import LangChainCallback

# Usage avec LangChain
callback = LangChainCallback(agent="my-langchain-agent")

llm = ChatOpenAI(model="gpt-4o", callbacks=[callback])
result = llm.invoke("Hello")

# Le callback capture automatiquement :
# - on_llm_start → session start, input_text
# - on_llm_end → output_text, tokens, cost, duration
# - on_llm_error → status="error"
# - on_chain_start/end → session steps
# - on_tool_start/end → tool calls as steps
```

### CrewAI

```python
from agentshield.integrations import CrewAICallback

callback = CrewAICallback(agent="my-crew")

# S'injecte dans CrewAI via le callback system
crew = Crew(agents=[...], tasks=[...], callbacks=[callback])
result = crew.kickoff()

# Capture : chaque agent CrewAI = un step, chaque task = une session
```

### AutoGen

```python
from agentshield.integrations import AutoGenCallback

callback = AutoGenCallback(agent="my-autogen-group")

# S'injecte via le hook system AutoGen
# Capture : chaque message entre agents = un step
```

### LlamaIndex

```python
from agentshield.integrations import LlamaIndexCallback

callback = LlamaIndexCallback(agent="my-index-agent")

# S'injecte via le callback manager LlamaIndex
# Capture : query, retrieve, synthesize comme steps séparés
```

### Pattern commun des callbacks

```python
# sdk/agentshield/integrations/base.py

class BaseCallback:
    """Base class for framework integration callbacks."""

    def __init__(self, agent: str, **kwargs):
        self._agent = agent
        self._kwargs = kwargs
        self._session_id: str | None = None
        self._step_counter: int = 0

    def _track(self, **event_data):
        """Send a tracking event."""
        from agentshield import _get_client
        client = _get_client()
        client.track(TrackEvent(
            agent=self._agent,
            session_id=self._session_id,
            step=self._step_counter,
            **self._kwargs,
            **event_data,
        ))
        self._step_counter += 1
```

---

## 10. PACKAGING PyPI

### pyproject.toml

```toml
[project]
name = "agentshield"
version = "0.1.0"
description = "The complete observability suite for AI agents — Monitor, Replay, Protect."
readme = "README.md"
license = { text = "MIT" }
requires-python = ">=3.9"
authors = [{ name = "Nova", email = "novaships.dev@outlook.com" }]
keywords = ["ai", "llm", "observability", "monitoring", "agents", "cost-tracking"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Topic :: Software Development :: Libraries",
]

dependencies = [
    "httpx>=0.25.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-cov>=5.0",
    "pytest-asyncio>=0.23",
    "ruff>=0.4.0",
    "respx>=0.21.0",
]

[project.urls]
Homepage = "https://agentshield.io"
Documentation = "https://docs.agentshield.io"
Repository = "https://github.com/NovaShips/agentshield"
Changelog = "https://github.com/NovaShips/agentshield/blob/main/CHANGELOG.md"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["agentshield"]
```

### Dépendance unique

```
httpx — le seul runtime dependency

Pourquoi httpx et pas requests :
- Support async natif (pas besoin d'aiohttp en plus)
- HTTP/2 support
- Timeout configurable proprement
- Plus moderne, activement maintenu
- Pas de dependency tree large
```

### README PyPI (sdk/README.md)

```markdown
# AgentShield

> The complete observability suite for AI agents.

Monitor costs. Replay every session. Protect with guardrails.
One SDK. One line of code.

## Quick Start

​```bash
pip install agentshield
​```

​```python
from agentshield import shield

@shield(agent="my-agent")
def call_openai(prompt):
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response
​```

That's it. Your costs, sessions, and violations are now tracked
at [app.agentshield.io](https://app.agentshield.io).

## Features

- **Monitor** — Real-time cost tracking, smart alerts, forecast
- **Replay** — Step-by-step session timeline for debugging
- **Protect** — Guardrails, PII redaction, budget caps, kill switch

## Frameworks

Works with any LLM framework:

​```python
# LangChain
from agentshield.integrations import LangChainCallback
callbacks = [LangChainCallback(agent="my-agent")]

# CrewAI, AutoGen, LlamaIndex — same pattern
​```

## Docs

[docs.agentshield.io](https://docs.agentshield.io)

## License

MIT
```

---

## 11. VERSIONING

### Semantic versioning

```
MAJOR.MINOR.PATCH

0.1.0 — Launch MVP
0.1.1 — Bug fixes
0.2.0 — New feature (ex: session comparison)
1.0.0 — Stable API (quand on est sûr du contrat)
```

### Breaking changes

```
Avant 1.0.0 : les breaking changes sont permis dans les MINOR (0.x.0)
Après 1.0.0 : les breaking changes ne sont permis que dans les MAJOR (x.0.0)

Un breaking change = :
- Renommer un import public
- Changer la signature d'une fonction publique
- Supprimer une exception
- Changer le comportement par défaut de @shield()
```

### Release process

```bash
# 1. Mettre à jour la version dans pyproject.toml
# 2. Mettre à jour CHANGELOG.md
# 3. Committer
git add . && git commit -m "chore: release sdk v0.1.0"

# 4. Tag
git tag sdk-v0.1.0

# 5. Push (déclenche le workflow publish-sdk.yml)
git push origin main --tags
```

---

## 12. STRUCTURE DES FICHIERS

```
sdk/
├── agentshield/
│   ├── __init__.py              ← Exports publics
│   ├── client.py                ← Client HTTP (httpx + retry)
│   ├── shield.py                ← Décorateur @shield()
│   ├── sessions.py              ← Context manager session()
│   ├── steps.py                 ← Step tracking auto-increment
│   ├── budgets.py               ← set_budget() + BudgetExceededError
│   ├── guardrails.py            ← Check côté client (fast-path)
│   ├── pii.py                   ← PII redaction côté client
│   ├── pricing.py               ← Table prix locale (fallback)
│   ├── extractors.py            ← Auto-extraction OpenAI/Anthropic/Google
│   ├── models.py                ← Dataclasses (TrackEvent, TrackResponse)
│   ├── exceptions.py            ← Exceptions SDK
│   ├── _config.py               ← Configuration interne
│   └── integrations/
│       ├── __init__.py
│       ├── base.py              ← BaseCallback
│       ├── langchain.py         ← LangChainCallback
│       ├── crewai.py            ← CrewAICallback
│       ├── autogen.py           ← AutoGenCallback
│       └── llamaindex.py        ← LlamaIndexCallback
│
├── tests/
│   ├── test_shield.py           ← Tests @shield() sync + async
│   ├── test_client.py           ← Tests HTTP client + retry
│   ├── test_sessions.py         ← Tests session context manager
│   ├── test_budgets.py          ← Tests budget check
│   ├── test_guardrails.py       ← Tests guardrail client-side
│   ├── test_pii.py              ← Tests PII redaction patterns
│   ├── test_extractors.py       ← Tests extraction auto OpenAI/Anthropic
│   ├── test_pricing.py          ← Tests calcul de coût local
│   └── test_integrations.py     ← Tests LangChain/CrewAI callbacks
│
├── pyproject.toml
├── README.md
└── .env.example
```

---

## 13. TESTS DU SDK

### Mocking API

```python
# tests/conftest.py

import respx
import pytest

@pytest.fixture
def mock_api():
    """Mock the AgentShield API."""
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
```

### Exemples de tests

```python
# tests/test_shield.py

def test_shield_basic_openai(mock_api):
    """@shield captures OpenAI response correctly."""
    @shield(agent="test")
    def call():
        return MockOpenAIResponse(model="gpt-4o", input_tokens=100, output_tokens=50)

    result = call()
    assert result.model == "gpt-4o"
    assert mock_api["POST /v1/track"].called

def test_shield_does_not_block_on_api_failure(mock_api):
    """SDK never blocks developer code even if API fails."""
    mock_api.post("/v1/track").respond(500)

    @shield(agent="test")
    def call():
        return "success"

    result = call()
    assert result == "success"  # L'appel du dev réussit quand même

def test_shield_raises_budget_exceeded(mock_api):
    """SDK raises BudgetExceededError on 429 budget."""
    mock_api.post("/v1/track").respond(429, json={
        "error": {"code": "budget_exceeded", "message": "...", "details": {...}}
    })

    @shield(agent="test")
    def call():
        return "success"

    with pytest.raises(BudgetExceededError):
        call()
```

---

## 14. PRICING TABLE LOCALE

```python
# sdk/agentshield/pricing.py

PRICING_TABLE = {
    "openai": {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "gpt-4": {"input": 30.00, "output": 60.00},
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    },
    "anthropic": {
        "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
        "claude-haiku-4-5": {"input": 0.80, "output": 4.00},
        "claude-opus-4-6": {"input": 15.00, "output": 75.00},
    },
    "google": {
        "gemini-pro": {"input": 1.25, "output": 5.00},
        "gemini-flash": {"input": 0.075, "output": 0.30},
    },
}

def calculate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> float | None:
    """Calculate cost in USD. Returns None if model not found."""
    pricing = PRICING_TABLE.get(provider, {}).get(model)
    if not pricing:
        return None
    return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
```

**Note :** La pricing table locale est un fallback. Le serveur a la table à jour (mise à jour quotidiennement par Celery). Si le SDK envoie `cost_usd` calculé localement et que le serveur a un prix différent, le serveur recalcule.

---

> **Règle :** Le SDK est le visage du produit pour les développeurs. Chaque décision d'API doit privilégier la simplicité d'usage.
> Le SDK ne bloque JAMAIS le code du développeur sauf pour les erreurs critiques (budget, guardrail, auth).
> Un développeur qui ne lit pas la doc doit pouvoir utiliser `@shield(agent="x")` et que ça marche.
