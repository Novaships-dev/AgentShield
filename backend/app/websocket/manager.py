"""WebSocket connection manager with Redis Pub/Sub fan-out."""
from __future__ import annotations
import asyncio
import json
import logging
from collections import defaultdict
from fastapi import WebSocket

logger = logging.getLogger(__name__)

_PING_INTERVAL = 30  # seconds
_PONG_TIMEOUT = 10   # seconds


class ConnectionManager:
    def __init__(self):
        # org_id → set of connected WebSocket objects
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._listener_tasks: dict[str, asyncio.Task] = {}
        self._redis = None

    def _get_redis(self):
        if self._redis is None:
            from app.utils.redis import get_redis_client
            self._redis = get_redis_client()
        return self._redis

    async def connect(self, websocket: WebSocket, org_id: str) -> None:
        self._connections[org_id].add(websocket)
        # Start Redis listener for this org if not already running
        if org_id not in self._listener_tasks or self._listener_tasks[org_id].done():
            task = asyncio.create_task(self._redis_listener(org_id))
            self._listener_tasks[org_id] = task

    def disconnect(self, websocket: WebSocket, org_id: str) -> None:
        self._connections[org_id].discard(websocket)
        if not self._connections[org_id]:
            # Cancel listener when no connections remain
            task = self._listener_tasks.pop(org_id, None)
            if task and not task.done():
                task.cancel()

    async def broadcast(self, org_id: str, message: dict) -> None:
        """Send a message to all WebSocket connections for an org."""
        sockets = list(self._connections.get(org_id, set()))
        if not sockets:
            return
        payload = json.dumps(message)
        dead = set()
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[org_id].discard(ws)

    async def _redis_listener(self, org_id: str) -> None:
        """Subscribe to Redis channel ws:{org_id} and broadcast incoming messages."""
        channel = f"ws:{org_id}"
        redis = self._get_redis()
        try:
            pubsub = redis.pubsub()
            await pubsub.subscribe(channel)
            logger.info(f"[ws] Subscribed to Redis channel {channel}")
            async for raw in pubsub.listen():
                if raw["type"] != "message":
                    continue
                try:
                    data = json.loads(raw["data"])
                except (json.JSONDecodeError, TypeError):
                    continue
                await self.broadcast(org_id, data)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error(f"[ws] Redis listener error for org {org_id}: {exc}")
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                pass


# Global singleton
manager = ConnectionManager()
