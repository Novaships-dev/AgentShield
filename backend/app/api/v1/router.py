"""API v1 router — routes will be added in Sprint 1+."""
from fastapi import APIRouter

router = APIRouter(prefix="/v1", tags=["v1"])

# Endpoints will be registered here in subsequent sprints:
# router.include_router(track.router)
# router.include_router(agents.router)
# router.include_router(analytics.router)
# ...
