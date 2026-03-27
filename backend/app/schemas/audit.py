"""Audit log schemas."""
from pydantic import BaseModel
from typing import Optional


class AuditLogEntry(BaseModel):
    id: str
    organization_id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: str
    details: dict
    ip_address: Optional[str] = None
    created_at: str


class AuditLogResponse(BaseModel):
    data: list[AuditLogEntry]
    total: int
    page: int
    per_page: int
