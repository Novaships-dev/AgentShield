"""Client-side PII redaction with 5 built-in patterns and Luhn validation."""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# PII patterns (compiled at import time for performance)
# Order matters: more specific patterns are applied before broader ones
# (e.g., SSN before phone to prevent 123-45-6789 from matching phone).
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+\.[\w.\-]+", re.ASCII)

# Credit card: exactly 16 digits in 4 groups of 4 (optional spaces/dashes)
_CREDIT_CARD_RE = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")

# SSN: strict NNN-NN-NNNN format
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# IP address: four groups of 1-3 digits separated by dots
_IP_RE = re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")

# Phone: international format (+prefix) or groups separated by spaces/parens/dashes
# Requires either + prefix OR at least one separator within the number.
# Pure digit sequences (no separators, no +) are NOT matched.
_PHONE_RE = re.compile(
    r"(?:"
    r"\+\d{1,3}[\s\-\(]?[\d\s\-\(\)\.]{5,17}\d"  # international: +33 6 12 34 56 78
    r"|\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}"          # US: (555) 555-5555 or 555-555-5555
    r"|\d{2,4}(?:[\s]\d{2,4}){2,4}"               # FR/EU grouped: 06 12 34 56 78
    r")"
)

# Application order: most specific first to avoid double-matching
PII_PATTERNS: dict[str, re.Pattern] = {
    "email": _EMAIL_RE,
    "ssn": _SSN_RE,
    "ip_address": _IP_RE,
    "credit_card": _CREDIT_CARD_RE,
    "phone": _PHONE_RE,
}


def luhn_check(number: str) -> bool:
    """Validate a credit card number using the Luhn algorithm.

    Strips spaces and dashes before checking. Returns False for non-digit strings.
    Note: All-zero digit strings are mathematically Luhn-valid (sum = 0).
    """
    digits = re.sub(r"[\s\-]", "", number)
    if not digits.isdigit() or len(digits) < 13:
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
                  patterns applied in specificity order.

    Returns:
        Tuple of (redacted_text, detected_types).
    """
    if not text:
        return text, []

    # Respect caller-specified order, or use default specificity order
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

        # Credit card: require Luhn validation to reduce false positives
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
