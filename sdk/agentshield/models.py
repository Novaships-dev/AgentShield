from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class TrackEvent:
    """Represents a single LLM call to be tracked by AgentShield."""

    agent: str
    model: str | None = None
    provider: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float | None = None
    session_id: str | None = None
    step: int | None = None
    step_name: str | None = None
    input_text: str | None = None
    output_text: str | None = None
    status: str = "success"
    duration_ms: int | None = None
    workflow: str | None = None
    user_label: str | None = None
    team_label: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dict, omitting None values."""
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class TrackResponse:
    """Response from the AgentShield tracking API."""

    event_id: str
    agent: str
    cost_usd: float | None
    budget_remaining_usd: float | None
    budget_status: str
    guardrail_violations: list[str]
    pii_detected: list[str]
    warnings: list[str]
