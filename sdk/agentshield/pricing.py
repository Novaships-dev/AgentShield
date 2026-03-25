"""Client-side pricing table for local cost estimation.

This is a fallback used by @shield() to give the developer an immediate cost
estimate. The server always recalculates with its own authoritative table.
Prices are per 1M tokens, in USD.
"""

from __future__ import annotations

PRICING_TABLE: dict[str, dict[str, dict[str, float]]] = {
    "openai": {
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "gpt-4": {"input": 30.00, "output": 60.00},
        "gpt-4-turbo": {"input": 10.00, "output": 30.00},
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
        "o1": {"input": 15.00, "output": 60.00},
        "o1-mini": {"input": 3.00, "output": 12.00},
    },
    "anthropic": {
        "claude-opus-4-6": {"input": 15.00, "output": 75.00},
        "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
        "claude-haiku-4-5": {"input": 0.80, "output": 4.00},
    },
    "google": {
        "gemini-pro": {"input": 1.25, "output": 5.00},
        "gemini-flash": {"input": 0.075, "output": 0.30},
    },
}


def calculate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float | None:
    """Calculate estimated cost using the local pricing table.

    Returns None if the provider/model combination is not found.
    This is a client-side estimate; the server recalculates authoritatively.
    """
    provider_pricing = PRICING_TABLE.get(provider, {})
    model_pricing = provider_pricing.get(model)
    if model_pricing is None:
        return None

    input_price = model_pricing["input"]
    output_price = model_pricing["output"]
    cost = (input_tokens / 1_000_000) * input_price + (output_tokens / 1_000_000) * output_price
    return round(cost, 8)
