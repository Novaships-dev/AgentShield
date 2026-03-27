"""GET /v1/recommendations — Cost Autopilot model recommendations."""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User

router = APIRouter(prefix="/v1", tags=["recommendations"])


def _require_pro(user: User = Depends(get_current_user)) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Cost Autopilot requires Pro plan or higher.")
    return user


@router.get("/recommendations", summary="Get Cost Autopilot recommendations")
async def get_recommendations(
    user: User = Depends(_require_pro),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """
    Return cached model optimization recommendations.
    Recommendations are computed weekly by the Celery task.
    On cache miss: triggers async computation and returns empty list.
    """
    from app.services.recommendations import RecommendationService
    svc = RecommendationService(db=db, redis=redis)
    recs = await svc.get_recommendations(user.organization_id)

    if not recs:
        # Trigger async compute (non-blocking) — results ready within 30s
        try:
            from app.workers.tasks_recommendations import generate_org
            generate_org.delay(user.organization_id)
        except Exception:
            pass

    return {"data": recs}
