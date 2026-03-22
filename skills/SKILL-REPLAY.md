# SKILL-REPLAY.md — Comment coder le module Replay

> Lire AVANT de toucher aux sessions, à la timeline, au partage, ou à la comparaison. Réfs : REPLAY.md, SPEC.md (sections 10-13)

---

## CAPTURE

```
SDK envoie session_id + step + step_name dans POST /v1/track
  → Backend UPSERT la session (Redis state + DB persistence)
  → PII redaction sur input_text/output_text
  → input_redacted/output_redacted TOUJOURS stockés
  → input_text/output_text stockés UNIQUEMENT si store_original=true

Session fermée = aucun event pendant 30 minutes
  → Celery task vérifie les sessions "running" toutes les 5 min
```

## TIMELINE CONSTRUCTION

```python
# Charger les events de la session, ordonnés par step puis tracked_at
events = await db.from_("events") \
    .select("*") \
    .eq("organization_id", org_id) \
    .eq("session_id", session_id) \
    .order("step") \
    .order("tracked_at") \
    .execute()

# Chaque event = un step dans la timeline
# Inclure : step, step_name, agent, model, cost, duration, status, PII, violations
# Afficher input_redacted par défaut (input_text seulement pour owner/admin + store_original)
```

## PARTAGE

```
1. Générer share_token (UUID + 8 chars random)
2. Stocker dans shared_sessions avec expiration
3. URL : /share/{token} — page publique, read-only
4. PII TOUJOURS redacté dans les share links
5. Pas d'accès au reste du dashboard
6. Max 50 share links actifs par org
```

## COMPARAISON

```
1. Charger 2 timelines
2. Matcher les steps par step_name
3. Identifier les divergences : steps manquants, coûts différents, modèles différents
4. Afficher en split-screen
5. Pro+ uniquement
```

## RÈGLES

```
1. Replay nécessite Starter+ (vérifier le plan)
2. input_text/output_text capturés uniquement si le plan le permet
3. PII redaction AVANT stockage (jamais après)
4. Les share links ne montrent JAMAIS les contenus bruts
5. Sessions > 500 steps → pagination (50 par page)
6. Sessions "running" → animation pulse + WebSocket updates
7. La timeline est la feature de vente #1 de Replay — elle doit être rapide (< 300ms)
```
