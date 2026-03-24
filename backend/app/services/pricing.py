"""Pricing service — cost calculation for AI model calls."""
from __future__ import annotations

import json
from decimal import Decimal

from app.utils.redis import get_redis_client

# ---------------------------------------------------------------------------
# Provider prefix detection
# ---------------------------------------------------------------------------

PROVIDER_PREFIXES: dict[str, str] = {
    "gpt-": "openai",
    "o1": "openai",
    "o3": "openai",
    "text-davinci": "openai",
    "claude-": "anthropic",
    "gemini-": "google",
    "palm-": "google",
    "llama": "meta",
    "mistral": "mistral",
    "mixtral": "mistral",
    "command": "cohere",
}

# ---------------------------------------------------------------------------
# Model alias resolution
# ---------------------------------------------------------------------------

MODEL_ALIASES: dict[str, str] = {
    # OpenAI shorthand
    "gpt4o": "gpt-4o",
    "gpt4": "gpt-4",
    "gpt4-turbo": "gpt-4-turbo",
    "gpt3.5": "gpt-3.5-turbo",
    "gpt-3.5": "gpt-3.5-turbo",
    # Anthropic shorthand
    "claude-opus": "claude-opus-4-6",
    "claude-sonnet": "claude-sonnet-4-6",
    "claude-haiku": "claude-haiku-4-5",
    "opus": "claude-opus-4-6",
    "sonnet": "claude-sonnet-4-6",
    "haiku": "claude-haiku-4-5",
    # Google shorthand
    "gemini": "gemini-pro",
    "gemini-1.5-pro": "gemini-pro",
    "gemini-1.5-flash": "gemini-flash",
}

# ---------------------------------------------------------------------------
# Hardcoded pricing fallback (per 1M tokens, USD)
# ---------------------------------------------------------------------------

HARDCODED_PRICING: dict[str, dict[str, dict[str, str]]] = {
    "openai": {
        "gpt-4o": {"input": "2.50", "output": "10.00"},
        "gpt-4o-mini": {"input": "0.15", "output": "0.60"},
        "gpt-4": {"input": "30.00", "output": "60.00"},
        "gpt-4-turbo": {"input": "10.00", "output": "30.00"},
        "gpt-3.5-turbo": {"input": "0.50", "output": "1.50"},
        "o1": {"input": "15.00", "output": "60.00"},
        "o1-mini": {"input": "3.00", "output": "12.00"},
    },
    "anthropic": {
        "claude-opus-4-6": {"input": "15.00", "output": "75.00"},
        "claude-sonnet-4-6": {"input": "3.00", "output": "15.00"},
        "claude-haiku-4-5": {"input": "0.80", "output": "4.00"},
    },
    "google": {
        "gemini-pro": {"input": "1.25", "output": "5.00"},
        "gemini-flash": {"input": "0.075", "output": "0.30"},
    },
}

_CACHE_TTL = 3600  # 1 hour


def detect_provider(model: str) -> str | None:
    """Detect the provider from a model name using prefix matching."""
    model_lower = model.lower()
    for prefix, provider in PROVIDER_PREFIXES.items():
        if model_lower.startswith(prefix):
            return provider
    return None


def resolve_model(model: str) -> str:
    """Resolve a model alias to its canonical name."""
    return MODEL_ALIASES.get(model, model)


class PricingService:
    """Service for calculating AI model call costs."""

    def __init__(self, redis=None, db=None):
        self._redis = redis
        self._db = db

    async def calculate_cost(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> Decimal | None:
        """Calculate the cost for a model call using Decimal arithmetic.

        Returns None if pricing data is unavailable for the given model.
        Cost is computed as:
            (input_tokens / 1_000_000) * input_price
          + (output_tokens / 1_000_000) * output_price
        """
        pricing = await self._get_pricing(provider, model)
        if pricing is None:
            return None

        input_price = Decimal(str(pricing["input"]))
        output_price = Decimal(str(pricing["output"]))

        cost = (
            Decimal(input_tokens) / Decimal("1000000") * input_price
            + Decimal(output_tokens) / Decimal("1000000") * output_price
        )
        return cost

    async def _get_pricing(self, provider: str, model: str) -> dict | None:
        """Fetch pricing for the given provider/model.

        Order:
        1. Redis cache `pricing:{provider}:{model}` (TTL 3600s)
        2. DB table `model_pricing`
        3. Hardcoded fallback dict (for Sprint 1 when DB may lack data)
        """
        redis = self._redis or get_redis_client()
        cache_key = f"pricing:{provider}:{model}"

        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Try DB first
        if self._db is not None:
            try:
                result = (
                    self._db.table("model_pricing")
                    .select("input_price_per_million, output_price_per_million")
                    .eq("provider", provider)
                    .eq("model", model)
                    .maybe_single()
                    .execute()
                )
                if result.data:
                    pricing = {
                        "input": str(result.data["input_price_per_million"]),
                        "output": str(result.data["output_price_per_million"]),
                    }
                    await redis.set(cache_key, json.dumps(pricing), ex=_CACHE_TTL)
                    return pricing
            except Exception:
                pass  # Fall through to hardcoded fallback

        # Hardcoded fallback
        provider_pricing = HARDCODED_PRICING.get(provider, {})
        pricing = provider_pricing.get(model)
        if pricing:
            await redis.set(cache_key, json.dumps(pricing), ex=_CACHE_TTL)
        return pricing
