"""API v1 router."""
from fastapi import APIRouter
from app.api.v1 import (
    track, agents, api_keys, sessions, analytics, ws,
    alerts, budgets, forecasts, share, guardrails, pii, violations, recommendations,
    billing, teams, audit, webhooks, reports, slack,
)

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
router.include_router(share.router)
router.include_router(guardrails.router)
router.include_router(pii.router)
router.include_router(violations.router)
router.include_router(recommendations.router)
router.include_router(billing.router)
router.include_router(teams.router)
router.include_router(audit.router)
router.include_router(webhooks.router)
router.include_router(reports.router)
router.include_router(slack.router)
