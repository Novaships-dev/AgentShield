"""Guardrail rule schemas."""
from __future__ import annotations
import re
from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class GuardrailCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    agent_id: Optional[UUID] = None
    type: str = Field(..., pattern="^(keyword|regex|topic|category)$")
    config: dict[str, Any] = Field(...)
    action: str = Field(..., pattern="^(log|redact|block)$")

    @model_validator(mode="after")
    def validate_config(self) -> "GuardrailCreate":
        t = self.type
        cfg = self.config
        if t == "keyword":
            kws = cfg.get("keywords")
            if not kws or not isinstance(kws, list) or len(kws) == 0:
                raise ValueError("keyword type requires non-empty 'keywords' list")
        elif t == "regex":
            pattern = cfg.get("pattern")
            if not pattern:
                raise ValueError("regex type requires 'pattern' field")
            try:
                re.compile(pattern)
            except re.error as exc:
                raise ValueError(f"Invalid regex pattern: {exc}")
        elif t == "topic":
            valid = {"politics", "religion", "adult_content", "gambling"}
            topics = cfg.get("topics", [])
            invalid = set(topics) - valid
            if invalid:
                raise ValueError(f"Invalid topics: {invalid}")
        elif t == "category":
            valid = {"hate_speech", "self_harm", "illegal_activity", "violence"}
            cats = cfg.get("categories", [])
            invalid = set(cats) - valid
            if invalid:
                raise ValueError(f"Invalid categories: {invalid}")
        return self


class GuardrailUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    config: Optional[dict[str, Any]] = None
    action: Optional[str] = Field(None, pattern="^(log|redact|block)$")
    is_active: Optional[bool] = None


class GuardrailResponse(BaseModel):
    id: UUID
    name: str
    agent_id: Optional[UUID]
    type: str
    config: dict[str, Any]
    action: str
    is_active: bool
    violation_count: int = 0
    created_at: datetime
