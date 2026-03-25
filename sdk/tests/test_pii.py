"""Tests for client-side PII redaction."""
import pytest

from agentshield.pii import luhn_check, redact_pii


def test_email_redacted():
    text = "Contact me at john@example.com for details."
    result, types = redact_pii(text)
    assert "[REDACTED:email]" in result
    assert "email" in types
    assert "john@example.com" not in result


def test_phone_redacted():
    text = "Call me at +33 6 12 34 56 78"
    result, types = redact_pii(text)
    assert "phone" in types


def test_credit_card_luhn_valid_redacted():
    # Luhn-valid test card: 4539 1488 0343 6467
    text = "Card: 4539148803436467"
    result, types = redact_pii(text)
    assert "[REDACTED:credit_card]" in result
    assert "credit_card" in types


def test_credit_card_luhn_invalid_not_redacted():
    # 16-digit number that fails Luhn check
    text = "Number: 1234567890123456"
    result, types = redact_pii(text)
    assert "credit_card" not in types
    assert "1234567890123456" in result


def test_ssn_redacted():
    text = "My SSN is 123-45-6789."
    result, types = redact_pii(text)
    assert "[REDACTED:ssn]" in result
    assert "ssn" in types


def test_ip_redacted():
    text = "Server at 192.168.1.100"
    result, types = redact_pii(text)
    assert "[REDACTED:ip_address]" in result
    assert "ip_address" in types


def test_multiple_pii_types():
    text = "Email john@test.com and SSN 987-65-4320"
    result, types = redact_pii(text)
    assert "email" in types
    assert "ssn" in types
    assert "john@test.com" not in result
    assert "987-65-4320" not in result


def test_no_false_positives_on_normal_text():
    text = "The quick brown fox jumps over the lazy dog."
    result, types = redact_pii(text)
    assert result == text
    # May detect phone-like patterns in very short sequences but main text unchanged
    assert "email" not in types
    assert "ssn" not in types
    assert "credit_card" not in types


def test_empty_text_returns_empty():
    result, types = redact_pii("")
    assert result == ""
    assert types == []


def test_pii_disabled_returns_original():
    """When passing an empty patterns list, nothing is redacted."""
    text = "Email: john@example.com, SSN: 123-45-6789"
    result, types = redact_pii(text, patterns=[])
    assert result == text
    assert types == []


def test_selective_patterns():
    """Only specified patterns are applied."""
    text = "Email john@test.com and SSN 987-65-4320"
    result, types = redact_pii(text, patterns=["email"])
    assert "email" in types
    assert "ssn" not in types
    assert "john@test.com" not in result
    assert "987-65-4320" in result


def test_luhn_check_valid():
    assert luhn_check("4539148803436467") is True
    assert luhn_check("4539 1488 0343 6467") is True


def test_luhn_check_invalid():
    assert luhn_check("1234567890123456") is False
    # Changing the last digit of a valid card by 1 makes it invalid
    assert luhn_check("4539148803436468") is False


def test_none_text_handling():
    """None-like empty string returns unchanged."""
    result, types = redact_pii("", patterns=None)
    assert result == ""
    assert types == []
