"""Billing schemas."""
from pydantic import BaseModel
from typing import Literal


class CheckoutRequest(BaseModel):
    plan: Literal["starter", "pro", "team"]
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PortalResponse(BaseModel):
    portal_url: str
