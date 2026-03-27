"""Guardrail rules CRUD endpoints — Pro+ plan required."""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, require_role, get_db, get_redis
from app.models.user import User
from app.schemas.guardrail import GuardrailCreate, GuardrailUpdate

router = APIRouter(prefix="/v1", tags=["guardrails"])
MAX_RULES = 30


def _require_pro(user: User = Depends(get_current_user)) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Guardrails require Pro plan or higher.")
    return user


def _require_pro_admin(user: User = Depends(require_role("admin"))) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="Guardrails require Pro plan or higher.")
    return user


@router.post("/guardrails", status_code=201, summary="Create guardrail rule")
async def create_guardrail(
    body: GuardrailCreate,
    user: User = Depends(_require_pro_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    """Create a guardrail rule. Max 30 rules per org."""
    from app.services.guardrails import GuardrailService
    svc = GuardrailService(db=db, redis=redis)

    # Count existing rules
    result = db.table("guardrail_rules").select("id", count="exact").eq("organization_id", user.organization_id).execute()
    if (result.count or 0) >= MAX_RULES:
        raise HTTPException(status_code=409, detail=f"Maximum {MAX_RULES} guardrail rules per organization.")

    return svc.create_rule(user.organization_id, body.model_dump())


@router.get("/guardrails", summary="List guardrail rules")
async def list_guardrails(
    user: User = Depends(_require_pro),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    from app.services.guardrails import GuardrailService
    svc = GuardrailService(db=db, redis=redis)
    return {"data": svc.list_rules(user.organization_id)}


@router.put("/guardrails/{rule_id}", summary="Update guardrail rule")
async def update_guardrail(
    rule_id: str,
    body: GuardrailUpdate,
    user: User = Depends(_require_pro_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> dict:
    from app.services.guardrails import GuardrailService
    svc = GuardrailService(db=db, redis=redis)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = svc.update_rule(user.organization_id, rule_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Guardrail rule not found")
    return result


@router.delete("/guardrails/{rule_id}", status_code=204, summary="Delete guardrail rule")
async def delete_guardrail(
    rule_id: str,
    user: User = Depends(_require_pro_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> None:
    from app.services.guardrails import GuardrailService
    svc = GuardrailService(db=db, redis=redis)
    deleted = svc.delete_rule(user.organization_id, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Guardrail rule not found")
