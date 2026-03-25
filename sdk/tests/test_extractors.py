"""Tests for LLM response auto-extraction."""
from agentshield.extractors import auto_extract, extract_anthropic, extract_google, extract_openai


class _Usage:
    prompt_tokens = 100
    completion_tokens = 50
    input_tokens = 100
    output_tokens = 50


class _MessageContent:
    content = "Hello!"


class _Choice:
    message = _MessageContent()


class _OpenAIResponse:
    model = "gpt-4o"
    usage = _Usage()
    choices = [_Choice()]


class _AnthropicContent:
    text = "Hello from Anthropic!"


class _AnthropicResponse:
    model = "claude-sonnet-4-6"
    usage = _Usage()
    content = [_AnthropicContent()]


class _GPart:
    text = "Hello from Google!"


class _GContent:
    parts = [_GPart()]


class _GCandidate:
    content = _GContent()


class _GUsageMeta:
    prompt_token_count = 80
    candidates_token_count = 40


class _GoogleResponse:
    candidates = [_GCandidate()]
    usage_metadata = _GUsageMeta()


def test_extract_openai_response():
    result = extract_openai(_OpenAIResponse())
    assert result is not None
    assert result["model"] == "gpt-4o"
    assert result["input_tokens"] == 100
    assert result["output_tokens"] == 50
    assert result["output_text"] == "Hello!"
    assert result["provider"] == "openai"


def test_extract_anthropic_response():
    result = extract_anthropic(_AnthropicResponse())
    assert result is not None
    assert result["model"] == "claude-sonnet-4-6"
    assert result["input_tokens"] == 100
    assert result["output_tokens"] == 50
    assert result["output_text"] == "Hello from Anthropic!"
    assert result["provider"] == "anthropic"


def test_extract_google_response():
    result = extract_google(_GoogleResponse())
    assert result is not None
    assert result["output_text"] == "Hello from Google!"
    assert result["input_tokens"] == 80
    assert result["output_tokens"] == 40
    assert result["provider"] == "google"


def test_auto_extract_unknown_returns_none():
    """Objects with no known LLM response structure return None."""

    class _Unknown:
        data = "nothing"

    result = auto_extract(_Unknown())
    assert result is None


def test_auto_extract_picks_openai_first():
    result = auto_extract(_OpenAIResponse())
    assert result is not None
    assert result["provider"] == "openai"


def test_auto_extract_falls_back_to_anthropic():
    result = auto_extract(_AnthropicResponse())
    # OpenAI extractor fails (no .choices), falls back to Anthropic
    assert result is not None
    assert result["provider"] == "anthropic"


def test_extract_openai_missing_field_returns_none():
    class _Bad:
        model = "gpt-4o"
        # missing usage and choices

    assert extract_openai(_Bad()) is None


def test_extract_google_missing_candidates_returns_none():
    class _Bad:
        candidates = []
        usage_metadata = _GUsageMeta()

    assert extract_google(_Bad()) is None
