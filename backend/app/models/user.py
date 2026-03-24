"""Domain models for User and Organization."""
from __future__ import annotations
from pydantic import BaseModel


class Organization(BaseModel):
    id: str
    name: str
    plan: str = "free"  # free | starter | pro | team
    max_agents: int = 1
    max_requests: int = 10000  # monthly
    modules_enabled: list[str] = []


class User(BaseModel):
    id: str
    email: str
    role: str = "member"  # owner | admin | member
    organization_id: str
    organization: Organization | None = None
