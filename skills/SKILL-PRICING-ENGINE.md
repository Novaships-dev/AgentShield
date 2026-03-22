# SKILL-PRICING-ENGINE.md — Comment coder le moteur de prix

> Lire AVANT de toucher au calcul de coût ou à la pricing table. Réfs : PRICING-ENGINE.md

---

## CALCUL

```python
from decimal import Decimal

def calculate_cost(provider: str, model: str, input_tokens: int, output_tokens: int) -> Decimal | None:
    pricing = get_pricing(provider, model)  # Redis cache → DB → alias → None
    if not pricing:
        return None
    input_cost = Decimal(str(input_tokens)) * pricing.input_per_million / Decimal("1000000")
    output_cost = Decimal(str(output_tokens)) * pricing.output_per_million / Decimal("1000000")
    return (input_cost + output_cost).quantize(Decimal("0.000001"))
```

## RÉSOLUTION

```
1. model exact dans pricing table → utiliser
2. resolve_model(alias) → canonical name → retry
3. detect_provider(model) si provider absent
4. SDK pricing locale comme fallback client-side
5. Si rien → cost_usd = null + warning
```

## RÈGLES

```
1. Toujours Decimal, jamais float (précision au microdollar)
2. Cache Redis TTL 1h sur chaque paire provider:model
3. Sync quotidien via Celery task maintenance.sync_pricing
4. Nouveau modèle populaire → ajouté en < 48h
5. L'event est TOUJOURS stocké même sans coût calculé
```
