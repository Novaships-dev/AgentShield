"""GET /v1/analytics — dashboard analytics endpoint."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.analytics import AnalyticsResponse
from app.services.analytics import AnalyticsService

router = APIRouter(tags=["analytics"])


@router.get(
    "/v1/analytics",
    response_model=AnalyticsResponse,
    summary="Get analytics for the dashboard",
)
async def get_analytics(
    range: str = Query("30d", description="Named range: today | 7d | 30d | 90d"),
    start: Optional[datetime] = Query(None, description="Custom start (ISO 8601)"),
    end: Optional[datetime] = Query(None, description="Custom end (ISO 8601)"),
    agent_id: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    team_label: Optional[str] = Query(None),
    granularity: Optional[str] = Query(None, description="hour | day (auto if omitted)"),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> AnalyticsResponse:
    org_id = user.organization_id
    service = AnalyticsService(db=db, redis=redis)
    return await service.get_analytics(
        org_id=org_id,
        range_val=range,
        start=start,
        end=end,
        agent_id=agent_id,
        provider=provider,
        model=model,
        team_label=team_label,
        granularity=granularity,
    )


@router.get(
    "/v1/analytics/summary",
    summary="Get organization summary including plan",
)
async def get_analytics_summary(
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Return organization info including plan, for the billing page."""
    org_row = (
        db.table("organizations")
        .select("id, name, plan, max_agents, max_requests, modules_enabled, stripe_customer_id, stripe_subscription_id")
        .eq("id", user.organization_id)
        .maybe_single()
        .execute()
    )
    org_data = org_row.data if org_row and org_row.data else {}
    return {
        "organization": {
            "plan": org_data.get("plan", "free"),
            "stripe_customer_id": org_data.get("stripe_customer_id"),
            "stripe_subscription_id": org_data.get("stripe_subscription_id"),
            "max_agents": org_data.get("max_agents", 1),
            "max_requests": org_data.get("max_requests", 10000),
            "modules_enabled": org_data.get("modules_enabled", []),
        }
    }
