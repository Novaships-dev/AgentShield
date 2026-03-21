# PROTECT.md — Module Protect AgentShield

> Ce fichier définit le module Protect en détail technique : guardrails, PII redaction, kill switch, compliance mode. Claude Code le lit avant de toucher au code Protect.
> Cohérent avec : SPEC.md (sections 14-17), ARCH.md (tables guardrails/pii), SECURITY.md (PII, permissions)
> Dernière mise à jour : mars 2026

---

## 1. PRINCIPE

Protect empêche les agents IA de faire des choses qu'ils ne devraient pas faire — en production, en temps réel, sans changer le code de l'agent.

```
Sans Protect :
  Un agent de support client mentionne un concurrent → bad PR
  Un agent expose un email client dans sa réponse → GDPR violation
  Un agent loop et brûle $500 en 10 minutes → budget explosé
  → Découvert après les faits. Dégâts déjà faits.

Avec Protect :
  Guardrail "No competitors" → BLOCKED avant que la réponse ne soit stockée
  PII redaction → [REDACTED:email] automatique sur tous les contenus
  Budget cap $50/month → FREEZE après $50, BudgetExceededError côté SDK
  → Prévention en temps réel. Pas de réaction après coup.
```

**Plan requis : Pro+ (€99/mois)**

---

## 2. GUARDRAILS

### Types de guardrails

| Type | Mécanisme | Cas d'usage | Latence |
|------|-----------|-------------|---------|
| keyword | String match (exact ou substring) | Bloquer des mots spécifiques (concurrents, insultes) | < 1ms |
| regex | Regular expression match | Patterns complexes (secrets, codes internes) | < 2ms |
| topic | Classification par groupes de mots-clés | Catégories de sujets (politique, religion) | < 3ms |
| category | Listes noires pré-définies | Contenus dangereux (hate speech, self-harm) | < 3ms |

### Actions

| Action | Comportement | HTTP Response |
|--------|-------------|---------------|
| log | L'event est stocké normalement. La violation est enregistrée. Notification envoyée. | 201 (normal) |
| redact | Le contenu matché est remplacé par [BLOCKED:rule_name]. L'event est stocké. | 201 (normal) |
| block | L'event est rejeté. Le SDK reçoit GuardrailBlockedError. | 403 |

### Configuration en DB

```sql
-- guardrail_rules table

-- Keyword example
INSERT INTO guardrail_rules (organization_id, name, type, config, action) VALUES
(org_id, 'No competitors', 'keyword', '{
    "keywords": ["competitor_name", "rival_product", "other_brand"],
    "case_sensitive": false,
    "match_mode": "substring"
}', 'block');

-- Regex example
INSERT INTO guardrail_rules (organization_id, name, type, config, action) VALUES
(org_id, 'No API keys in output', 'regex', '{
    "pattern": "(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|xoxb-[a-zA-Z0-9-]+)",
    "flags": ""
}', 'redact');

-- Topic example
INSERT INTO guardrail_rules (organization_id, name, type, config, action) VALUES
(org_id, 'Safe topics only', 'topic', '{
    "topics": ["politics", "religion", "adult_content", "gambling"],
    "topic_keywords": {
        "politics": ["election", "president", "democrat", "republican", "congress", "senate", "vote"],
        "religion": ["god", "bible", "quran", "church", "mosque", "prayer", "faith"],
        "adult_content": ["explicit", "nsfw", "pornography", "sex"],
        "gambling": ["casino", "bet", "gambling", "poker", "slots"]
    }
}', 'block');

-- Category example (pré-définies)
INSERT INTO guardrail_rules (organization_id, name, type, config, action) VALUES
(org_id, 'Content safety', 'category', '{
    "categories": ["hate_speech", "self_harm", "illegal_activity", "violence"]
}', 'block');
```

### Évaluation (middleware sync)

```python
# app/middleware/guardrail_check.py

class GuardrailChecker:
    """Evaluate guardrail rules against event content."""

    def __init__(self, redis: Redis):
        self._redis = redis

    async def check(self, org_id: str, agent_id: str | None, input_text: str | None, output_text: str | None) -> list[dict]:
        """Check all active guardrails. Returns list of violations."""
        rules = await self._get_rules(org_id)
        violations = []

        content = f"{input_text or ''} {output_text or ''}"
        if not content.strip():
            return []

        for rule in rules:
            # Skip si la rule est liée à un agent spécifique et que ce n'est pas le bon
            if rule["agent_id"] and rule["agent_id"] != agent_id:
                continue

            match = self._evaluate_rule(rule, content)
            if match:
                violations.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "type": rule["type"],
                    "action": rule["action"],
                    "matched_content": match[:100],  # Tronquer pour sécurité
                })

        return violations

    def _evaluate_rule(self, rule: dict, content: str) -> str | None:
        """Evaluate a single rule. Returns matched content or None."""
        config = rule["config"]
        rule_type = rule["type"]

        if rule_type == "keyword":
            return self._check_keyword(config, content)
        elif rule_type == "regex":
            return self._check_regex(config, content)
        elif rule_type == "topic":
            return self._check_topic(config, content)
        elif rule_type == "category":
            return self._check_category(config, content)
        return None

    def _check_keyword(self, config: dict, content: str) -> str | None:
        """Check for keyword matches."""
        keywords = config["keywords"]
        case_sensitive = config.get("case_sensitive", False)
        match_mode = config.get("match_mode", "substring")

        check_content = content if case_sensitive else content.lower()

        for kw in keywords:
            check_kw = kw if case_sensitive else kw.lower()
            if match_mode == "exact":
                words = check_content.split()
                if check_kw in words:
                    return kw
            else:  # substring
                if check_kw in check_content:
                    return kw
        return None

    def _check_regex(self, config: dict, content: str) -> str | None:
        """Check for regex matches."""
        pattern = config["pattern"]
        flags_str = config.get("flags", "")
        flags = 0
        if "i" in flags_str:
            flags |= re.IGNORECASE

        match = re.search(pattern, content, flags)
        if match:
            return match.group(0)
        return None

    def _check_topic(self, config: dict, content: str) -> str | None:
        """Check for topic matches using keyword groups."""
        content_lower = content.lower()
        topic_keywords = config.get("topic_keywords", {})

        for topic in config["topics"]:
            keywords = topic_keywords.get(topic, [])
            for kw in keywords:
                if kw.lower() in content_lower:
                    return f"topic:{topic} (matched: {kw})"
        return None

    def _check_category(self, config: dict, content: str) -> str | None:
        """Check against pre-defined category keyword lists."""
        content_lower = content.lower()

        for category in config["categories"]:
            keywords = CATEGORY_KEYWORDS.get(category, [])
            for kw in keywords:
                if kw.lower() in content_lower:
                    return f"category:{category} (matched: {kw})"
        return None

    async def _get_rules(self, org_id: str) -> list[dict]:
        """Get active guardrail rules from cache or DB."""
        cache_key = f"guardrails:{org_id}"
        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        result = await db.from_("guardrail_rules") \
            .select("*") \
            .eq("organization_id", org_id) \
            .eq("is_active", True) \
            .execute()

        rules = result.data
        await self._redis.setex(cache_key, 300, json.dumps(rules))  # TTL 5min
        return rules


# Pre-defined category keywords
CATEGORY_KEYWORDS = {
    "hate_speech": ["hate", "racist", "bigot", "slur", "discriminat"],
    "self_harm": ["suicide", "self-harm", "kill myself", "end my life"],
    "illegal_activity": ["illegal", "drug deal", "hack into", "steal", "counterfeit"],
    "violence": ["murder", "assault", "attack", "weapon", "bomb", "shoot"],
}
```

### Application dans le flow d'ingestion

```python
# app/api/v1/track.py (middleware flow)

async def track_event(request: TrackEventRequest, org: Organization):
    # ... auth, budget check ...

    # Guardrail check (SYNC — avant stockage)
    violations = await guardrail_checker.check(
        org_id=org.id,
        agent_id=agent.id,
        input_text=request.input_text,
        output_text=request.output_text,
    )

    # Traiter les violations
    has_block = any(v["action"] == "block" for v in violations)
    if has_block:
        # Dispatch async logging de la violation
        log_violation.delay([v for v in violations if v["action"] == "block"])
        raise GuardrailBlockedError(violations[0]["rule_name"], violations[0]["matched_content"])

    # Appliquer les redactions
    for v in violations:
        if v["action"] == "redact":
            request.input_text = redact_match(request.input_text, v["matched_content"], v["rule_name"])
            request.output_text = redact_match(request.output_text, v["matched_content"], v["rule_name"])

    # Attacher les violations à l'event (pour le Replay)
    event_data["guardrail_violations"] = [
        {"rule": v["rule_name"], "action": v["action"]} for v in violations
    ]

    # ... suite du flow (PII, insert, etc.) ...
```

---

## 3. PII REDACTION

### Patterns détectés

```python
# app/utils/pii_patterns.py

import re

PII_PATTERNS = {
    "email": {
        "pattern": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
        "replacement": "[REDACTED:email]",
    },
    "phone": {
        "pattern": re.compile(r"""
            (?:\+?\d{1,4}[\s.-]?)?     # Country code
            (?:\(?\d{1,4}\)?[\s.-]?)?   # Area code
            \d{2,4}[\s.-]?             # First group
            \d{2,4}[\s.-]?             # Second group
            \d{2,4}                     # Last group
        """, re.VERBOSE),
        "replacement": "[REDACTED:phone]",
    },
    "credit_card": {
        "pattern": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
        "replacement": "[REDACTED:cc]",
        "validator": luhn_check,  # Validation Luhn pour éviter les faux positifs
    },
    "ssn": {
        "pattern": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "replacement": "[REDACTED:ssn]",
    },
    "ip_address": {
        "pattern": re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"),
        "replacement": "[REDACTED:ip]",
    },
}

def luhn_check(number: str) -> bool:
    """Validate a credit card number using the Luhn algorithm."""
    digits = [int(d) for d in number.replace("-", "").replace(" ", "")]
    odd_digits = digits[-1::-2]
    even_digits = digits[-2::-2]
    total = sum(odd_digits)
    for d in even_digits:
        total += sum(divmod(d * 2, 10))
    return total % 10 == 0
```

### Service de redaction

```python
# app/services/pii.py

class PIIRedactionService:
    """Service for detecting and redacting PII."""

    def __init__(self, redis: Redis, db: AsyncClient):
        self._redis = redis
        self._db = db

    async def redact(self, org_id: str, text: str) -> tuple[str, list[str]]:
        """Redact PII from text. Returns (redacted_text, detected_types)."""
        if not text:
            return text, []

        config = await self._get_config(org_id)
        detected = []
        redacted = text

        # Standard patterns
        for pii_type in config["patterns_enabled"]:
            pattern_def = PII_PATTERNS.get(pii_type)
            if not pattern_def:
                continue

            matches = pattern_def["pattern"].findall(redacted)
            for match in matches:
                # Validation optionnelle (ex: Luhn pour CC)
                validator = pattern_def.get("validator")
                if validator and not validator(match):
                    continue

                detected.append(pii_type)
                redacted = redacted.replace(match, pattern_def["replacement"])

        # Custom patterns
        for custom in config.get("custom_patterns", []):
            try:
                pattern = re.compile(custom["pattern"])
                if pattern.search(redacted):
                    detected.append(f"custom:{custom['name']}")
                    redacted = pattern.sub(f"[REDACTED:{custom['name']}]", redacted)
            except re.error:
                continue  # Pattern invalide — skip silencieusement

        return redacted, list(set(detected))

    async def _get_config(self, org_id: str) -> dict:
        """Get PII config from cache or DB."""
        cache_key = f"pii:{org_id}"
        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        result = await self._db.from_("pii_configs") \
            .select("*") \
            .eq("organization_id", org_id) \
            .single() \
            .execute()

        config = result.data
        await self._redis.setex(cache_key, 300, json.dumps(config))
        return config
```

### Double redaction (SDK + serveur)

```
Couche 1 — SDK (avant envoi réseau) :
  Le SDK applique ses propres patterns PII sur input_text/output_text
  → Les données sensibles ne transitent PAS en clair sur le réseau
  → Le dev peut désactiver via agentshield.configure(pii_redaction=False)

Couche 2 — Serveur (middleware, avant stockage) :
  Le serveur applique la config PII de l'org (peut inclure des custom patterns)
  → Même si le SDK n'a pas redacté, le serveur le fait
  → Même si le SDK a redacté, le serveur re-vérifie

Résultat :
  input_text    → NULL (si store_original=false) ou texte brut (si true)
  output_text   → NULL (si store_original=false) ou texte brut (si true)
  input_redacted  → TOUJOURS la version nettoyée
  output_redacted → TOUJOURS la version nettoyée
```

### Actions PII

| Action | Comportement |
|--------|-------------|
| redact | Remplacer par [REDACTED:type] — défaut |
| hash | Remplacer par SHA-256 hash (permet la corrélation sans exposer la donnée) |
| log_only | Garder le contenu intact mais noter la position du PII dans les metadata |

---

## 4. BUDGET CAPS ET KILL SWITCH

### Budget caps (détail technique)

```python
# app/middleware/budget_check.py

class BudgetChecker:
    """Check budget caps before allowing an event."""

    async def check(self, org_id: str, agent_id: str, cost_usd: float) -> dict:
        """Check budget. Returns status dict."""
        # Vérifier les caps de l'agent spécifique
        for period in ["daily", "weekly", "monthly"]:
            cap = await self._get_cap(org_id, agent_id, period)
            if cap:
                status = await self._check_single(org_id, agent_id, period, cap, cost_usd)
                if status["action_required"]:
                    return status

        # Vérifier le cap global (agent_id = null)
        for period in ["daily", "weekly", "monthly"]:
            cap = await self._get_cap(org_id, None, period)
            if cap:
                status = await self._check_single(org_id, "global", period, cap, cost_usd)
                if status["action_required"]:
                    return status

        return {"budget_status": "ok", "action_required": False}

    async def _check_single(self, org_id, agent_key, period, cap, new_cost) -> dict:
        """Check a single budget cap."""
        counter_key = f"budget:{org_id}:{agent_key}:{period}"
        current = float(await self._redis.get(counter_key) or 0)
        projected = current + new_cost
        percentage = (projected / float(cap["max_usd"])) * 100

        if projected >= float(cap["max_usd"]):
            if cap["action"] == "freeze":
                # Freeze l'agent
                await self._freeze_agent(org_id, agent_key)
                return {
                    "budget_status": "exceeded",
                    "action_required": True,
                    "action": "freeze",
                    "current_usd": current,
                    "max_usd": float(cap["max_usd"]),
                    "period": period,
                }
            else:  # alert_only
                return {
                    "budget_status": "exceeded",
                    "action_required": False,  # Don't block
                    "action": "alert_only",
                    "current_usd": projected,
                    "max_usd": float(cap["max_usd"]),
                }

        if percentage > 80:
            return {
                "budget_status": "warning",
                "action_required": False,
                "percentage": percentage,
                "current_usd": projected,
                "max_usd": float(cap["max_usd"]),
            }

        return {"budget_status": "ok", "action_required": False}
```

### Kill switch (toggle manuel)

```python
# app/api/v1/agents.py

@router.post("/agents/{agent_id}/kill-switch")
async def toggle_kill_switch(
    agent_id: UUID,
    request: KillSwitchRequest,
    user: User = Depends(require_role("admin")),
):
    """Activate or deactivate the kill switch for an agent."""
    await db.from_("agents").update({
        "is_frozen": request.enabled,
    }).eq("id", str(agent_id)).eq("organization_id", user.organization_id).execute()

    # Invalider le cache Redis
    await redis.delete(f"agent_frozen:{agent_id}")
    if request.enabled:
        await redis.set(f"agent_frozen:{agent_id}", "1")

    # Audit log
    action = "kill_switch.activated" if request.enabled else "kill_switch.deactivated"
    await log_audit(user.organization_id, action, "agent", str(agent_id))

    # WebSocket notification
    await publish_ws(user.organization_id, {
        "type": "budget_frozen" if request.enabled else "agent_unfrozen",
        "data": {"agent_id": str(agent_id), "is_frozen": request.enabled},
    })

    # Slack notification (si configuré)
    if request.enabled:
        await notify_kill_switch(user.organization_id, agent_id)
```

### Vérification kill switch dans le flow d'ingestion

```python
# Avant même le budget check :
agent_frozen = await redis.get(f"agent_frozen:{agent_id}")
if agent_frozen:
    raise AgentFrozenError(agent_name, "kill_switch")
```

---

## 5. COMPLIANCE MODE

### Principe
Quand activé (Team plan), le compliance mode rend TOUTES les données immuables pour l'audit.

### Ce qui change

| Aspect | Sans compliance | Avec compliance |
|--------|----------------|-----------------|
| Events | Cleanup après rétention | Jamais supprimés |
| Audit log | 1 an de rétention | Jamais supprimé |
| Sessions | Cleanup après rétention | Jamais supprimées |
| Soft delete agents | OK | OK mais l'event "deactivated" est loggé |
| Export GDPR | Non disponible | Disponible |
| Désactivation | — | IRRÉVERSIBLE |

### Activation

```python
# app/api/v1/settings.py

@router.post("/settings/compliance")
async def activate_compliance(user: User = Depends(require_role("owner"))):
    """Activate compliance mode. THIS IS IRREVERSIBLE."""

    org = await get_org(user.organization_id)
    if org["plan"] != "team":
        raise AuthorizationError("plan_required_team", "Compliance mode requires Team plan.")

    # Double confirmation requise (le frontend demande de taper "ACTIVATE")
    await db.from_("organizations").update({
        "compliance_mode": True,
    }).eq("id", user.organization_id).execute()

    await log_audit(user.organization_id, "compliance.activated", "organization", user.organization_id)
```

### Export GDPR

```python
# Endpoint pour exporter toutes les données d'un utilisateur

@router.post("/settings/gdpr-export")
async def gdpr_export(user: User = Depends(require_role("owner"))):
    """Generate a GDPR data export."""
    # Celery task async
    generate_gdpr_export.delay(user.organization_id)
    return {"message": "Export is being generated. You will receive an email with the download link."}
```

---

## 6. VIOLATIONS — HISTORIQUE ET ANALYTICS

### Table violations

```
guardrail_violations :
├── rule_id          → Quelle règle a été violée
├── event_id         → Quel event a causé la violation
├── agent_id         → Quel agent
├── session_id       → Dans quelle session (pour lien Replay)
├── matched_content  → Ce qui a matché (tronqué à 100 chars)
├── action_taken     → "blocked" / "redacted" / "logged"
└── created_at       → Quand
```

### Analytics violations

```
Le dashboard Protect montre :
  - Nombre de violations par jour (graphique)
  - Top rules violées (quelles règles sont le plus souvent triggées)
  - Top agents violeurs (quels agents causent le plus de violations)
  - Répartition par action (blocked vs redacted vs logged)
  - Lien direct vers le Replay de chaque violation
```

---

## 7. CHECKLIST PROTECT

```
□ Les guardrail rules sont en cache Redis (TTL 5min)
□ L'évaluation est SYNC (middleware) — < 5ms total
□ Les violations "block" empêchent le stockage de l'event
□ Les violations "redact" modifient le contenu AVANT stockage
□ Le logging des violations est ASYNC (Celery task)
□ La PII redaction est appliquée APRÈS le guardrail check
□ Les custom PII patterns sont validés (regex valide) à la création
□ Le kill switch est vérifié AVANT tout autre check (Redis, < 1ms)
□ Le compliance mode est irréversible
□ store_original=false par défaut
□ Les share links montrent TOUJOURS la version redactée
```

---

> **Règle :** Protect est ce qui rend AgentShield indispensable pour les équipes en production. Sans Protect, c'est juste de l'observabilité. Avec Protect, c'est de la sécurité active.
> La latence du middleware Protect (guardrails + PII) ne doit JAMAIS dépasser 15ms total.
