"""Server-side PII patterns — mirrors client-side agentshield.pii patterns."""
from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+\.[\w.\-]+", re.ASCII)
_CREDIT_CARD_RE = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
_IP_RE = re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b")
_PHONE_RE = re.compile(
    r"(?:"
    r"\+\d{1,3}[\s\-\(]?[\d\s\-\(\)\.]{5,17}\d"
    r"|\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}"
    r"|\d{2,4}(?:[\s]\d{2,4}){2,4}"
    r")"
)

# Application order: most specific first
PII_PATTERNS: dict[str, re.Pattern] = {
    "email": _EMAIL_RE,
    "ssn": _SSN_RE,
    "ip_address": _IP_RE,
    "credit_card": _CREDIT_CARD_RE,
    "phone": _PHONE_RE,
}


def luhn_check(number: str) -> bool:
    """Validate a credit card number using the Luhn algorithm."""
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


def redact_text(
    text: str,
    active_patterns: list[str] | None = None,
) -> tuple[str, list[str]]:
    """Redact PII from text, returning (redacted_text, detected_types)."""
    if not text:
        return text, []

    patterns_to_apply = active_patterns if active_patterns is not None else list(PII_PATTERNS.keys())
    detected: list[str] = []
    result = text

    for name in patterns_to_apply:
        pattern = PII_PATTERNS.get(name)
        if pattern is None:
            continue

        matches = list(pattern.finditer(result))
        if not matches:
            continue

        if name == "credit_card":
            matches = [m for m in matches if luhn_check(m.group())]
            if not matches:
                continue

        for m in reversed(matches):
            result = result[: m.start()] + f"[REDACTED:{name}]" + result[m.end() :]

        if name not in detected:
            detected.append(name)

    return result, detected
