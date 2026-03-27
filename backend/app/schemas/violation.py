"""Violation schemas."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ViolationResponse(BaseModel):
    id: str
    rule_id: Optional[str]
    guardrail_name: Optional[str]
    agent_id: Optional[str]
    agent_name: Optional[str]
    session_id: Optional[str]
    matched_content: Optional[str]
    action_taken: str
    created_at: datetime
