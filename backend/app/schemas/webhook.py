"""Webhook schemas."""
from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, Literal

VALID_EVENTS = frozenset({
    "event.tracked",
    "alert.fired",
    "smart_alert.diagnosed",
    "anomaly.detected",
    "budget.warning",
    "budget.exceeded",
    "agent.frozen",
    "session.completed",
    "guardrail.violated",
    "pii.detected",
})


class WebhookEndpointCreate(BaseModel):
    url: str
    events: list[str]

    @field_validator("url")
    @classmethod
    def must_be_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Webhook URL must use HTTPS.")
        return v

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        invalid = set(v) - VALID_EVENTS
        if invalid:
            raise ValueError(f"Invalid event types: {invalid}")
        return v


class WebhookEndpointResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    is_active: bool
    has_secret: bool = False
    secret: Optional[str] = None
    consecutive_failures: int = 0
    created_at: str


class WebhookDeliveryResponse(BaseModel):
    id: str
    endpoint_id: str
    event_type: str
    status: str
    status_code: Optional[int] = None
    attempt: int
    error_message: Optional[str] = None
    created_at: str
    delivered_at: Optional[str] = None


class TestWebhookResponse(BaseModel):
    delivery_id: str
    status_code: Optional[int]
    success: bool
