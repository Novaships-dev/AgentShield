"""Schemas for session endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class SessionResponse(BaseModel):
    """A single session summary row."""

    id: str | None = None
    session_id: str
    agents: list[str] = []
    total_steps: int = 0
    total_cost_usd: float | None = None
    total_tokens: int = 0
    status: str = "running"
    duration_ms: int | None = None
    started_at: str | None = None
    ended_at: str | None = None


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    total_pages: int


class SessionListResponse(BaseModel):
    data: list[SessionResponse]
    pagination: PaginationMeta


class StepResponse(BaseModel):
    """A single step within a session timeline."""

    event_id: str
    step: int | None = None
    step_name: str | None = None
    agent: str
    model: str | None = None
    provider: str | None = None
    input_redacted: str | None = None
    output_redacted: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float | None = None
    duration_ms: int | None = None
    status: str = "success"
    pii_detected: list[str] = []
    guardrail_violations: list[str] = []
    tracked_at: str | None = None


class SessionTimelineResponse(BaseModel):
    """Full session detail with step-by-step timeline."""

    session_id: str
    status: str = "running"
    total_cost_usd: float | None = None
    total_tokens: int = 0
    total_steps: int = 0
    duration_ms: int | None = None
    started_at: str | None = None
    ended_at: str | None = None
    agents_involved: list[str] = []
    steps: list[StepResponse] = []
