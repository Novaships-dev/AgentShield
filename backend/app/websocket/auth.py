"""WebSocket authentication — JWT handshake."""
from __future__ import annotations
import asyncio
import logging
from fastapi import WebSocket
from app.models.user import User

logger = logging.getLogger(__name__)

_AUTH_TIMEOUT = 5.0  # seconds


async def authenticate_ws(websocket: WebSocket) -> User | None:
    """
    Wait for an auth message from the client within 5 seconds.
    Expected: {"type": "auth", "token": "eyJ..."}
    Returns User on success, None on failure (connection already closed).
    """
    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=_AUTH_TIMEOUT)
    except asyncio.TimeoutError:
        await _close(websocket, 4008, "Auth timeout")
        return None
    except Exception:
        return None

    if not isinstance(raw, dict) or raw.get("type") != "auth":
        await _close(websocket, 4001, "Expected auth message")
        return None

    token = raw.get("token", "")
    if not token:
        await _close(websocket, 4001, "Missing token")
        return None

    try:
        from app.middleware.auth import verify_jwt
        payload = verify_jwt(token)
        user_id = payload.get("sub")
        if not user_id:
            await _close(websocket, 4001, "Invalid token payload")
            return None

        from app.utils.supabase import get_supabase_client
        db = get_supabase_client()
        result = (
            db.table("users")
            .select("id,email,role,organization_id,organizations(id,name,plan,max_agents,max_requests,modules_enabled)")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            await _close(websocket, 4001, "User not found")
            return None

        from app.models.user import Organization
        udata = result.data
        odata = udata.get("organizations") or {}
        user = User(
            id=udata.get("id", user_id),
            email=udata.get("email", ""),
            role=udata.get("role", "member"),
            organization_id=udata.get("organization_id", ""),
            organization=Organization(
                id=odata.get("id", ""),
                name=odata.get("name", ""),
                plan=odata.get("plan", "free"),
                max_agents=odata.get("max_agents", 1),
                max_requests=odata.get("max_requests", 10000),
                modules_enabled=odata.get("modules_enabled", []),
            ),
        )
        # Confirm auth
        await websocket.send_json({"type": "auth_ok", "user_id": user.id})
        return user

    except Exception as exc:
        logger.warning(f"[ws] Auth failed: {exc}")
        await _close(websocket, 4001, "Authentication failed")
        return None


async def _close(websocket: WebSocket, code: int, reason: str) -> None:
    try:
        await websocket.close(code=code, reason=reason)
    except Exception:
        pass
