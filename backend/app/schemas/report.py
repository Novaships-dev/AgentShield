"""Report schemas."""
from pydantic import BaseModel
from typing import Optional


class ReportGenerateRequest(BaseModel):
    period_start: str  # ISO date: 2026-03-01
    period_end: str    # ISO date: 2026-03-31


class ReportResponse(BaseModel):
    id: str
    period_start: str
    period_end: str
    status: str  # generating | ready | failed
    download_url: Optional[str] = None
    file_size_kb: Optional[int] = None
    created_at: str
