"""PII config endpoints — GET/PUT /v1/pii."""
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, require_role, get_db, get_redis
from app.models.user import User
from app.schemas.pii import PIIConfigUpdate, PIIConfigResponse, VALID_PATTERNS

router = APIRouter(prefix="/v1", tags=["pii"])

_DEFAULT_CONFIG = {
    "patterns_enabled": list(VALID_PATTERNS),
    "custom_patterns": [],
    "action": "redact",
    "store_original": False,
}


def _require_pro(user: User = Depends(get_current_user)) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="PII configuration requires Pro plan or higher.")
    return user


def _require_pro_admin(user: User = Depends(require_role("admin"))) -> User:
    plan_rank = {"free": 1, "starter": 2, "pro": 3, "team": 4}
    if plan_rank.get(user.organization.plan, 1) < 3:
        raise HTTPException(status_code=403, detail="PII configuration requires Pro plan or higher.")
    return user


@router.get("/pii", response_model=PIIConfigResponse, summary="Get PII config")
async def get_pii_config(
    user: User = Depends(_require_pro),
    db=Depends(get_db),
) -> PIIConfigResponse:
    """Get the organization's PII redaction configuration."""
    result = (
        db.table("pii_configs")
        .select("*")
        .eq("organization_id", user.organization_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return PIIConfigResponse(**_DEFAULT_CONFIG)

    data = result.data
    return PIIConfigResponse(
        patterns_enabled=data.get("patterns_enabled") or _DEFAULT_CONFIG["patterns_enabled"],
        custom_patterns=data.get("custom_patterns") or [],
        action=data.get("action", "redact"),
        store_original=data.get("store_original", False),
    )


@router.put("/pii", response_model=PIIConfigResponse, summary="Update PII config")
async def update_pii_config(
    body: PIIConfigUpdate,
    user: User = Depends(_require_pro_admin),
    db=Depends(get_db),
    redis=Depends(get_redis),
) -> PIIConfigResponse:
    """Update PII config and invalidate Redis cache."""
    org_id = user.organization_id
    data = body.model_dump()
    data["organization_id"] = org_id

    # Upsert
    db.table("pii_configs").upsert(
        data,
        on_conflict="organization_id",
    ).execute()

    # Invalidate Redis cache so next request picks up new config
    try:
        await redis.delete(f"pii:{org_id}")
    except Exception:
        pass

    return PIIConfigResponse(**body.model_dump())
