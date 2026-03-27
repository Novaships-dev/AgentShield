"""PII config schemas."""
from __future__ import annotations
import re
from typing import Optional
from pydantic import BaseModel, Field, model_validator

VALID_PATTERNS = {"email", "phone", "credit_card", "ssn", "ip_address"}


class CustomPattern(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    pattern: str

    @model_validator(mode="after")
    def validate_pattern(self) -> "CustomPattern":
        try:
            re.compile(self.pattern)
        except re.error as exc:
            raise ValueError(f"Invalid regex: {exc}")
        return self


class PIIConfigUpdate(BaseModel):
    patterns_enabled: list[str] = Field(default_factory=lambda: list(VALID_PATTERNS))
    custom_patterns: list[CustomPattern] = Field(default_factory=list)
    action: str = Field("redact", pattern="^(redact|hash|log_only)$")
    store_original: bool = False

    @model_validator(mode="after")
    def validate_patterns(self) -> "PIIConfigUpdate":
        invalid = set(self.patterns_enabled) - VALID_PATTERNS
        if invalid:
            raise ValueError(f"Invalid patterns: {invalid}. Must be one of {VALID_PATTERNS}")
        if len(self.custom_patterns) > 10:
            raise ValueError("Maximum 10 custom patterns allowed.")
        return self


class PIIConfigResponse(BaseModel):
    patterns_enabled: list[str]
    custom_patterns: list[CustomPattern]
    action: str
    store_original: bool
