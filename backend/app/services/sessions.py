"""Session service — UPSERT sessions from tracking events."""
from __future__ import annotations

import json
from datetime import datetime, timezone

_SESSION_TTL = 3600  # 1 hour Redis cache TTL


class SessionService:
    def __init__(self, db, redis):
        self._db = db
        self._redis = redis

    async def upsert_session(
        self,
        org_id: str,
        session_id: str,
        agent_id: str,
        cost_usd: float | None,
        tokens: int,
        status: str,
    ) -> None:
        """UPSERT a session row, incrementing step count and accumulating totals.

        On INSERT: creates a new session with started_at=now(), status='running'.
        On CONFLICT: increments total_steps, accumulates cost and tokens,
        updates status to 'error' if new status is 'error', updates ended_at.
        """
        now = datetime.now(timezone.utc).isoformat()
        cost_value = cost_usd or 0.0

        # Try to fetch existing session
        existing = (
            self._db.table("sessions")
            .select("id,total_steps,total_cost_usd,total_tokens,status,agent_ids")
            .eq("organization_id", org_id)
            .eq("session_id", session_id)
            .maybe_single()
            .execute()
        )

        if existing.data:
            row = existing.data
            new_steps = (row.get("total_steps") or 0) + 1
            new_cost = float(row.get("total_cost_usd") or 0) + cost_value
            new_tokens = (row.get("total_tokens") or 0) + tokens
            new_status = "error" if status == "error" else row.get("status", "running")

            # Append agent_id to list if not already present
            agent_ids = row.get("agent_ids") or []
            if agent_id not in agent_ids:
                agent_ids = agent_ids + [agent_id]

            self._db.table("sessions").update({
                "total_steps": new_steps,
                "total_cost_usd": new_cost,
                "total_tokens": new_tokens,
                "status": new_status,
                "agent_ids": agent_ids,
                "ended_at": now,
            }).eq("organization_id", org_id).eq("session_id", session_id).execute()

            session_data = {
                "session_id": session_id,
                "organization_id": org_id,
                "total_steps": new_steps,
                "total_cost_usd": new_cost,
                "total_tokens": new_tokens,
                "status": new_status,
                "agent_ids": agent_ids,
                "ended_at": now,
            }
        else:
            agent_ids = [agent_id]
            self._db.table("sessions").insert({
                "organization_id": org_id,
                "session_id": session_id,
                "agent_ids": agent_ids,
                "total_steps": 1,
                "total_cost_usd": cost_value,
                "total_tokens": tokens,
                "status": "running",
                "started_at": now,
                "ended_at": now,
            }).execute()

            session_data = {
                "session_id": session_id,
                "organization_id": org_id,
                "total_steps": 1,
                "total_cost_usd": cost_value,
                "total_tokens": tokens,
                "status": "running",
                "agent_ids": agent_ids,
                "started_at": now,
                "ended_at": now,
            }

        # Update Redis cache
        cache_key = f"session:{org_id}:{session_id}"
        await self._redis.set(cache_key, json.dumps(session_data), ex=_SESSION_TTL)
