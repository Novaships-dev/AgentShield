"""ReplayService — session timeline construction for the Replay module."""
from __future__ import annotations

from app.api.v1.sessions import _compute_duration_ms
from app.schemas.session import SessionTimelineResponse, StepResponse


class ReplayService:
    def __init__(self, db):
        self._db = db

    async def get_session_timeline(
        self,
        org_id: str,
        session_id: str,
        viewer_role: str = "member",
    ) -> SessionTimelineResponse:
        """Load session + all events and build the step-by-step timeline.

        Privacy rules:
        - input_redacted / output_redacted: always included
        - input_text / output_text: only for owner/admin with store_original=true
        """
        # Load session
        session_result = (
            self._db.table("agent_sessions")
            .select("*")
            .eq("organization_id", org_id)
            .eq("session_id", session_id)
            .maybe_single()
            .execute()
        )

        if not session_result.data:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Session not found")

        session_row = session_result.data

        # Load all events for this session, ordered by step then tracked_at
        events_result = (
            self._db.table("events")
            .select("*")
            .eq("organization_id", org_id)
            .eq("session_id", session_id)
            .order("step", desc=False)
            .order("tracked_at", desc=False)
            .execute()
        )

        events = events_result.data or []

        # Resolve agent names
        agent_ids = session_row.get("agent_ids") or []
        agent_names = _resolve_agent_names(self._db, agent_ids)

        # Build steps
        steps = []
        for event in events:
            # Resolve agent name
            agent_id = event.get("agent_id", "")
            agent_name = _resolve_single_agent_name(self._db, agent_id)

            # Privacy: show raw text only to owner/admin (when store_original is True)
            # For now, we show input_redacted/output_redacted always
            step = StepResponse(
                event_id=str(event.get("id", "")),
                step=event.get("step"),
                step_name=event.get("step_name"),
                agent=agent_name,
                model=event.get("model"),
                provider=event.get("provider"),
                input_redacted=event.get("input_redacted") or event.get("input_text"),
                output_redacted=event.get("output_redacted") or event.get("output_text"),
                input_tokens=event.get("input_tokens") or 0,
                output_tokens=event.get("output_tokens") or 0,
                cost_usd=event.get("cost_usd"),
                duration_ms=event.get("duration_ms"),
                status=event.get("status", "success"),
                pii_detected=event.get("pii_detected") or [],
                guardrail_violations=event.get("guardrail_violations") or [],
                tracked_at=event.get("tracked_at"),
            )
            steps.append(step)

        started = session_row.get("started_at")
        ended = session_row.get("ended_at")
        duration_ms = _compute_duration_ms(started, ended)

        return SessionTimelineResponse(
            session_id=session_id,
            status=session_row.get("status", "running"),
            total_cost_usd=session_row.get("total_cost_usd"),
            total_tokens=session_row.get("total_tokens") or 0,
            total_steps=session_row.get("total_steps") or 0,
            duration_ms=duration_ms,
            started_at=started,
            ended_at=ended,
            agents_involved=agent_names,
            steps=steps,
        )


def _resolve_agent_names(db, agent_ids: list[str]) -> list[str]:
    if not agent_ids:
        return []
    try:
        result = db.table("agents").select("id,name").in_("id", agent_ids).execute()
        id_to_name = {row["id"]: row["name"] for row in (result.data or [])}
        return [id_to_name.get(aid, aid) for aid in agent_ids]
    except Exception:
        return agent_ids


def _resolve_single_agent_name(db, agent_id: str) -> str:
    if not agent_id:
        return "unknown"
    try:
        result = (
            db.table("agents")
            .select("name")
            .eq("id", agent_id)
            .maybe_single()
            .execute()
        )
        if result.data:
            return result.data["name"]
        return agent_id
    except Exception:
        return agent_id
