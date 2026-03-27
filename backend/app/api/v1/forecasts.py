"""GET /v1/forecasts — EOM cost projection."""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User

router = APIRouter(prefix="/v1", tags=["forecasts"])


def _require_starter(user: User = Depends(get_current_user)) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 2:
        raise HTTPException(status_code=403, detail="Forecasts require Starter plan or higher.")
    return user


@router.get("/forecasts", summary="Get EOM cost forecast")
async def get_forecasts(
    user: User = Depends(_require_starter),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """Return end-of-month cost projection. Uses Redis cache (TTL 1h), computes on-the-fly on miss."""
    from app.services.forecast import ForecastService
    svc = ForecastService(db=db, redis=redis)
    return await svc.get_forecast(user.organization_id)
