"""Agent schemas."""
from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    is_active: bool = True
    is_frozen: bool = False
    status: str = "active"
    cost_today_usd: float = 0.0
    cost_month_usd: float = 0.0
    cost_trend_pct: float = 0.0
    requests_today: int = 0
    last_event_at: datetime | None = None
    created_at: datetime


class AgentDetailResponse(AgentResponse):
    metrics: dict = {}


class AgentUpdateRequest(BaseModel):
    description: str | None = None
    is_active: bool | None = None
