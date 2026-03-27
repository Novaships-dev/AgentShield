# SKILL-WEBSOCKET.md — Comment gérer le WebSocket dans AgentShield

> Lire AVANT de toucher au WebSocket backend ou frontend. Réfs : ARCH.md (section 4.6), API.md (section 32)

---

## ARCHITECTURE

```
Frontend (useWebSocket hook)
    ↕ WebSocket (wss://api.agentshield.one/ws/dashboard)
Backend (FastAPI WebSocket endpoint)
    ↕ Redis Pub/Sub (channel ws:{org_id})
Celery workers / API endpoints (publishers)
```

## BACKEND — ENDPOINT

```python
# app/api/v1/ws.py

from fastapi import WebSocket, WebSocketDisconnect
from app.websocket.manager import ConnectionManager
from app.websocket.auth import authenticate_ws

manager = ConnectionManager()

@router.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # 1. Auth (5s timeout)
    user = await authenticate_ws(websocket)
    if not user:
        return

    # 2. Subscribe
    org_id = user.organization_id
    await manager.connect(websocket, org_id)

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "pong":
                continue  # Heartbeat response
    except WebSocketDisconnect:
        manager.disconnect(websocket, org_id)
```

## CONNECTION MANAGER

```python
# app/websocket/manager.py

class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}  # org_id → [websockets]
        self._redis_subscriber = None

    async def connect(self, ws: WebSocket, org_id: str):
        if org_id not in self._connections:
            self._connections[org_id] = []
            await self._subscribe_redis(org_id)
        self._connections[org_id].append(ws)

    def disconnect(self, ws: WebSocket, org_id: str):
        self._connections.get(org_id, []).remove(ws)

    async def broadcast(self, org_id: str, message: dict):
        for ws in self._connections.get(org_id, []):
            try:
                await ws.send_json(message)
            except:
                self.disconnect(ws, org_id)

    async def _subscribe_redis(self, org_id: str):
        """Subscribe to Redis Pub/Sub for this org."""
        # Écouter le channel ws:{org_id}
        # Quand un message arrive → broadcast à tous les WS de cet org
```

## PUBLIER UN EVENT

```python
# Depuis n'importe où dans le backend (API endpoint ou Celery task)

async def publish_ws(org_id: str, event: dict):
    """Publish an event to all WebSocket clients of this org."""
    await redis.publish(f"ws:{org_id}", json.dumps(event))

# Usage
await publish_ws(org_id, {"type": "new_event", "data": {"agent": "support", "cost_usd": 0.034}})
await publish_ws(org_id, {"type": "alert_fired", "data": {...}})
await publish_ws(org_id, {"type": "budget_frozen", "data": {...}})
```

## FRONTEND — HOOK

```typescript
// hooks/useWebSocket.ts

export function useWebSocket(eventType: string, handler: (data: any) => void) {
  const ws = useContext(WebSocketContext);

  useEffect(() => {
    if (!ws) return;
    const listener = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === eventType) {
        handler(msg.data);
      }
    };
    ws.addEventListener("message", listener);
    return () => ws.removeEventListener("message", listener);
  }, [ws, eventType, handler]);
}
```

## RECONNECTION

```typescript
// Exponential backoff : 1s, 2s, 4s, 8s, 16s, max 30s
// Fallback polling : si WS échoue 5 fois → passer en polling /v1/analytics toutes les 5s
// Heartbeat : ping toutes les 30s, reconnect si pas de pong en 10s
```

## EVENT TYPES

```
new_event, alert_fired, smart_alert, anomaly,
budget_warning, budget_frozen, session_update,
violation, pii_detected, report_ready, ping
```

## RÈGLES

```
1. Auth JWT dans le premier message, PAS dans l'URL
2. Timeout 5s pour l'auth, sinon close(4001)
3. Heartbeat 30s pour garder la connexion
4. Redis Pub/Sub pour l'isolation par org (chaque org a son channel)
5. Reconnection auto côté client avec backoff
6. Max 1000 connexions par instance backend
7. Les events WS ne contiennent PAS de données PII brutes
```
