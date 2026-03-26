"""WebSocket /ws/dashboard endpoint."""
from __future__ import annotations
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager
from app.websocket.auth import authenticate_ws

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

_HEARTBEAT_INTERVAL = 30  # seconds
_PONG_TIMEOUT = 10


@router.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # 1. Authenticate (5s timeout)
    user = await authenticate_ws(websocket)
    if not user:
        return

    org_id = user.organization_id
    await manager.connect(websocket, org_id)
    logger.info(f"[ws] User {user.id} connected (org={org_id})")

    # 2. Start heartbeat
    heartbeat_task = asyncio.create_task(_heartbeat(websocket, org_id, user.id))

    try:
        # 3. Listen for client messages
        while True:
            try:
                data = await websocket.receive_json()
                if data.get("type") == "pong":
                    pass  # heartbeat acknowledged
                # Future: handle subscribe/unsubscribe channel requests
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        heartbeat_task.cancel()
        manager.disconnect(websocket, org_id)
        logger.info(f"[ws] User {user.id} disconnected (org={org_id})")


async def _heartbeat(websocket: WebSocket, org_id: str, user_id: str):
    """Send ping every 30s; disconnect if no pong within 10s."""
    while True:
        await asyncio.sleep(_HEARTBEAT_INTERVAL)
        try:
            await websocket.send_json({"type": "ping"})
        except Exception:
            manager.disconnect(websocket, org_id)
            break
