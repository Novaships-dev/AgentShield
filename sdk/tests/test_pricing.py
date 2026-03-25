"""Tests for client-side pricing table."""
import pytest

from agentshield.pricing import PRICING_TABLE, calculate_cost


def test_calculate_cost_known_model():
    cost = calculate_cost("openai", "gpt-4o", 1_000_000, 1_000_000)
    # gpt-4o: input=2.50, output=10.00 → total = 12.50
    assert cost is not None
    assert abs(cost - 12.50) < 0.001


def test_calculate_cost_unknown_returns_none():
    cost = calculate_cost("openai", "gpt-99-ultra", 100, 50)
    assert cost is None


def test_calculate_cost_unknown_provider_returns_none():
    cost = calculate_cost("unknown_provider", "gpt-4o", 100, 50)
    assert cost is None


def test_calculate_cost_anthropic():
    # claude-sonnet-4-6: input=3.00, output=15.00
    cost = calculate_cost("anthropic", "claude-sonnet-4-6", 1_000_000, 1_000_000)
    assert cost is not None
    assert abs(cost - 18.00) < 0.001


def test_calculate_cost_google():
    cost = calculate_cost("google", "gemini-pro", 1_000_000, 1_000_000)
    assert cost is not None
    assert abs(cost - 6.25) < 0.001


def test_all_v1_models_have_pricing():
    """All 12 hardcoded models must have input and output pricing."""
    all_models = [
        ("openai", "gpt-4o"),
        ("openai", "gpt-4o-mini"),
        ("openai", "gpt-4"),
        ("openai", "gpt-4-turbo"),
        ("openai", "gpt-3.5-turbo"),
        ("openai", "o1"),
        ("openai", "o1-mini"),
        ("anthropic", "claude-opus-4-6"),
        ("anthropic", "claude-sonnet-4-6"),
        ("anthropic", "claude-haiku-4-5"),
        ("google", "gemini-pro"),
        ("google", "gemini-flash"),
    ]
    for provider, model in all_models:
        pricing = PRICING_TABLE.get(provider, {}).get(model)
        assert pricing is not None, f"Missing pricing for {provider}/{model}"
        assert "input" in pricing
        assert "output" in pricing


def test_cost_matches_backend_table():
    """SDK pricing matches backend HARDCODED_PRICING for all V1 models."""
    # Import backend pricing for comparison
    import sys
    import os

    backend_path = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)

    try:
        from app.services.pricing import HARDCODED_PRICING

        for provider, models in HARDCODED_PRICING.items():
            for model, prices in models.items():
                sdk_pricing = PRICING_TABLE.get(provider, {}).get(model)
                assert sdk_pricing is not None, f"SDK missing {provider}/{model}"
                assert abs(sdk_pricing["input"] - float(prices["input"])) < 0.0001
                assert abs(sdk_pricing["output"] - float(prices["output"])) < 0.0001
    except ImportError:
        pytest.skip("Backend not available in test environment")


def test_zero_tokens_returns_zero():
    cost = calculate_cost("openai", "gpt-4o", 0, 0)
    assert cost == 0.0


def test_small_token_count():
    # 100 input + 50 output for gpt-4o-mini
    # input: 100/1M * 0.15 = 0.000015
    # output: 50/1M * 0.60 = 0.00003
    cost = calculate_cost("openai", "gpt-4o-mini", 100, 50)
    assert cost is not None
    assert cost > 0
    expected = (100 / 1_000_000) * 0.15 + (50 / 1_000_000) * 0.60
    assert abs(cost - expected) < 1e-9
