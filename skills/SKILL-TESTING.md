# SKILL-TESTING.md — Comment écrire les tests dans AgentShield

> Lire AVANT d'écrire un test. Réfs : TESTS.md

---

## BACKEND — PYTEST

```python
# Naming : test_{function}_{scenario}_{expected}
# Fixtures : conftest.py (mock_redis, mock_db, test_org, auth_headers)
# Celery : CELERY_TASK_ALWAYS_EAGER=true en tests
# Mocking : AsyncMock pour Supabase/Redis, respx pour HTTP

@pytest.mark.asyncio
async def test_track_event_valid_returns_201(client, auth_headers):
    response = await client.post("/v1/track", json={"agent": "test", "model": "gpt-4o", "input_tokens": 100, "output_tokens": 50}, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["cost_usd"] is not None
```

## SDK — PYTEST + RESPX

```python
# Mock API avec respx, pas de vrais appels
# Tester que @shield ne bloque JAMAIS sur erreur API
# Tester les exceptions levées au dev (Budget, Guardrail, Frozen)
# Coverage : 90%
```

## FRONTEND — VITEST

```typescript
// render() + screen.getBy/findBy
// Mock API avec MSW ou fetch mock
// Tester les composants isolément avec des props
// Coverage : 60%
```

## RÈGLES

```
1. Chaque endpoint → min 3 tests (happy, auth error, validation error)
2. Chaque bug fix → test qui reproduit le bug d'abord
3. Tests indépendants (pas d'état partagé, pas d'ordre)
4. Jamais d'appels externes en test (tout mocké)
5. Coverage CI : backend 80%, SDK 90%, frontend 60%
```
