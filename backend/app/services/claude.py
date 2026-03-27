"""Claude API client for Smart Alerts and Cost Autopilot."""
from __future__ import annotations
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 1000
TIMEOUT = 30


def call_claude(system: str, user: str) -> dict:
    """
    Call the Claude API synchronously (used inside Celery tasks).
    Returns parsed JSON response or a fallback dict.
    """
    from app.config import settings

    api_key = getattr(settings, "anthropic_api_key", "")
    if not api_key:
        logger.warning("[claude] ANTHROPIC_API_KEY not configured — returning fallback")
        return {"diagnosis": "AI diagnosis unavailable (API key not configured).", "suggested_fix": "", "confidence": 0}

    import urllib.request
    import urllib.error

    payload = json.dumps({
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data["content"][0]["text"].strip()
            # Try to parse JSON response
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"diagnosis": text, "suggested_fix": "", "confidence": 0}
    except Exception as exc:
        logger.error(f"[claude] API call failed: {exc}")
        return {"diagnosis": "AI diagnosis temporarily unavailable.", "suggested_fix": "", "confidence": 0}
