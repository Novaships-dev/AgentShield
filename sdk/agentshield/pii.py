"""Client-side PII redaction with 5 built-in patterns and Luhn validation."""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# PII patterns (compiled at import time for performance)
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+\.[\w.\-]+", re.ASCII)
_PHONE_RE = re.compile(r"\+?[\d\s\-()\.\x2D]{7,20}")
_CREDIT_CARD_RE = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_IP_RE = re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")

PII_PATTERNS: dict[str, re.Pattern] = {
    "email": _EMAIL_RE,
    "phone": _PHONE_RE,
    "credit_card": _CREDIT_CARD_RE,
    "ssn": _SSN_RE,
    "ip_address": _IP_RE,
}


def luhn_check(number: str) -> bool:
    """Validate a credit card number using the Luhn algorithm.

    Strips spaces and dashes before checking. Returns False for non-digit strings.
    """
    digits = re.sub(r"[\s\-]", "", number)
    if not digits.isdigit():
        return False
    total = 0
    reverse = digits[::-1]
    for i, ch in enumerate(reverse):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def redact_pii(
    text: str,
    patterns: list[str] | None = None,
) -> tuple[str, list[str]]:
    """Scan text for PII and replace matches with [REDACTED:type].

    Args:
        text: The text to scan.
        patterns: List of pattern names to apply. Defaults to all 5 built-in
                  patterns: email, phone, credit_card, ssn, ip_address.

    Returns:
        Tuple of (redacted_text, detected_types).
    """
    if not text:
        return text, []

    active = patterns if patterns is not None else list(PII_PATTERNS.keys())
    detected: list[str] = []
    result = text

    for name in active:
        pattern = PII_PATTERNS.get(name)
        if pattern is None:
            continue

        matches = list(pattern.finditer(result))
        if not matches:
            continue

        # Filter credit card matches with Luhn check to reduce false positives
        if name == "credit_card":
            matches = [m for m in matches if luhn_check(m.group())]
            if not matches:
                continue

        # Replace from right to left to preserve offsets
        for m in reversed(matches):
            result = result[: m.start()] + f"[REDACTED:{name}]" + result[m.end() :]

        if name not in detected:
            detected.append(name)

    return result, detected
