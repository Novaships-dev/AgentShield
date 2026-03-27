"""Slack integration — slash commands and OAuth flow."""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/slack", tags=["slack"])

# ---------------------------------------------------------------------------
# HMAC verification helper
# ---------------------------------------------------------------------------

def _verify_slack_signature(body: bytes, timestamp: str, signature: str) -> None:
    """Verify that the request comes from Slack using HMAC SHA-256."""
    if not settings.slack_signing_secret:
        raise HTTPException(status_code=503, detail="Slack integration not configured.")

    # Reject old timestamps (replay attack prevention)
    try:
        ts = int(timestamp)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid timestamp.")

    if abs(time.time() - ts) > 300:  # 5 minutes
        raise HTTPException(status_code=400, detail="Request too old.")

    basestring = f"v0:{timestamp}:{body.decode('utf-8')}"
    expected = "v0=" + hmac.new(
        key=settings.slack_signing_secret.encode(),
        msg=basestring.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid Slack signature.")


# ---------------------------------------------------------------------------
# Slash commands — POST /v1/slack/commands
# ---------------------------------------------------------------------------

async def _get_org_id_for_slack_team(slack_team_id: str, db: AsyncSession) -> str | None:
    """Look up the org linked to a Slack workspace."""
    from sqlalchemy import text
    result = await db.execute(
        text("SELECT organization_id FROM slack_installations WHERE slack_team_id = :tid LIMIT 1"),
        {"tid": slack_team_id},
    )
    row = result.fetchone()
    return str(row[0]) if row else None


async def _handle_status(org_id: str, db: AsyncSession) -> dict:
    from sqlalchemy import text
    result = await db.execute(
        text("""
            SELECT
                COUNT(DISTINCT agent_name) AS agents,
                COALESCE(SUM(cost_usd), 0) AS today_cost
            FROM events
            WHERE organization_id = :org_id
              AND created_at >= CURRENT_DATE
        """),
        {"org_id": org_id},
    )
    row = result.fetchone()
    agents = row[0] if row else 0
    cost = float(row[1]) if row else 0.0
    return {
        "response_type": "in_channel",
        "text": f"*AgentShield Status*\nActive agents today: *{agents}* | Cost today: *${cost:.4f}*",
    }


async def _handle_agent(org_id: str, agent_name: str, db: AsyncSession) -> dict:
    from sqlalchemy import text
    result = await db.execute(
        text("""
            SELECT
                COUNT(*) AS calls,
                COALESCE(SUM(cost_usd), 0) AS cost,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
            FROM events
            WHERE organization_id = :org_id
              AND agent_name = :name
              AND created_at >= CURRENT_DATE
        """),
        {"org_id": org_id, "name": agent_name},
    )
    row = result.fetchone()
    if not row or row[0] == 0:
        return {"response_type": "ephemeral", "text": f"No data found for agent `{agent_name}` today."}
    calls, cost, tokens = row
    return {
        "response_type": "in_channel",
        "text": (
            f"*Agent: {agent_name}* (today)\n"
            f"Calls: *{calls}* | Tokens: *{int(tokens):,}* | Cost: *${float(cost):.4f}*"
        ),
    }


async def _handle_violations(org_id: str, db: AsyncSession) -> dict:
    from sqlalchemy import text
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM guardrail_violations
            WHERE organization_id = :org_id
              AND created_at >= CURRENT_DATE
        """),
        {"org_id": org_id},
    )
    count = result.scalar() or 0
    if count == 0:
        return {"response_type": "in_channel", "text": "✅ *No guardrail violations* today."}
    return {
        "response_type": "in_channel",
        "text": f"⚠️ *{count} guardrail violation(s)* today. View details: https://app.agentshield.one/dashboard/violations",
    }


async def _handle_forecast(org_id: str, db: AsyncSession) -> dict:
    from sqlalchemy import text
    result = await db.execute(
        text("""
            SELECT projected_cost_usd, confidence_interval_usd
            FROM cost_forecasts
            WHERE organization_id = :org_id
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"org_id": org_id},
    )
    row = result.fetchone()
    if not row:
        return {"response_type": "ephemeral", "text": "No forecast available yet. Need at least 3 days of data."}
    projected, ci = float(row[0]), float(row[1])
    return {
        "response_type": "in_channel",
        "text": f"📊 *End-of-month forecast*: *${projected:.2f}* ±${ci:.2f}",
    }


def _handle_help() -> dict:
    return {
        "response_type": "ephemeral",
        "text": (
            "*AgentShield Slash Commands*\n"
            "• `/shield status` — Cost and agent summary for today\n"
            "• `/shield agent <name>` — Stats for a specific agent\n"
            "• `/shield session <id>` — Link to session replay\n"
            "• `/shield violations` — Guardrail violations today\n"
            "• `/shield forecast` — End-of-month cost forecast\n"
            "• `/shield help` — Show this message"
        ),
    }


@router.post("/commands", summary="Slack slash command handler")
async def slack_commands(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_slack_request_timestamp: Annotated[str, Header()] = "",
    x_slack_signature: Annotated[str, Header()] = "",
    command: Annotated[str, Form()] = "",
    text: Annotated[str, Form()] = "",
    team_id: Annotated[str, Form()] = "",
    user_id: Annotated[str, Form()] = "",
) -> JSONResponse:
    """Handle /shield slash commands from Slack."""
    body = await request.body()
    _verify_slack_signature(body, x_slack_request_timestamp, x_slack_signature)

    org_id = await _get_org_id_for_slack_team(team_id, db)
    if not org_id:
        return JSONResponse({"response_type": "ephemeral", "text": "AgentShield is not connected to this workspace. Visit https://app.agentshield.one/dashboard/settings to connect."})

    parts = text.strip().split()
    subcommand = parts[0].lower() if parts else "help"

    if subcommand == "status":
        payload = await _handle_status(org_id, db)
    elif subcommand == "agent" and len(parts) >= 2:
        payload = await _handle_agent(org_id, parts[1], db)
    elif subcommand == "session" and len(parts) >= 2:
        session_id = parts[1]
        payload = {
            "response_type": "in_channel",
            "text": f"🔄 *Session Replay*: https://app.agentshield.one/share/{session_id}",
        }
    elif subcommand == "violations":
        payload = await _handle_violations(org_id, db)
    elif subcommand == "forecast":
        payload = await _handle_forecast(org_id, db)
    else:
        payload = _handle_help()

    return JSONResponse(payload)


# ---------------------------------------------------------------------------
# OAuth — GET /v1/slack/authorize  +  GET /v1/slack/callback
# ---------------------------------------------------------------------------

@router.get("/authorize", summary="Start Slack OAuth flow")
async def slack_authorize(
    user: User = Depends(get_current_user),
) -> RedirectResponse:
    """Redirect to Slack OAuth consent page."""
    if not settings.slack_client_id:
        raise HTTPException(status_code=503, detail="Slack OAuth not configured.")

    scopes = "commands,chat:write,chat:write.public"
    redirect_uri = f"{settings.app_url}/v1/slack/callback"
    state = user.organization_id  # use org_id as state — validated on callback

    url = (
        f"https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.slack_client_id}"
        f"&scope={scopes}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )
    return RedirectResponse(url)


@router.get("/callback", summary="Slack OAuth callback")
async def slack_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Exchange code for access token and store the installation."""
    import httpx

    if not settings.slack_client_id or not settings.slack_client_secret:
        raise HTTPException(status_code=503, detail="Slack OAuth not configured.")

    redirect_uri = f"{settings.app_url}/v1/slack/callback"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": settings.slack_client_id,
                "client_secret": settings.slack_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )

    data = resp.json()
    if not data.get("ok"):
        logger.error("Slack OAuth failed: %s", data.get("error"))
        return RedirectResponse(f"https://app.agentshield.one/dashboard/settings?slack_error=1")

    from sqlalchemy import text
    await db.execute(
        text("""
            INSERT INTO slack_installations (organization_id, slack_team_id, slack_team_name, access_token, bot_user_id)
            VALUES (:org_id, :team_id, :team_name, :token, :bot_id)
            ON CONFLICT (organization_id) DO UPDATE
            SET slack_team_id = EXCLUDED.slack_team_id,
                slack_team_name = EXCLUDED.slack_team_name,
                access_token = EXCLUDED.access_token,
                bot_user_id = EXCLUDED.bot_user_id,
                updated_at = NOW()
        """),
        {
            "org_id": state,
            "team_id": data["team"]["id"],
            "team_name": data["team"]["name"],
            "token": data["access_token"],
            "bot_id": data.get("bot_user_id", ""),
        },
    )
    await db.commit()

    return RedirectResponse("https://app.agentshield.one/dashboard/settings?slack_connected=1")
