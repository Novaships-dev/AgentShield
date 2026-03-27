"""API v1 router."""
from fastapi import APIRouter
from app.api.v1 import track, agents, api_keys, sessions, analytics, ws, alerts, budgets, forecasts

router = APIRouter()
router.include_router(track.router)
router.include_router(agents.router)
router.include_router(api_keys.router)
router.include_router(sessions.router)
router.include_router(analytics.router)
router.include_router(ws.router)
router.include_router(alerts.router)
router.include_router(budgets.router)
router.include_router(forecasts.router)
