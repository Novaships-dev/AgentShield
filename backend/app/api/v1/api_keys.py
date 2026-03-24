"""API key management endpoints — POST/GET/DELETE /v1/api-keys."""
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.services import api_keys as api_keys_service

router = APIRouter(prefix="/v1", tags=["api-keys"])


@router.post("/api-keys", status_code=201, summary="Create an API key")
async def create_api_key(
    body: dict,
    user: User = Depends(require_role("admin")),
) -> dict:
    """Create a new API key. Returns the full key once — never again."""
    name = body.get("name", "")
    if not name:
        from app.utils.errors import ValidationError
        raise ValidationError("Field 'name' is required")
    org_id = user.organization_id
    return await api_keys_service.create_api_key(org_id, name)


@router.get("/api-keys", summary="List API keys")
async def list_api_keys(
    user: User = Depends(get_current_user),
) -> dict:
    """List all API keys for the organization (prefix only, never full key)."""
    return {"data": await api_keys_service.list_api_keys(user.organization_id)}


@router.delete("/api-keys/{key_id}", summary="Revoke an API key")
async def revoke_api_key(
    key_id: str,
    user: User = Depends(require_role("admin")),
) -> dict:
    """Revoke an API key immediately."""
    return await api_keys_service.revoke_api_key(user.organization_id, key_id)
