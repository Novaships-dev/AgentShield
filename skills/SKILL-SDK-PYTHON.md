# SKILL-SDK-PYTHON.md — Comment coder le SDK Python agentshield

> Lire AVANT de toucher au code dans sdk/.
> Réfs : SDK.md, API.md, ERRORS.md

---

## PRINCIPE #1 : NE JAMAIS BLOQUER LE DEV

```python
# Le SDK AVALE silencieusement les erreurs de tracking.
# Le code du développeur fonctionne TOUJOURS.

# ✅ Correct
@shield(agent="my-agent")
def call_openai(prompt):
    return openai.chat.completions.create(...)
# Si AgentShield API est down → le dev récupère sa réponse OpenAI normalement

# Exceptions QU'ON LÈVE au dev (il DOIT les gérer) :
# - BudgetExceededError (budget cap atteint, mode freeze)
# - AgentFrozenError (kill switch actif)
# - GuardrailBlockedError (guardrail action=block)
# - AuthenticationError (API key invalide — config error)

# Exceptions QU'ON AVALE :
# - ServerError (5xx) → log debug, continue
# - NetworkError (timeout) → log debug, continue
# - RateLimitError → retry automatique, transparent
```

## STRUCTURE @shield()

```python
# sdk/agentshield/shield.py

import functools
import time
from contextvars import ContextVar

_session_ctx: ContextVar[str | None] = ContextVar("ags_session", default=None)
_step_ctx: ContextVar[int] = ContextVar("ags_step", default=0)

def shield(agent: str, **kwargs):
    """Decorator to track AI API calls."""

    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **call_kwargs):
                start = time.time()
                try:
                    result = await func(*args, **call_kwargs)
                    _send_event(agent, result, start, "success", kwargs)
                    return result
                except Exception as exc:
                    _send_event(agent, None, start, "error", kwargs, error=exc)
                    raise  # TOUJOURS re-raise l'exception du dev
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **call_kwargs):
                start = time.time()
                try:
                    result = func(*args, **call_kwargs)
                    _send_event(agent, result, start, "success", kwargs)
                    return result
                except Exception as exc:
                    _send_event(agent, None, start, "error", kwargs, error=exc)
                    raise
            return sync_wrapper
    return decorator
```

## EXTRACTION AUTO

```python
# sdk/agentshield/extractors.py

def extract_openai(response) -> dict:
    """Extract data from OpenAI ChatCompletion response."""
    return {
        "model": response.model,
        "provider": "openai",
        "input_tokens": response.usage.prompt_tokens,
        "output_tokens": response.usage.completion_tokens,
        "output_text": response.choices[0].message.content if response.choices else None,
    }

def extract_anthropic(response) -> dict:
    """Extract data from Anthropic Message response."""
    return {
        "model": response.model,
        "provider": "anthropic",
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "output_text": response.content[0].text if response.content else None,
    }

def auto_extract(response) -> dict | None:
    """Try all extractors. Return None if no match."""
    for extractor in [extract_openai, extract_anthropic, extract_google]:
        try:
            return extractor(response)
        except (AttributeError, TypeError, IndexError):
            continue
    return None
```

## HTTP CLIENT — RETRY

```python
# sdk/agentshield/client.py

# Retry sur : 429 (rate limit), 5xx (server error), timeout
# PAS de retry sur : 400, 401, 403, 422 (erreurs client)

# Backoff exponentiel : 1s, 2s, 4s (max 3 retries)
# 429 : utiliser Retry-After header si présent

# Timeout : 10s par défaut (configurable)
# Méthode : httpx (sync + async)
```

## THREAD SAFETY

```python
# session() utilise contextvars → safe pour threading + asyncio
# Le client httpx est thread-safe
# Les configs sont immutables après configure()
```

## PACKAGING

```
- Une seule dépendance runtime : httpx
- Python >= 3.9 supporté
- Pas de dépendance sur openai/anthropic/langchain (optionnel)
- Build avec hatchling
- Publish via GitHub Actions sur tag sdk-v*
```

## TESTS

```
- Mock HTTP avec respx (pas de vrais appels API)
- Tester sync ET async
- Tester extraction OpenAI, Anthropic, Google
- Tester PII redaction
- Tester budget check (raise BudgetExceededError)
- Tester que le SDK ne bloque JAMAIS sur API failure
- Coverage cible : 90%
```
