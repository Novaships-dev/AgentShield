"""Budget cap schemas."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    agent_id: Optional[UUID] = None
    max_usd: float = Field(..., gt=0)
    period: str = Field("monthly", pattern="^(daily|weekly|monthly)$")
    action: str = Field("freeze", pattern="^(freeze|alert_only)$")


class BudgetResponse(BaseModel):
    id: UUID
    agent_id: Optional[UUID]
    agent_name: Optional[str]
    max_usd: float
    period: str
    action: str
    current_usd: float
    percentage: float
    is_frozen: bool
    created_at: datetime
