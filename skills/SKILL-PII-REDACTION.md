# SKILL-PII-REDACTION.md — Comment coder la PII redaction

> Lire AVANT de toucher aux patterns PII, à la redaction, ou au stockage des contenus. Réfs : PROTECT.md (section 3), SECURITY.md (section 7)

---

## PRINCIPE : PRIVACY BY DEFAULT

```
1. PII redaction ACTIVÉE par défaut pour toute nouvelle org
2. store_original = false par défaut (contenus bruts NON stockés)
3. Double couche : SDK (avant envoi) + serveur (avant stockage)
4. Le Replay affiche TOUJOURS la version redactée par défaut
```

## PATTERNS

```python
# 5 patterns built-in + custom

email       : [\w.+-]+@[\w-]+\.[\w.-]+           → [REDACTED:email]
phone       : \+?[\d\s\-().]{7,20}               → [REDACTED:phone]
credit_card : \b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b + Luhn → [REDACTED:cc]
ssn         : \b\d{3}-\d{2}-\d{4}\b              → [REDACTED:ssn]
ip_address  : \b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b → [REDACTED:ip]

custom      : regex défini par l'org              → [REDACTED:{name}]
              Max 10 custom patterns par org
              Validé à la création (regex valide)
```

## IMPLÉMENTATION

```python
def redact_pii(text: str, config: PIIConfig) -> tuple[str, list[str]]:
    """Redact PII. Returns (redacted_text, detected_types)."""
    detected = []
    result = text

    for pii_type in config.patterns_enabled:
        pattern = PII_PATTERNS[pii_type]
        matches = pattern["regex"].findall(result)
        for match in matches:
            if pattern.get("validator") and not pattern["validator"](match):
                continue  # Faux positif (ex: Luhn check)
            detected.append(pii_type)
            result = result.replace(match, pattern["replacement"])

    for custom in config.custom_patterns:
        if re.search(custom["pattern"], result):
            detected.append(f"custom:{custom['name']}")
            result = re.sub(custom["pattern"], f"[REDACTED:{custom['name']}]", result)

    return result, list(set(detected))
```

## ACTIONS

```
redact   → remplacer par [REDACTED:type] (défaut)
hash     → remplacer par SHA-256 hash (corrélation possible sans exposer)
log_only → garder le contenu, noter les positions dans metadata
```

## STOCKAGE

```
events table :
  input_text       → NULL si store_original=false (DÉFAUT)
  output_text      → NULL si store_original=false
  input_redacted   → TOUJOURS rempli (version nettoyée)
  output_redacted  → TOUJOURS rempli (version nettoyée)

Qui voit quoi :
  input_redacted   → tout le monde (member, admin, owner, share links)
  input_text       → owner + admin UNIQUEMENT, et SEULEMENT si store_original=true
  share links      → TOUJOURS input_redacted, jamais input_text
  webhooks sortants→ TOUJOURS redacté
  exports PDF      → TOUJOURS redacté
```

## FAUX POSITIFS

```
Le pattern phone est le plus sujet aux faux positifs (numéros de référence, codes).
  → Minimum 7 chiffres requis
  → Idéalement précédé de "phone", "tel", "call", "+", "(", mais pas obligatoire

Le pattern credit_card utilise Luhn pour réduire les faux positifs.
  → 16 chiffres qui passent Luhn = probablement une carte
  → 16 chiffres qui ne passent pas Luhn = probablement un code

Le pattern email a très peu de faux positifs.
Le pattern SSN est spécifique au format US (DDD-DD-DDDD).
Le pattern IP peut matcher des numéros de version (1.2.3.4) — acceptable.
```

## RÈGLES

```
1. PII activée par DÉFAUT — le user doit opt-OUT, pas opt-in
2. Double redaction (SDK + serveur) — defense in depth
3. store_original = false par DÉFAUT
4. Les custom patterns sont limités à 10 par org
5. Les custom patterns sont validés (regex valide) à la création
6. La redaction est SYNC (middleware) — < 10ms
7. Le Luhn check est obligatoire pour credit_card (réduire les faux positifs)
8. Les share links montrent TOUJOURS la version redactée
9. La config PII est en cache Redis (TTL 5min)
10. Pro+ pour la CONFIGURATION — Free/Starter ont la redaction activée mais pas configurable
```
