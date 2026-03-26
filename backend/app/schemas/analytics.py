"""Analytics response schemas."""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class AnalyticsSummary(BaseModel):
    total_cost_usd: float
    total_requests: int
    total_tokens: int
    active_agents: int
    avg_cost_per_request: float
    error_rate_pct: float


class TimeseriesPoint(BaseModel):
    timestamp: str
    cost_usd: float
    requests: int


class AgentBreakdown(BaseModel):
    agent_id: str
    agent_name: str
    cost_usd: float
    pct: float


class ProviderBreakdown(BaseModel):
    provider: str
    cost_usd: float
    pct: float


class ModelBreakdown(BaseModel):
    model: str
    provider: str
    cost_usd: float
    pct: float


class TeamBreakdown(BaseModel):
    team_label: str
    cost_usd: float
    pct: float


class AnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    timeseries: list[TimeseriesPoint]
    by_agent: list[AgentBreakdown]
    by_provider: list[ProviderBreakdown]
    by_model: list[ModelBreakdown]
    by_team: list[TeamBreakdown]
