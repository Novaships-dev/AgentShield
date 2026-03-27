"""Budget caps CRUD endpoints — POST/GET/DELETE /v1/budgets."""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, require_role, get_db, get_redis
from app.models.user import User
from app.schemas.budget import BudgetCreate
from app.services.budgets import BudgetService

router = APIRouter(prefix="/v1", tags=["budgets"])


def _require_pro(user: User = Depends(get_current_user)) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Budget caps require Pro plan or higher.")
    return user


def _require_pro_admin(user: User = Depends(require_role("admin"))) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Budget caps require Pro plan or higher.")
    return user


@router.post("/budgets", status_code=201, summary="Create budget cap")
async def create_budget(
    body: BudgetCreate,
    user: User = Depends(_require_pro_admin),
    db=Depends(get_db),
) -> dict:
    """Create a budget cap for an agent or the entire org."""
    svc = BudgetService(db=db)
    return svc.create_budget(user.organization_id, body.model_dump())


@router.get("/budgets", summary="List budget caps")
async def list_budgets(
    user: User = Depends(_require_pro),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """List all active budget caps with current usage."""
    svc = BudgetService(db=db, redis=redis)
    budgets = svc.list_budgets(user.organization_id)

    # Enrich each budget with live Redis counter values
    enriched = []
    for budget in budgets:
        agent_id = budget.get("agent_id") or ""
        current = 0.0
        if agent_id:
            try:
                current = await svc._get_counter(user.organization_id, agent_id, budget["period"])
            except Exception:
                pass
        max_usd = budget.get("max_usd", 1)
        pct = round(current / max_usd * 100, 1) if max_usd > 0 else 0.0
        is_frozen = False
        if agent_id and redis:
            try:
                frozen = await redis.get(f"frozen:{user.organization_id}:{agent_id}")
                is_frozen = bool(frozen)
            except Exception:
                pass
        enriched.append({**budget, "current_usd": round(current, 4), "percentage": pct, "is_frozen": is_frozen})

    return {"data": enriched}


@router.delete("/budgets/{budget_id}", summary="Delete budget cap")
async def delete_budget(
    budget_id: str,
    user: User = Depends(_require_pro_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """Delete a budget cap. Resets counter and unfreezes agent if applicable."""
    svc = BudgetService(db=db, redis=redis)

    # Get budget to know agent_id before deleting
    result = db.table("budget_caps").select("*").eq("id", budget_id).eq("organization_id", user.organization_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget cap not found")

    budget = result.data
    deleted = svc.delete_budget(user.organization_id, budget_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Budget cap not found")

    # Unfreeze agent
    if budget.get("agent_id") and redis:
        try:
            await svc.unfreeze_agent(user.organization_id, budget["agent_id"])
        except Exception:
            pass

    return {"id": budget_id, "deleted": True}
