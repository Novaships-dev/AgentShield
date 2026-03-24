"""Unit tests for the pricing service."""
from __future__ import annotations
import json
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.pricing import (
    PricingService,
    detect_provider,
    resolve_model,
    HARDCODED_PRICING,
    MODEL_ALIASES,
    PROVIDER_PREFIXES,
)


# ---------------------------------------------------------------------------
# detect_provider tests
# ---------------------------------------------------------------------------

class TestDetectProvider:
    def test_openai_gpt4o(self):
        assert detect_provider("gpt-4o") == "openai"

    def test_openai_gpt4(self):
        assert detect_provider("gpt-4") == "openai"

    def test_openai_o1(self):
        assert detect_provider("o1") == "openai"

    def test_openai_o1_mini(self):
        assert detect_provider("o1-mini") == "openai"

    def test_anthropic_claude(self):
        assert detect_provider("claude-opus-4-6") == "anthropic"

    def test_anthropic_claude_sonnet(self):
        assert detect_provider("claude-sonnet-4-6") == "anthropic"

    def test_google_gemini(self):
        assert detect_provider("gemini-pro") == "google"

    def test_google_gemini_flash(self):
        assert detect_provider("gemini-flash") == "google"

    def test_unknown_model(self):
        assert detect_provider("unknown-model-xyz") is None

    def test_case_insensitive(self):
        assert detect_provider("GPT-4o") == "openai"


# ---------------------------------------------------------------------------
# resolve_model tests
# ---------------------------------------------------------------------------

class TestResolveModel:
    def test_resolves_alias(self):
        assert resolve_model("gpt4o") == "gpt-4o"

    def test_resolves_claude_opus_alias(self):
        assert resolve_model("opus") == "claude-opus-4-6"

    def test_resolves_claude_sonnet_alias(self):
        assert resolve_model("sonnet") == "claude-sonnet-4-6"

    def test_resolves_haiku_alias(self):
        assert resolve_model("haiku") == "claude-haiku-4-5"

    def test_no_alias_passthrough(self):
        assert resolve_model("gpt-4o") == "gpt-4o"

    def test_unknown_model_passthrough(self):
        assert resolve_model("my-custom-model") == "my-custom-model"

    def test_gemini_alias(self):
        assert resolve_model("gemini") == "gemini-pro"


# ---------------------------------------------------------------------------
# PricingService tests (mocked Redis + DB)
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_redis():
    """Mock async Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)  # cache miss by default
    redis.set = AsyncMock(return_value=True)
    return redis


@pytest.fixture
def mock_db():
    """Mock Supabase DB client."""
    db = MagicMock()
    return db


@pytest.fixture
def pricing_service(mock_redis, mock_db):
    return PricingService(redis=mock_redis, db=mock_db)


class TestPricingServiceHardcoded:
    @pytest.mark.asyncio
    async def test_gpt4o_cost(self, pricing_service, mock_db):
        """gpt-4o: input=2.50, output=10.00 per 1M tokens."""
        # Simulate DB miss
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("openai", "gpt-4o", 1_000_000, 1_000_000)
        assert cost is not None
        assert cost == Decimal("12.50")  # 2.50 + 10.00

    @pytest.mark.asyncio
    async def test_gpt4o_mini_cost(self, pricing_service, mock_db):
        """gpt-4o-mini: input=0.15, output=0.60 per 1M tokens."""
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("openai", "gpt-4o-mini", 500_000, 500_000)
        assert cost is not None
        expected = Decimal("0.15") * Decimal("0.5") + Decimal("0.60") * Decimal("0.5")
        assert cost == expected

    @pytest.mark.asyncio
    async def test_claude_opus_cost(self, pricing_service, mock_db):
        """claude-opus-4-6: input=15.00, output=75.00 per 1M tokens."""
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("anthropic", "claude-opus-4-6", 1_000, 1_000)
        assert cost is not None
        # 1000/1M * 15.00 + 1000/1M * 75.00
        expected = Decimal("1000") / Decimal("1000000") * Decimal("15.00") + Decimal("1000") / Decimal("1000000") * Decimal("75.00")
        assert cost == expected

    @pytest.mark.asyncio
    async def test_claude_sonnet_cost(self, pricing_service, mock_db):
        """claude-sonnet-4-6: input=3.00, output=15.00 per 1M tokens."""
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("anthropic", "claude-sonnet-4-6", 100_000, 50_000)
        assert cost is not None
        expected = (Decimal("100000") / Decimal("1000000") * Decimal("3.00") +
                    Decimal("50000") / Decimal("1000000") * Decimal("15.00"))
        assert cost == expected

    @pytest.mark.asyncio
    async def test_gemini_flash_cost(self, pricing_service, mock_db):
        """gemini-flash: input=0.075, output=0.30 per 1M tokens."""
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("google", "gemini-flash", 1_000_000, 0)
        assert cost is not None
        assert cost == Decimal("0.075")

    @pytest.mark.asyncio
    async def test_unknown_model_returns_none(self, pricing_service, mock_db):
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("openai", "gpt-99-ultra", 1000, 1000)
        assert cost is None

    @pytest.mark.asyncio
    async def test_zero_tokens(self, pricing_service, mock_db):
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        cost = await pricing_service.calculate_cost("openai", "gpt-4o", 0, 0)
        assert cost == Decimal("0")


class TestPricingServiceRedisCache:
    @pytest.mark.asyncio
    async def test_cache_hit_returns_cached(self, pricing_service, mock_redis, mock_db):
        """When Redis has cached pricing, DB should not be queried."""
        cached_pricing = {"input": "2.50", "output": "10.00"}
        mock_redis.get = AsyncMock(return_value=json.dumps(cached_pricing))

        cost = await pricing_service.calculate_cost("openai", "gpt-4o", 1_000_000, 0)
        assert cost == Decimal("2.50")
        # DB should not have been called
        mock_db.table.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_miss_writes_to_redis(self, pricing_service, mock_redis, mock_db):
        """On DB/hardcoded hit with cache miss, result should be written to Redis."""
        mock_redis.get = AsyncMock(return_value=None)
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None

        await pricing_service.calculate_cost("openai", "gpt-4o", 100, 100)
        mock_redis.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_db_pricing_takes_precedence(self, pricing_service, mock_redis, mock_db):
        """DB pricing should be used when available, ignoring hardcoded."""
        mock_redis.get = AsyncMock(return_value=None)
        mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
            "input_price_per_million": "5.00",
            "output_price_per_million": "20.00",
        }

        cost = await pricing_service.calculate_cost("openai", "gpt-4o", 1_000_000, 1_000_000)
        # Should use DB prices (5.00 + 20.00), not hardcoded (2.50 + 10.00)
        assert cost == Decimal("25.00")


class TestHardcodedPricingCompleteness:
    def test_all_providers_present(self):
        assert "openai" in HARDCODED_PRICING
        assert "anthropic" in HARDCODED_PRICING
        assert "google" in HARDCODED_PRICING

    def test_openai_models(self):
        openai = HARDCODED_PRICING["openai"]
        for model in ["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini"]:
            assert model in openai, f"Missing openai/{model}"

    def test_anthropic_models(self):
        anthropic = HARDCODED_PRICING["anthropic"]
        for model in ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"]:
            assert model in anthropic, f"Missing anthropic/{model}"

    def test_google_models(self):
        google = HARDCODED_PRICING["google"]
        for model in ["gemini-pro", "gemini-flash"]:
            assert model in google, f"Missing google/{model}"

    def test_pricing_values_are_positive(self):
        for provider, models in HARDCODED_PRICING.items():
            for model, prices in models.items():
                assert Decimal(prices["input"]) > 0, f"{provider}/{model} input price must be positive"
                assert Decimal(prices["output"]) > 0, f"{provider}/{model} output price must be positive"
