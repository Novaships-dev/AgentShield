"""Alert rules CRUD endpoints."""
from fastapi import APIRouter, Depends, Query, HTTPException
from app.dependencies import get_current_user, require_plan, get_db
from app.models.user import User
from app.schemas.alert import AlertRuleCreate, AlertRuleUpdate
from app.services.alerts import AlertService
from app.middleware.plan_limits import check_plan_limits

router = APIRouter(prefix="/v1", tags=["alerts"])


def _require_starter(user: User = Depends(get_current_user)) -> User:
    """Verify user org has at least Starter plan."""
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 2:
        raise HTTPException(status_code=403, detail="Alerts require Starter plan or higher.")
    return user


@router.post("/alerts", status_code=201, summary="Create alert rule")
async def create_alert(
    body: AlertRuleCreate,
    user: User = Depends(_require_starter),
    db=Depends(get_db),
) -> dict:
    """Create a new alert rule. Max 20 rules per org."""
    await check_plan_limits(user.organization, "create_alert")
    svc = AlertService(db=db)
    return svc.create_rule(user.organization_id, body.model_dump())


@router.get("/alerts", summary="List alert rules")
async def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: User = Depends(_require_starter),
    db=Depends(get_db),
) -> dict:
    svc = AlertService(db=db)
    return svc.list_rules(user.organization_id, page=page, per_page=per_page)


@router.get("/alerts/history", summary="Alert history")
async def get_alert_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: User = Depends(_require_starter),
    db=Depends(get_db),
) -> dict:
    svc = AlertService(db=db)
    return svc.list_history(user.organization_id, page=page, per_page=per_page)


@router.put("/alerts/{rule_id}", summary="Update alert rule")
async def update_alert(
    rule_id: str,
    body: AlertRuleUpdate,
    user: User = Depends(_require_starter),
    db=Depends(get_db),
) -> dict:
    svc = AlertService(db=db)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    result = svc.update_rule(user.organization_id, rule_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return result


@router.delete("/alerts/{rule_id}", summary="Delete alert rule")
async def delete_alert(
    rule_id: str,
    user: User = Depends(_require_starter),
    db=Depends(get_db),
) -> dict:
    svc = AlertService(db=db)
    deleted = svc.delete_rule(user.organization_id, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return {"id": rule_id, "deleted": True}


@router.patch("/alerts/{rule_id}/toggle", summary="Toggle alert rule")
async def toggle_alert(
    rule_id: str,
    body: dict,
    user: User = Depends(_require_starter),
    db=Depends(get_db),
) -> dict:
    is_active = body.get("is_active", True)
    svc = AlertService(db=db)
    result = svc.toggle_rule(user.organization_id, rule_id, is_active)
    if not result:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return result
