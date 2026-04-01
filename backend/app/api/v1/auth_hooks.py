"""Auth hooks — welcome email after signup."""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["auth-hooks"])


class WelcomeRequest(BaseModel):
    first_name: str = ""


@router.post("/auth/welcome", status_code=200)
async def send_welcome(body: WelcomeRequest, user: User = Depends(get_current_user)) -> dict:
    try:
        from app.services.brevo import BrevoService
        BrevoService().send_welcome_email(to_email=user.email, first_name=body.first_name)
        logger.info(f"[auth-hooks] welcome sent to {user.email}")
    except Exception as exc:
        logger.error(f"[auth-hooks] welcome failed: {exc}")
    return {"sent": True}
