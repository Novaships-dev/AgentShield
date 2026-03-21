# PRICING-ENGINE.md — Moteur de prix AgentShield

> Ce fichier définit comment AgentShield calcule le coût de chaque appel API IA : la table des prix, la logique de calcul, la mise à jour, et les fallbacks. Claude Code le lit avant de toucher au calcul de coûts.
> Cohérent avec : API.md (POST /v1/track), SDK.md (pricing table locale), MIGRATIONS.md (seed data)
> Dernière mise à jour : mars 2026

---

## 1. PRINCIPE

```
Le développeur envoie un event via POST /v1/track.

Cas 1 : cost_usd est fourni → on l'utilise tel quel (le dev connaît son coût)
Cas 2 : cost_usd est absent mais model + input_tokens + output_tokens sont fournis
         → on calcule automatiquement via la pricing table
Cas 3 : cost_usd absent ET model inconnu → on stocke l'event avec cost_usd = null
         + warning dans la réponse
```

Le calcul automatique est un service critique — c'est ce qui permet au développeur de ne pas calculer ses coûts lui-même. Si le calcul est faux, tout le produit est faux.

---

## 2. TABLE DE PRIX

### Structure DB

```sql
-- Table model_pricing (créée dans la migration seed)

CREATE TABLE IF NOT EXISTS model_pricing (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider                   TEXT NOT NULL,
    model                      TEXT NOT NULL,
    input_per_million_tokens   DECIMAL(10, 6) NOT NULL,
    output_per_million_tokens  DECIMAL(10, 6) NOT NULL,
    is_active                  BOOLEAN NOT NULL DEFAULT true,
    source_url                 TEXT,
    notes                      TEXT,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, model)
);
```

### Prix au launch (Avril 2026)

| Provider | Model | Input $/1M tokens | Output $/1M tokens | Source |
|----------|-------|-------------------|---------------------|--------|
| openai | gpt-4o | 2.50 | 10.00 | platform.openai.com/docs/pricing |
| openai | gpt-4o-mini | 0.15 | 0.60 | platform.openai.com/docs/pricing |
| openai | gpt-4 | 30.00 | 60.00 | platform.openai.com/docs/pricing |
| openai | gpt-4-turbo | 10.00 | 30.00 | platform.openai.com/docs/pricing |
| openai | gpt-3.5-turbo | 0.50 | 1.50 | platform.openai.com/docs/pricing |
| openai | o1 | 15.00 | 60.00 | platform.openai.com/docs/pricing |
| openai | o1-mini | 3.00 | 12.00 | platform.openai.com/docs/pricing |
| anthropic | claude-opus-4-6 | 15.00 | 75.00 | docs.anthropic.com/pricing |
| anthropic | claude-sonnet-4-6 | 3.00 | 15.00 | docs.anthropic.com/pricing |
| anthropic | claude-haiku-4-5 | 0.80 | 4.00 | docs.anthropic.com/pricing |
| google | gemini-pro | 1.25 | 5.00 | ai.google.dev/pricing |
| google | gemini-flash | 0.075 | 0.30 | ai.google.dev/pricing |
| google | gemini-pro-1.5 | 1.25 | 5.00 | ai.google.dev/pricing |
| google | gemini-flash-1.5 | 0.075 | 0.30 | ai.google.dev/pricing |

### V2 (Mai 2026)

| Provider | Model | Input $/1M tokens | Output $/1M tokens |
|----------|-------|-------------------|---------------------|
| mistral | mistral-large | 2.00 | 6.00 |
| mistral | mistral-small | 0.20 | 0.60 |
| mistral | mistral-medium | 2.70 | 8.10 |
| cohere | command-r-plus | 2.50 | 10.00 |
| cohere | command-r | 0.15 | 0.60 |
| xai | grok-2 | 2.00 | 10.00 |
| xai | grok-2-mini | 0.10 | 0.40 |
| deepseek | deepseek-chat | 0.14 | 0.28 |
| deepseek | deepseek-coder | 0.14 | 0.28 |

---

## 3. LOGIQUE DE CALCUL

```python
# app/services/pricing.py

from decimal import Decimal

class PricingService:
    """Service for calculating AI API costs."""

    def __init__(self, redis: Redis, db: AsyncClient):
        self._redis = redis
        self._db = db

    async def calculate_cost(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> Decimal | None:
        """
        Calculate cost in USD for an API call.
        Returns None if model not found in pricing table.
        """
        pricing = await self._get_pricing(provider, model)
        if not pricing:
            return None

        input_cost = Decimal(str(input_tokens)) * pricing["input_per_million_tokens"] / Decimal("1000000")
        output_cost = Decimal(str(output_tokens)) * pricing["output_per_million_tokens"] / Decimal("1000000")

        total = input_cost + output_cost

        # Arrondir à 6 décimales (DECIMAL(12, 6) en DB)
        return total.quantize(Decimal("0.000001"))

    async def _get_pricing(self, provider: str, model: str) -> dict | None:
        """Get pricing from cache or DB."""
        # 1. Redis cache
        cache_key = f"pricing:{provider}:{model}"
        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # 2. DB lookup
        result = await self._db.from_("model_pricing") \
            .select("input_per_million_tokens, output_per_million_tokens") \
            .eq("provider", provider) \
            .eq("model", model) \
            .eq("is_active", True) \
            .single() \
            .execute()

        if not result.data:
            # 3. Essayer avec alias (voir section 5)
            pricing = self._try_alias(provider, model)
            if not pricing:
                return None
            result_data = pricing
        else:
            result_data = result.data

        # Cache dans Redis (TTL 1h)
        await self._redis.setex(cache_key, 3600, json.dumps(result_data))
        return result_data
```

### Précision

```
- Tous les calculs utilisent Decimal (pas float) pour éviter les erreurs d'arrondi
- Le coût est stocké en DECIMAL(12, 6) en DB → 6 décimales → précision au microdollar
- Exemple : 1250 input tokens + 340 output tokens avec gpt-4o :
  Input  : 1250 * 2.50 / 1000000 = 0.003125
  Output : 340 * 10.00 / 1000000 = 0.003400
  Total  : 0.006525 → stocké comme 0.006525
```

---

## 4. AUTO-DÉTECTION DU PROVIDER

Quand le développeur envoie un `model` sans `provider`, le serveur déduit le provider :

```python
# app/services/pricing.py

PROVIDER_PREFIXES = {
    "gpt-": "openai",
    "o1": "openai",
    "o3": "openai",
    "claude-": "anthropic",
    "gemini-": "google",
    "mistral-": "mistral",
    "command-": "cohere",
    "grok-": "xai",
    "deepseek-": "deepseek",
}

def detect_provider(model: str) -> str | None:
    """Detect provider from model name prefix."""
    model_lower = model.lower()
    for prefix, provider in PROVIDER_PREFIXES.items():
        if model_lower.startswith(prefix):
            return provider
    return None
```

### Règles
- La détection est case-insensitive
- Si le provider est fourni explicitement → on l'utilise (pas de détection)
- Si la détection échoue ET provider absent → le provider est stocké comme "unknown"
- Le coût peut quand même être calculé si le model exact est dans la pricing table

---

## 5. ALIAS DE MODÈLES

Les développeurs utilisent des noms de modèles variés. Le pricing engine reconnaît les alias courants :

```python
# app/services/pricing.py

MODEL_ALIASES = {
    # OpenAI
    "gpt4o": "gpt-4o",
    "gpt-4-o": "gpt-4o",
    "gpt4o-mini": "gpt-4o-mini",
    "gpt4": "gpt-4",
    "gpt35": "gpt-3.5-turbo",
    "gpt-35-turbo": "gpt-3.5-turbo",
    "chatgpt": "gpt-4o",

    # Anthropic
    "claude-sonnet": "claude-sonnet-4-6",
    "claude-haiku": "claude-haiku-4-5",
    "claude-opus": "claude-opus-4-6",
    "sonnet": "claude-sonnet-4-6",
    "haiku": "claude-haiku-4-5",
    "opus": "claude-opus-4-6",

    # Google
    "gemini": "gemini-pro",
    "gemini-1.5-pro": "gemini-pro-1.5",
    "gemini-1.5-flash": "gemini-flash-1.5",
}

def resolve_model(model: str) -> str:
    """Resolve model aliases to canonical names."""
    return MODEL_ALIASES.get(model.lower(), model)
```

### Flow complet de résolution

```
1. Le dev envoie model="sonnet", provider=null
2. resolve_model("sonnet") → "claude-sonnet-4-6"
3. detect_provider("claude-sonnet-4-6") → "anthropic"
4. Lookup pricing: ("anthropic", "claude-sonnet-4-6") → trouvé
5. Calcul du coût
```

---

## 6. MISE À JOUR DES PRIX

### Quand mettre à jour
- Quand un provider change ses prix (annonce publique)
- Quand un nouveau modèle sort
- Vérification manuelle recommandée : 1 fois par mois

### Comment mettre à jour

```sql
-- Option 1 : SQL direct dans Supabase
UPDATE model_pricing
SET input_per_million_tokens = 2.00,
    output_per_million_tokens = 8.00,
    updated_at = now()
WHERE provider = 'openai' AND model = 'gpt-4o';

-- Option 2 : Ajouter un nouveau modèle
INSERT INTO model_pricing (provider, model, input_per_million_tokens, output_per_million_tokens, source_url)
VALUES ('openai', 'gpt-5', 5.00, 20.00, 'https://platform.openai.com/docs/pricing')
ON CONFLICT (provider, model) DO UPDATE SET
    input_per_million_tokens = EXCLUDED.input_per_million_tokens,
    output_per_million_tokens = EXCLUDED.output_per_million_tokens,
    updated_at = now();
```

### Sync cache après mise à jour

```
1. Mise à jour en DB (SQL ci-dessus)
2. Le Celery beat task "sync_pricing" tourne chaque jour à 6h UTC
3. Il charge toute la table model_pricing et peuple le cache Redis
4. Les clés Redis expirent naturellement (TTL 1h) entre les syncs

Pour forcer un refresh immédiat :
  → Supprimer les clés Redis : DEL pricing:*
  → OU déclencher manuellement : celery call maintenance.sync_pricing
```

---

## 7. FALLBACKS

### Hiérarchie de calcul de coût

```
1. cost_usd fourni par le dev     → utiliser tel quel
2. Redis cache pricing            → calcul auto
3. DB model_pricing               → calcul auto + cache Redis
4. Alias resolution + retry       → résoudre l'alias puis recalculer
5. SDK pricing table locale       → calcul côté client (si le SDK le supporte)
6. Aucun prix trouvé              → cost_usd = null + warning

L'event est TOUJOURS stocké, même sans coût calculé.
```

### Warning quand le coût est inconnu

```json
// POST /v1/track response quand le modèle est inconnu
{
    "event_id": "uuid",
    "agent": "my-agent",
    "cost_usd": null,
    "warnings": [
        "Unknown model 'custom-model-v3'. Cost could not be auto-calculated. Provide cost_usd manually or contact support to add this model."
    ]
}
```

---

## 8. COÛTS SPÉCIAUX

### Modèles avec pricing non-linéaire

Certains modèles ont un pricing qui dépend du context window ou du cache :

```python
# Exemple : Anthropic avec prompt caching
# Le SDK peut envoyer des metadata pour préciser le pricing tier

# POST /v1/track
{
    "agent": "my-agent",
    "model": "claude-sonnet-4-6",
    "input_tokens": 50000,
    "output_tokens": 500,
    "metadata": {
        "cached_tokens": 45000,       # 45K tokens étaient cachés
        "cache_write_tokens": 5000     # 5K tokens écrits dans le cache
    }
}

# Dans ce cas, le pricing engine applique :
# - cached_tokens × prix réduit (25% du prix normal)
# - cache_write_tokens × prix majoré (125% du prix normal)
# - tokens restants × prix normal
```

### Gestion dans le pricing engine

```python
async def calculate_cost_with_cache(
    self,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> Decimal | None:
    """Calculate cost accounting for prompt caching."""
    pricing = await self._get_pricing(provider, model)
    if not pricing:
        return None

    base_input = Decimal(str(input_tokens - cached_tokens - cache_write_tokens))
    cached = Decimal(str(cached_tokens))
    cache_write = Decimal(str(cache_write_tokens))

    input_rate = pricing["input_per_million_tokens"] / Decimal("1000000")
    output_rate = pricing["output_per_million_tokens"] / Decimal("1000000")

    cost = (
        base_input * input_rate
        + cached * input_rate * Decimal("0.25")        # 75% de réduction sur les tokens cachés
        + cache_write * input_rate * Decimal("1.25")   # 25% de surcoût pour l'écriture cache
        + Decimal(str(output_tokens)) * output_rate
    )

    return cost.quantize(Decimal("0.000001"))
```

---

## 9. MÉTRIQUES DE COÛT AGRÉGÉES

Le pricing engine alimente les métriques suivantes (via les tables d'agrégation) :

```
Par agent :
  - cost_today, cost_week, cost_month
  - avg_cost_per_request
  - cost_trend_pct (semaine en cours vs précédente)

Par provider :
  - total_cost par provider
  - pct du total

Par modèle :
  - total_cost par modèle
  - avg_cost_per_request par modèle

Par session :
  - total_cost de la session
  - cost_per_step

Par équipe :
  - total_cost par team_label
  - pct du total
```

### Cost per step (Replay)

```python
# Quand on affiche la timeline Replay, chaque step a son coût
# Le coût du step = cost_usd de l'event correspondant
# Le coût de la session = somme des coûts de tous les steps
# Si un step n'a pas de cost_usd → affiché comme "$—" (inconnu)
```

---

## 10. MONITORING DU PRICING ENGINE

### Alertes internes

```
- Modèle inconnu vu > 10 fois en 24h → Sentry alert + Slack #ops
  "Model 'xyz-new-model' seen 47 times but has no pricing. Add it."

- Prix obsolète (updated_at > 30 jours) → Slack #ops weekly digest
  "14 models have pricing older than 30 days. Review needed."

- Coût calculé = $0.00 pour > 100 events → Sentry alert
  "Possible pricing error: 150 events with cost = $0.00 for model gpt-4o"
```

### Dashboard interne (future)
- Table des prix avec last_updated
- Nombre d'events par modèle (pour savoir quels modèles prioriser)
- Taux de calcul auto vs manuel vs inconnu

---

## 11. CHECKLIST AJOUT D'UN NOUVEAU MODÈLE

```
□ Vérifier le prix sur la page pricing officielle du provider
□ Ajouter l'INSERT dans une migration SQL
□ Ajouter les alias courants dans MODEL_ALIASES
□ Ajouter le prefix provider dans PROVIDER_PREFIXES (si nouveau provider)
□ Mettre à jour la PRICING_TABLE dans le SDK (sdk/agentshield/pricing.py)
□ Mettre à jour la table dans ce fichier (PRICING-ENGINE.md section 2)
□ Tester le calcul avec un exemple réel
□ Déclencher le sync pricing : celery call maintenance.sync_pricing
□ Vérifier que le cache Redis est peuplé
```

---

> **Règle :** Le pricing engine est le cœur du produit. Un calcul de coût faux = un produit inutilisable.
> Les prix doivent être vérifiés mensuellement. Chaque nouveau modèle populaire doit être ajouté en < 48h.
