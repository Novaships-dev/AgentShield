"""POST /v1/track — AI API call event ingestion."""
from fastapi import APIRouter, Depends, Response
from app.dependencies import get_current_org, get_db, get_redis
from app.middleware.rate_limit import check_rate_limit
from app.middleware.plan_limits import check_plan_limits
from app.models.user import Organization
from app.schemas.track import TrackEventRequest, TrackEventResponse
from app.services.tracking import TrackingService

router = APIRouter(tags=["tracking"])


@router.post(
    "/v1/track",
    response_model=TrackEventResponse,
    status_code=201,
    summary="Track an AI API call",
)
async def track_event(
    request: TrackEventRequest,
    response: Response,
    org: Organization = Depends(get_current_org),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> TrackEventResponse:
    """Track a single AI API call event with automatic cost calculation."""
    # 1. Rate limit check
    limit, remaining, reset = await check_rate_limit(org.id, "track", org.plan)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Reset"] = str(reset)
    response.headers["X-AGS-Plan"] = org.plan

    # 2. Plan limit check
    await check_plan_limits(org, "track_event")

    # 3. Track the event
    service = TrackingService(db=db, redis=redis)
    return await service.track_event(org, request)
