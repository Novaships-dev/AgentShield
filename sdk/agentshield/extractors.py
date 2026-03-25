"""Auto-extraction of LLM response data for OpenAI, Anthropic, and Google."""

from __future__ import annotations

from typing import Any


def extract_openai(response: Any) -> dict | None:
    """Extract token counts and text from an OpenAI response object."""
    try:
        return {
            "model": response.model,
            "input_tokens": response.usage.prompt_tokens,
            "output_tokens": response.usage.completion_tokens,
            "output_text": response.choices[0].message.content,
            "provider": "openai",
        }
    except (AttributeError, TypeError, IndexError):
        return None


def extract_anthropic(response: Any) -> dict | None:
    """Extract token counts and text from an Anthropic response object."""
    try:
        return {
            "model": response.model,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "output_text": response.content[0].text,
            "provider": "anthropic",
        }
    except (AttributeError, TypeError, IndexError):
        return None


def extract_google(response: Any) -> dict | None:
    """Extract token counts and text from a Google Gemini response object."""
    try:
        return {
            "output_text": response.candidates[0].content.parts[0].text,
            "input_tokens": response.usage_metadata.prompt_token_count,
            "output_tokens": response.usage_metadata.candidates_token_count,
            "provider": "google",
        }
    except (AttributeError, TypeError, IndexError):
        return None


def auto_extract(response: Any) -> dict | None:
    """Try each extractor in order; return first successful result or None."""
    for extractor in (extract_openai, extract_anthropic, extract_google):
        result = extractor(response)
        if result is not None:
            return result
    return None
