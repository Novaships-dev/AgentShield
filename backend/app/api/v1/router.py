"""API v1 router."""
from fastapi import APIRouter
from app.api.v1 import api_keys

router = APIRouter()
router.include_router(api_keys.router)

# Additional routers registered when their modules are created:
# router.include_router(track.router)
# router.include_router(agents.router)
