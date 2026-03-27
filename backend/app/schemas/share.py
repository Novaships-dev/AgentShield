"""Session sharing schemas."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ShareSessionRequest(BaseModel):
    expires_in: str = Field("24h", pattern="^(1h|24h|7d|never)$")


class ShareSessionResponse(BaseModel):
    share_token: str
    share_url: str
    expires_at: Optional[datetime]
    session_id: str
