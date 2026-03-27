"""Alert rule schemas."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    agent_id: Optional[UUID] = None
    metric: str = Field(..., pattern="^(cost_daily|cost_weekly|cost_monthly|requests_daily|requests_hourly|error_rate)$")
    threshold: float = Field(..., gt=0)
    channel: str = Field("email", pattern="^(email|slack|both)$")
    slack_webhook: Optional[str] = None
    cooldown_minutes: int = Field(60, ge=5, le=1440)


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    threshold: Optional[float] = Field(None, gt=0)
    channel: Optional[str] = Field(None, pattern="^(email|slack|both)$")
    slack_webhook: Optional[str] = None
    cooldown_minutes: Optional[int] = Field(None, ge=5, le=1440)


class AlertRuleResponse(BaseModel):
    id: UUID
    name: str
    agent_id: Optional[UUID]
    agent_name: Optional[str]
    metric: str
    threshold: float
    channel: str
    is_active: bool
    last_triggered: Optional[datetime]
    cooldown_minutes: int
    created_at: datetime


class AlertHistoryResponse(BaseModel):
    id: UUID
    alert_rule_id: UUID
    alert_name: str
    agent_name: Optional[str]
    metric: str
    triggered_value: float
    threshold: float
    channel: str
    smart_diagnosis: Optional[str]
    suggested_fix: Optional[str]
    sent_at: datetime
