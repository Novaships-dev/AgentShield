"""API v1 router."""
from fastapi import APIRouter
from app.api.v1 import track, api_keys

router = APIRouter()
router.include_router(track.router)
router.include_router(api_keys.router)

# Agents router registered after S1-T09:
# from app.api.v1 import agents
# router.include_router(agents.router)
