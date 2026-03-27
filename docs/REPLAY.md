# REPLAY.md — Module Replay AgentShield

> Ce fichier définit le module Replay en détail technique : capture des sessions, stockage des steps, construction de la timeline, partage, comparaison. Claude Code le lit avant de toucher au code Replay.
> Cohérent avec : SPEC.md (sections 10-13), ARCH.md (tables sessions/events), API.md (endpoints sessions), SECURITY.md (PII)
> Dernière mise à jour : mars 2026

---

## 1. PRINCIPE

Replay permet de rejouer chaque session d'un agent IA step by step — voir exactement ce qui s'est passé, dans quel ordre, avec quels inputs/outputs, à quel coût.

```
Sans Replay :
  "L'agent a échoué sur 3% des sessions."
  "Quel step ? Quel input ? Quelle erreur ?"
  → Silence.

Avec Replay :
  Session ticket-123 → Step 4 → Agent "responder" → gpt-4o
  Input: "Customer asks about refund for order #4521"
  Output: ERROR — context window exceeded (8192 tokens)
  Cost: $0.18 — 3x plus cher que la moyenne
  Duration: 2.1s — timeout imminent
  → Le problème est identifié en 10 secondes.
```

**Plan requis : Starter+ (€49/mois)**

---

## 2. CONCEPTS

### Session
Un groupe d'events liés par un `session_id`. Représente un workflow complet (ex: un ticket de support traité de bout en bout par plusieurs agents).

```
Session "ticket-123"
├── Step 1: classifier    (gpt-4o-mini, $0.001, 120ms)
├── Step 2: retriever     (gpt-4o, $0.018, 2100ms)
├── Step 3: responder     (gpt-4o, $0.180, 2100ms) ← le plus cher
├── Step 4: summarizer    (gpt-4o-mini, $0.002, 340ms)
└── Total: 4 steps, $0.201, 4.66s
```

### Step
Un event individuel dans une session. Chaque appel API IA = un step.

### Step data

| Champ | Source | Description |
|-------|--------|-------------|
| step | SDK param ou auto-increment | Numéro d'ordre dans la session |
| step_name | SDK param | Nom lisible ("classify", "respond") |
| agent | SDK param | Nom de l'agent qui a exécuté ce step |
| model | Auto-détecté ou SDK param | Modèle IA utilisé |
| input_text | Auto-capturé ou SDK param | Le prompt envoyé à l'API IA |
| output_text | Auto-capturé ou SDK param | La réponse de l'API IA |
| input_redacted | Serveur (PII middleware) | Version PII-redactée du prompt |
| output_redacted | Serveur (PII middleware) | Version PII-redactée de la réponse |
| cost_usd | Auto-calculé ou SDK param | Coût de ce step |
| duration_ms | SDK timer | Durée de l'appel |
| status | Auto-détecté | "success" / "error" / "timeout" |
| guardrail_violations | Serveur (guardrail middleware) | Violations détectées sur ce step |
| pii_detected | Serveur (PII middleware) | Types de PII trouvés |

---

## 3. CAPTURE DES SESSIONS

### Côté SDK

```python
from agentshield import shield, session

# Le dev définit le session_id
with session("ticket-123"):

    # Chaque @shield() dans ce contexte hérite du session_id
    @shield(agent="classifier", step_name="classify")
    def classify(text):
        return openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": text}],
        )

    @shield(agent="responder", step_name="respond")
    def respond(category, context):
        return openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": context},
                {"role": "user", "content": f"Category: {category}"},
            ],
        )

    result1 = classify("I need help with billing")
    result2 = respond(result1, billing_faq)
```

### Ce que le SDK envoie (2 POST /v1/track)

```json
// Step 1
{
    "agent": "classifier",
    "session_id": "ticket-123",
    "step": 1,
    "step_name": "classify",
    "model": "gpt-4o-mini",
    "input_tokens": 45,
    "output_tokens": 8,
    "input_text": "I need help with billing",
    "output_text": "billing_inquiry",
    "status": "success",
    "duration_ms": 120
}

// Step 2
{
    "agent": "responder",
    "session_id": "ticket-123",
    "step": 2,
    "step_name": "respond",
    "model": "gpt-4o",
    "input_tokens": 1250,
    "output_tokens": 340,
    "input_text": "Category: billing_inquiry\n[system context]...",
    "output_text": "I can help you with your billing...",
    "status": "success",
    "duration_ms": 2100
}
```

### Côté serveur — Gestion de la session

```python
# app/services/sessions.py

async def upsert_session(org_id: str, event: TrackEvent) -> None:
    """Create or update a session from an incoming event."""
    if not event.session_id:
        return  # Pas de session_id → pas de Replay

    session_key = f"session:{org_id}:{event.session_id}"

    # Mise à jour atomique dans Redis (état en cours)
    pipe = redis.pipeline()
    pipe.hincrby(session_key, "total_steps", 1)
    pipe.hincrbyfloat(session_key, "total_cost_usd", float(event.cost_usd or 0))
    pipe.hincrby(session_key, "total_tokens", event.total_tokens)
    pipe.hset(session_key, "last_event_at", datetime.utcnow().isoformat())
    pipe.hset(session_key, "status", "running")
    pipe.expire(session_key, 3600)  # TTL 1h
    await pipe.execute()

    # UPSERT en DB (pour persistence)
    await db.rpc("upsert_session", {
        "p_org_id": org_id,
        "p_session_id": event.session_id,
        "p_agent_id": event.agent_id,
        "p_cost": float(event.cost_usd or 0),
        "p_tokens": event.total_tokens,
        "p_status": event.status,
    }).execute()
```

### Fermeture de session

```
Une session est "fermée" quand :
  - Aucun event avec ce session_id pendant 30 minutes
  - Le status passe de "running" à "success" ou "error"

Logique :
  - Le Celery task "aggregation.compute_hourly" vérifie les sessions "running"
  - Si last_event_at > 30 min ago → fermer la session
  - Status final :
    → "success" si aucun event avec status="error"
    → "error" si au moins un event avec status="error"
    → "partial" si certains steps OK et certains en erreur
```

---

## 4. STOCKAGE

### Données stockées par event (pour Replay)

```
events table :
├── session_id          → Lien avec la session
├── step                → Numéro d'ordre
├── step_name           → Nom lisible
├── input_text          → NULL si store_original=false (défaut)
├── output_text         → NULL si store_original=false (défaut)
├── input_redacted      → TOUJOURS rempli (version PII-nettoyée)
├── output_redacted     → TOUJOURS rempli (version PII-nettoyée)
├── status              → success / error / timeout
├── duration_ms         → Durée de l'appel
└── guardrail_violations → JSON array des violations
```

### Privacy by default

```
Par défaut :
  - input_text = NULL (pas stocké)
  - output_text = NULL (pas stocké)
  - input_redacted = version nettoyée (PII remplacé par [REDACTED:xxx])
  - output_redacted = version nettoyée

Le Replay affiche input_redacted et output_redacted.
C'est suffisant pour debugger dans 90% des cas.

Si le dev veut les contenus bruts :
  1. Activer store_original=true dans /dashboard/pii (Pro+)
  2. Les contenus bruts sont alors stockés dans input_text / output_text
  3. Seuls owner et admin peuvent les voir dans le Replay
  4. Les share links montrent TOUJOURS la version redactée
```

---

## 5. TIMELINE UI

### Construction de la timeline

```python
# app/services/replay.py

async def get_session_timeline(org_id: str, session_id: str, viewer_role: str, store_original: bool) -> dict:
    """Build the complete session timeline for the Replay UI."""

    # 1. Charger la session
    session = await db.from_("sessions") \
        .select("*") \
        .eq("organization_id", org_id) \
        .eq("session_id", session_id) \
        .single() \
        .execute()

    # 2. Charger tous les events de la session, ordonnés
    events = await db.from_("events") \
        .select("*") \
        .eq("organization_id", org_id) \
        .eq("session_id", session_id) \
        .order("step", desc=False) \
        .order("tracked_at", desc=False) \
        .execute()

    # 3. Construire les steps
    steps = []
    for event in events.data:
        step = {
            "event_id": event["id"],
            "step": event["step"],
            "step_name": event["step_name"],
            "agent": event["agent_name"],  # JOIN
            "model": event["model"],
            "provider": event["provider"],
            "input_tokens": event["input_tokens"],
            "output_tokens": event["output_tokens"],
            "cost_usd": event["cost_usd"],
            "duration_ms": event["duration_ms"],
            "status": event["status"],
            "pii_detected": extract_pii_types(event),
            "guardrail_violations": event["guardrail_violations"],
            "tracked_at": event["tracked_at"],
        }

        # Contenus — privacy check
        if viewer_role in ("owner", "admin") and store_original and event["input_text"]:
            step["input_text"] = event["input_text"]
            step["output_text"] = event["output_text"]
        step["input_redacted"] = event["input_redacted"]
        step["output_redacted"] = event["output_redacted"]

        steps.append(step)

    return {
        "session_id": session_id,
        "status": session.data["status"],
        "total_cost_usd": session.data["total_cost_usd"],
        "total_tokens": session.data["total_tokens"],
        "total_steps": len(steps),
        "duration_ms": session.data["duration_ms"],
        "started_at": session.data["started_at"],
        "ended_at": session.data["ended_at"],
        "agents_involved": list(set(s["agent"] for s in steps)),
        "steps": steps,
    }
```

### Composants frontend

```
SessionTimeline.tsx
├── Timeline bar (horizontal, scrollable)
│   ├── Step dots (clickable)
│   │   ├── 🟢 success
│   │   ├── 🔴 error
│   │   └── 🟡 timeout
│   └── Connecting lines (proportionnelles à la durée)
│
├── Step detail panel (apparaît au clic sur un dot)
│   ├── Header: step number, name, agent, model
│   ├── Badges: cost, duration, tokens
│   ├── Input panel (scrollable, code-formatted)
│   │   └── PII highlighted: [REDACTED:email] en orange
│   ├── Output panel (scrollable, code-formatted)
│   ├── Violations (si présentes)
│   └── Cost Autopilot suggestion (si disponible)
│
└── Session stats bar
    ├── Total cost, Total duration, Total steps
    ├── Error count
    └── Most expensive step highlight
```

---

## 6. PARTAGE DE SESSION

### Flow

```
1. User clique [Share] sur une session
2. Modal : choisir expiration (1h, 24h, 7d, never)
3. Backend génère un share_token (UUID + 8 chars)
4. URL retournée : https://app.agentshield.one/share/{token}
5. La page /share/[token] charge la timeline en read-only
```

### Implémentation

```python
# app/services/replay.py

import secrets

async def create_share_link(org_id: str, session_id: str, user_id: str, expires_in: str) -> dict:
    """Generate a shareable link for a session."""
    token = f"{uuid4()}-{secrets.token_urlsafe(6)}"

    expires_map = {
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "never": None,
    }
    expires_at = datetime.utcnow() + expires_map[expires_in] if expires_map[expires_in] else None

    await db.from_("shared_sessions").insert({
        "organization_id": org_id,
        "session_id": session_id,
        "share_token": token,
        "created_by": user_id,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "is_active": True,
    }).execute()

    return {
        "share_token": token,
        "share_url": f"https://app.agentshield.one/share/{token}",
        "expires_at": expires_at,
    }
```

### Vue partagée

```
La page /share/[token] :
  ✅ Affiche la timeline complète
  ✅ Affiche les steps avec input_redacted / output_redacted
  ✅ Affiche le coût, la durée, le statut
  ❌ N'affiche PAS les contenus bruts (même si store_original=true)
  ❌ N'a PAS accès au dashboard
  ❌ N'a PAS accès aux autres sessions
  ❌ Pas de sidebar, pas de nav — juste la timeline
```

---

## 7. COMPARAISON DE SESSIONS

### User story
"Pourquoi ticket-123 a coûté $0.47 alors que ticket-124 n'a coûté que $0.31 ? Qu'est-ce qui a changé ?"

### Vue comparison (Pro+)

```
┌─────────────────────────────┬─────────────────────────────┐
│ Session: ticket-123         │ Session: ticket-124         │
│ Cost: $0.47 | 12 steps     │ Cost: $0.31 | 8 steps      │
│ Duration: 4m 23s            │ Duration: 2m 11s            │
├─────────────────────────────┼─────────────────────────────┤
│                             │                             │
│ Step 1: classify  $0.001   │ Step 1: classify  $0.001   │  ← identique
│ Step 2: retrieve  $0.018   │ Step 2: retrieve  $0.015   │  ← similaire
│ Step 3: respond   $0.180 ⚠️│ Step 3: respond   $0.042   │  ← divergence
│ Step 4: validate  $0.012   │ (absent)                    │  ← step manquant
│ ...                         │ ...                         │
│                             │                             │
└─────────────────────────────┴─────────────────────────────┘

Divergences détectées :
  - Step 3: coût 4.3x plus élevé (gpt-4o $0.18 vs gpt-4o-mini $0.042)
  - Steps 4-8: présents dans ticket-123 mais absents dans ticket-124
  - Durée totale: 2x plus long
```

### Implémentation

```python
# app/services/replay.py

async def compare_sessions(org_id: str, session_id_a: str, session_id_b: str) -> dict:
    """Compare two sessions side by side."""
    timeline_a = await get_session_timeline(org_id, session_id_a, "admin", False)
    timeline_b = await get_session_timeline(org_id, session_id_b, "admin", False)

    divergences = []

    # Comparer step par step (par step_name)
    steps_a = {s["step_name"]: s for s in timeline_a["steps"]}
    steps_b = {s["step_name"]: s for s in timeline_b["steps"]}

    all_step_names = set(steps_a.keys()) | set(steps_b.keys())

    for name in sorted(all_step_names):
        a = steps_a.get(name)
        b = steps_b.get(name)

        if a and not b:
            divergences.append({"type": "missing_in_b", "step_name": name, "cost_a": a["cost_usd"]})
        elif b and not a:
            divergences.append({"type": "missing_in_a", "step_name": name, "cost_b": b["cost_usd"]})
        elif a and b:
            cost_diff = abs((a["cost_usd"] or 0) - (b["cost_usd"] or 0))
            if cost_diff > 0.01 or a["model"] != b["model"]:
                divergences.append({
                    "type": "cost_divergence",
                    "step_name": name,
                    "cost_a": a["cost_usd"],
                    "cost_b": b["cost_usd"],
                    "model_a": a["model"],
                    "model_b": b["model"],
                })

    return {
        "session_a": timeline_a,
        "session_b": timeline_b,
        "divergences": divergences,
        "summary": {
            "cost_diff": timeline_a["total_cost_usd"] - timeline_b["total_cost_usd"],
            "steps_diff": timeline_a["total_steps"] - timeline_b["total_steps"],
            "duration_diff_ms": (timeline_a["duration_ms"] or 0) - (timeline_b["duration_ms"] or 0),
        },
    }
```

---

## 8. SESSIONS EN TEMPS RÉEL

Quand une session est en cours ("running"), le dashboard la montre en live via WebSocket.

```
WebSocket events pour Replay :

{ "type": "session_update", "data": {
    "session_id": "ticket-123",
    "total_steps": 5,
    "total_cost_usd": 0.23,
    "status": "running",
    "latest_step": {
        "step": 5,
        "step_name": "validate",
        "agent": "validator",
        "model": "gpt-4o-mini",
        "cost_usd": 0.002
    }
}}
```

Le frontend ajoute le nouveau step à la timeline en temps réel avec une animation.

---

## 9. RÉTENTION ET CLEANUP

```
Les sessions et leurs events suivent la rétention du plan :
  Free    : 7 jours (mais Replay pas accessible en Free)
  Starter : 30 jours
  Pro     : 90 jours
  Team    : 1 an

Le Celery task "cleanup_expired_data" supprime :
  1. Les events au-delà de la période + 30 jours de grâce
  2. Les sessions dont tous les events ont été supprimés
  3. Les share links expirés
```

---

## 10. CHECKLIST REPLAY

```
□ Le session_id est présent dans l'event (sinon pas de Replay)
□ Le plan permet Replay (Starter+)
□ input_text/output_text capturés par le SDK (si le plan le permet)
□ PII redaction appliquée (middleware) avant stockage
□ La session est créée/mise à jour en DB (UPSERT)
□ Le WebSocket publie session_update
□ La timeline est ordonnée par step puis tracked_at
□ Les contenus bruts ne sont jamais exposés dans les share links
□ La comparaison ne compare que des sessions de la même org
```

---

> **Règle :** Replay est la feature qui transforme AgentShield d'un "cost tracker" en un "debugging tool". La timeline doit être rapide (< 300ms), intuitive, et toujours montrer la version PII-redactée par défaut.
