"""PDF report endpoints — generate, list, download."""
from __future__ import annotations
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.dependencies import get_current_user, get_db, require_plan, require_role
from app.models.user import User
from app.schemas.report import ReportGenerateRequest, ReportResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["reports"])

_require_team = require_plan("team")
_require_admin = require_role("admin")

MAX_REPORTS_PER_MONTH = 10


@router.post("/reports/generate", response_model=ReportResponse, status_code=202)
async def generate_report(
    body: ReportGenerateRequest,
    user: User = Depends(_require_admin),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> ReportResponse:
    """Kick off async PDF report generation."""
    now = datetime.now(timezone.utc)
    month_start = f"{now.year}-{now.month:02d}-01"
    month_end = f"{now.year}-{now.month:02d}-31"

    # Enforce max 10/month
    count = (
        db.table("reports")
        .select("id", count="exact")
        .eq("organization_id", user.organization_id)
        .gte("created_at", month_start)
        .lte("created_at", month_end)
        .execute()
    )
    if (count.count or 0) >= MAX_REPORTS_PER_MONTH:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_REPORTS_PER_MONTH} reports per month reached.",
        )

    # Create DB record
    result = db.table("reports").insert({
        "organization_id": user.organization_id,
        "period_start": body.period_start,
        "period_end": body.period_end,
        "status": "generating",
        "created_by": user.id,
    }).execute()
    report = result.data[0]
    report_id = report["id"]

    # Dispatch Celery task
    try:
        from app.workers.tasks_reports import generate_pdf
        generate_pdf.delay(
            report_id=report_id,
            organization_id=user.organization_id,
            period_start=body.period_start,
            period_end=body.period_end,
        )
    except Exception as exc:
        logger.error(f"[reports] failed to queue task: {exc}")

    return ReportResponse(
        id=report_id,
        period_start=body.period_start,
        period_end=body.period_end,
        status="generating",
        created_at=report.get("created_at", ""),
    )


@router.get("/reports", response_model=list[ReportResponse])
async def list_reports(
    user: User = Depends(get_current_user),
    _plan=Depends(_require_team),
    db=Depends(get_db),
) -> list[ReportResponse]:
    result = (
        db.table("reports")
        .select("id, period_start, period_end, status, download_url, file_size_kb, created_at")
        .eq("organization_id", user.organization_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return [ReportResponse(**r) for r in (result.data or [])]


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: str,
    user: User = Depends(get_current_user),
    _plan=Depends(_require_team),
    db=Depends(get_db),
):
    """Stream the PDF file for download."""
    row = (
        db.table("reports")
        .select("id, status, file_path, period_start, period_end")
        .eq("id", report_id)
        .eq("organization_id", user.organization_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Report not found.")

    r = row.data
    if r["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Report is not ready yet (status: {r['status']}).")

    filepath = r.get("file_path", "")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report file not found on server.")

    filename = f"agentshield-report-{r['period_start']}-{r['period_end']}.pdf"
    return FileResponse(filepath, media_type="application/pdf", filename=filename)
