"""Forecast schemas."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AgentForecast(BaseModel):
    agent_id: str
    agent_name: str
    projected_eom_usd: float
    pct_of_total: float


class OrgForecast(BaseModel):
    projected_eom_usd: Optional[float]
    confidence_low: Optional[float]
    confidence_high: Optional[float]
    current_month_usd: float
    days_elapsed: int
    days_remaining: int
    insufficient_data: bool = False
    calculated_at: datetime


class ForecastResponse(BaseModel):
    organization: OrgForecast
    by_agent: list[AgentForecast]
