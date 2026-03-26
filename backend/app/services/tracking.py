"""Tracking service — core event ingestion logic."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.models.user import Organization
from app.schemas.track import TrackEventRequest, TrackEventResponse
from app.services.pricing import PricingService, resolve_model, detect_provider
from app.middleware.plan_limits import check_plan_limits


class TrackingService:
    def __init__(self, db, redis):
        self._db = db
        self._redis = redis
        self._pricing = PricingService(redis=redis, db=db)

    async def track_event(self, org: Organization, request: TrackEventRequest) -> TrackEventResponse:
        warnings = []

        # 1. Resolve model alias
        model = resolve_model(request.model) if request.model else None

        # 2. Detect provider
        provider = request.provider
        if not provider and model:
            provider = detect_provider(model)
        if not provider:
            provider = "unknown"

        # 3. Calculate cost
        cost_usd = request.cost_usd
        if cost_usd is None and model and request.input_tokens is not None and request.output_tokens is not None:
            cost_decimal = await self._pricing.calculate_cost(
                provider, model, request.input_tokens, request.output_tokens
            )
            if cost_decimal is not None:
                cost_usd = float(cost_decimal)
            else:
                warnings.append(
                    f"Unknown model '{model}'. Cost could not be auto-calculated. "
                    "Provide cost_usd manually or contact support to add this model."
                )
        elif cost_usd is None and model:
            warnings.append(
                f"Unknown model '{model}'. Cost could not be auto-calculated. "
                "Provide cost_usd manually or contact support to add this model."
            )

        # 4. Auto-create agent if needed
        agent_id = await self._get_or_create_agent(org, request.agent)

        # 5. Compute totals
        total_tokens = (request.input_tokens or 0) + (request.output_tokens or 0)

        # 6. PII redaction — before storing, redact both input and output
        from app.services.pii import PIIRedactionService
        pii_svc = PIIRedactionService(db=self._db, redis=self._redis)

        input_redacted, input_pii = await pii_svc.redact(org.id, request.input_text)
        output_redacted, output_pii = await pii_svc.redact(org.id, request.output_text)

        # Merge detected types (dedup)
        pii_detected = list({*input_pii, *output_pii})

        # store_original=false (default): null out raw text
        store_original = False  # Sprint 5 will expose this as a config option

        # 7. Insert event
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        event_data = {
            "id": event_id,
            "organization_id": org.id,
            "agent_id": agent_id,
            "model": model,
            "provider": provider,
            "input_tokens": request.input_tokens or 0,
            "output_tokens": request.output_tokens or 0,
            "total_tokens": total_tokens,
            "cost_usd": cost_usd,
            "session_id": request.session_id,
            "step": request.step,
            "step_name": request.step_name,
            "status": request.status,
            "duration_ms": request.duration_ms,
            "workflow": request.workflow,
            "user_label": request.user_label,
            "team_label": request.team_label,
            "metadata": request.metadata,
            "input_text": request.input_text if store_original else None,
            "output_text": request.output_text if store_original else None,
            "input_redacted": input_redacted,
            "output_redacted": output_redacted,
            "pii_detected": pii_detected,
            "tracked_at": now,
        }
        self._db.table("events").insert(event_data).execute()

        # 8. UPSERT session if session_id provided
        if request.session_id:
            from app.services.sessions import SessionService
            session_svc = SessionService(db=self._db, redis=self._redis)
            await session_svc.upsert_session(
                org_id=org.id,
                session_id=request.session_id,
                agent_id=agent_id,
                cost_usd=cost_usd,
                tokens=total_tokens,
                status=request.status,
            )

        # 9. Publish to WebSocket channel for real-time dashboard updates
        await self._publish_ws_event(
            org_id=org.id,
            event_id=event_id,
            agent_name=request.agent,
            model=model or "",
            cost_usd=cost_usd or 0.0,
            status=request.status,
            tracked_at=now,
            session_id=request.session_id,
        )

        return TrackEventResponse(
            event_id=uuid.UUID(event_id),
            agent=request.agent,
            cost_usd=cost_usd,
            budget_remaining_usd=None,  # Sprint 4
            budget_status="ok",
            guardrail_violations=[],  # Sprint 5
            pii_detected=pii_detected,
            warnings=warnings,
        )

    async def _publish_ws_event(
        self,
        org_id: str,
        event_id: str,
        agent_name: str,
        model: str,
        cost_usd: float,
        status: str,
        tracked_at: str,
        session_id: str | None,
    ) -> None:
        """Publish event to Redis Pub/Sub for WebSocket fan-out. Fire-and-forget."""
        import json
        channel = f"ws:{org_id}"
        payload = json.dumps({
            "type": "new_event",
            "data": {
                "event_id": event_id,
                "agent": agent_name,
                "model": model,
                "cost_usd": float(cost_usd),
                "status": status,
                "tracked_at": tracked_at,
            },
        })
        try:
            await self._redis.publish(channel, payload)
        except Exception:
            pass  # WebSocket publish is non-critical

        if session_id:
            # Publish session update as well (cost TBD — simplified for now)
            session_payload = json.dumps({
                "type": "session_update",
                "data": {
                    "session_id": session_id,
                    "status": "running",
                },
            })
            try:
                await self._redis.publish(channel, session_payload)
            except Exception:
                pass

    async def _get_or_create_agent(self, org: Organization, agent_name: str) -> str:
        """Return existing agent ID or create a new one."""
        result = self._db.table("agents").select("id").eq("organization_id", org.id).eq("name", agent_name).maybe_single().execute()
        if result.data:
            return result.data["id"]
        # Check plan limit before creating
        await check_plan_limits(org, "create_agent")
        agent_id = str(uuid.uuid4())
        self._db.table("agents").insert({
            "id": agent_id,
            "organization_id": org.id,
            "name": agent_name,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return agent_id
