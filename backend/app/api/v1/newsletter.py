"""Newsletter subscription — public endpoint."""
from __future__ import annotations
import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1", tags=["newsletter"])
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class SubscribeRequest(BaseModel):
    email: str


@router.post("/newsletter/subscribe", status_code=200)
async def subscribe(body: SubscribeRequest) -> dict:
    if not _EMAIL_RE.match(body.email):
        raise HTTPException(status_code=422, detail="Invalid email.")
    try:
        from app.config import settings
        from app.services.brevo import BrevoService
        list_id = int(getattr(settings, "brevo_newsletter_list_id", "0") or 0)
        BrevoService().add_to_newsletter_list(email=body.email, list_id=list_id)
        logger.info(f"[newsletter] subscribed: {body.email}")
    except Exception as exc:
        logger.error(f"[newsletter] failed: {exc}")
        raise HTTPException(status_code=502, detail="Subscription failed.")
    return {"subscribed": True}
