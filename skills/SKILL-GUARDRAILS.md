# SKILL-GUARDRAILS.md — Comment coder les guardrails

> Lire AVANT de toucher aux règles de protection, à l'évaluation, ou aux violations. Réfs : PROTECT.md (section 2), SPEC.md (section 14)

---

## TYPES

```
keyword  → string match (exact ou substring, case sensitive configurable)
regex    → regular expression match
topic    → classification par groupes de mots-clés
category → listes noires pré-définies (hate_speech, self_harm, etc.)
```

## ACTIONS

```
log    → event stocké normalement, violation loggée, notification
redact → contenu matché remplacé par [BLOCKED:rule_name], event stocké
block  → event rejeté (403), SDK reçoit GuardrailBlockedError
```

## ÉVALUATION (SYNC — middleware)

```python
# LATENCE MAX : 5ms total
# Les rules sont en cache Redis (TTL 5min)
# L'évaluation est dans l'ordre de création
# Un event peut matcher plusieurs rules
# Si au moins un "block" → l'event est rejeté

for rule in rules:
    match = evaluate_rule(rule, content)
    if match:
        violations.append(...)

if any(v["action"] == "block" for v in violations):
    raise GuardrailBlockedError(...)
```

## LOGGING (ASYNC — Celery task)

```python
# La détection est SYNC (middleware)
# Le logging est ASYNC (ne bloque pas la réponse)

log_violation.delay({
    "rule_id": ...,
    "event_id": ...,
    "agent_id": ...,
    "session_id": ...,
    "matched_content": ...,  # Tronqué à 100 chars
    "action_taken": ...,
})
```

## RULES CACHE

```python
# Redis key : guardrails:{org_id}
# TTL : 5 minutes
# Invalidé quand : rule créée, modifiée, ou supprimée

# Après CRUD sur une rule :
await redis.delete(f"guardrails:{org_id}")
```

## RÈGLES

```
1. Pro+ uniquement (vérifier le plan)
2. Max 30 rules par org
3. L'évaluation s'applique sur input_text + output_text
4. Les rules sont évaluées dans l'ordre de création
5. "block" gagne sur "log" si un event matche les deux
6. La latence du check doit être < 5ms (rules en cache Redis)
7. Les category keywords sont hardcodées (CATEGORY_KEYWORDS dict)
8. Les topic keywords sont configurés par le user dans le JSON config
9. Les violations sont liées à un event (pour le lien vers Replay)
```
