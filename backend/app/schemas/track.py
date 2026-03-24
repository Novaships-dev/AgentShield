"""Schemas for POST /v1/track."""
from __future__ import annotations
from uuid import UUID
from pydantic import BaseModel, Field


class TrackEventRequest(BaseModel):
    """Request body for POST /v1/track."""
    agent: str = Field(..., min_length=1, max_length=100, description="Agent name")
    model: str | None = Field(None, max_length=100)
    provider: str | None = Field(None, max_length=50)
    input_tokens: int | None = Field(None, ge=0)
    output_tokens: int | None = Field(None, ge=0)
    cost_usd: float | None = Field(None, ge=0)
    session_id: str | None = Field(None, max_length=200)
    step: int | None = Field(None, ge=0)
    step_name: str | None = Field(None, max_length=100)
    input_text: str | None = Field(None, max_length=50000)
    output_text: str | None = Field(None, max_length=50000)
    status: str = Field("success", pattern="^(success|error|timeout)$")
    duration_ms: int | None = Field(None, ge=0)
    workflow: str | None = Field(None, max_length=100)
    user_label: str | None = Field(None, max_length=100)
    team_label: str | None = Field(None, max_length=100)
    metadata: dict | None = Field(None)


class TrackEventResponse(BaseModel):
    """Response for POST /v1/track."""
    event_id: UUID
    agent: str
    cost_usd: float | None
    budget_remaining_usd: float | None = None
    budget_status: str = "ok"
    guardrail_violations: list[str] = []
    pii_detected: list[str] = []
    warnings: list[str] = []
