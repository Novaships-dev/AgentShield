"""API v1 router."""
from fastapi import APIRouter
from app.api.v1 import track, agents, api_keys

router = APIRouter()
router.include_router(track.router)
router.include_router(agents.router)
router.include_router(api_keys.router)
