"""Budget caps service — Redis counters, freeze logic, warning thresholds."""
from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

WARNING_THRESHOLD = 0.80  # 80%


class BudgetService:
    def __init__(self, db, redis=None):
        self._db = db
        self._redis = redis

    # ------------------------------------------------------------------
    # Budget CRUD
    # ------------------------------------------------------------------

    def create_budget(self, org_id: str, data: dict) -> dict:
        budget_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        budget = {
            "id": budget_id,
            "organization_id": org_id,
            "agent_id": str(data["agent_id"]) if data.get("agent_id") else None,
            "max_usd": data["max_usd"],
            "period": data.get("period", "monthly"),
            "action": data.get("action", "freeze"),
            "is_active": True,
            "created_at": now,
        }
        self._db.table("budget_caps").insert(budget).execute()
        return self._enrich_budget(budget)

    def list_budgets(self, org_id: str) -> list[dict]:
        result = self._db.table("budget_caps").select("*").eq("organization_id", org_id).eq("is_active", True).execute()
        return [self._enrich_budget(b) for b in (result.data or [])]

    def delete_budget(self, org_id: str, budget_id: str) -> bool:
        result = self._db.table("budget_caps").select("*").eq("id", budget_id).eq("organization_id", org_id).maybe_single().execute()
        if not result.data:
            return False
        budget = result.data
        # Unfreeze agent if needed
        if budget.get("agent_id") and budget.get("action") == "freeze":
            self._db.table("agents").update({"is_frozen": False}).eq("id", budget["agent_id"]).execute()
        self._db.table("budget_caps").delete().eq("id", budget_id).execute()
        return True

    # ------------------------------------------------------------------
    # Budget check (called synchronously in POST /v1/track)
    # ------------------------------------------------------------------

    async def check_budget(self, org_id: str, agent_id: str) -> dict:
        """
        Check budget cap for the given agent.
        Returns: {status: 'ok'|'warning'|'exceeded'|'frozen', remaining_usd, budget_cap}
        Raises AgentFrozenError if already frozen.
        Raises BudgetExceededError if over cap with action=freeze.
        """
        from app.utils.errors import AgentFrozenError, BudgetExceededError

        # 1. Check Redis frozen flag (fastest check, < 1ms)
        if self._redis:
            frozen = await self._redis.get(f"frozen:{org_id}:{agent_id}")
            if frozen:
                raise AgentFrozenError(
                    f"Agent '{agent_id}' is frozen (kill switch active). Disable kill switch to resume tracking.",
                    code="agent_frozen",
                )

        # 2. Find applicable budget caps (agent-specific first, then org-wide)
        caps = self._get_applicable_caps(org_id, agent_id)
        if not caps:
            return {"status": "ok", "remaining_usd": None, "budget_cap": None}

        # Use the most restrictive (lowest max_usd) cap
        cap = min(caps, key=lambda c: c["max_usd"])
        current_usd = await self._get_counter(org_id, agent_id, cap["period"])

        percentage = (current_usd / cap["max_usd"] * 100) if cap["max_usd"] > 0 else 0
        remaining = max(0.0, cap["max_usd"] - current_usd)

        if percentage >= 100:
            if cap["action"] == "freeze":
                # Set frozen flag in Redis
                if self._redis:
                    await self._redis.set(f"frozen:{org_id}:{agent_id}", "1")
                # Update agent in DB
                self._db.table("agents").update({"is_frozen": True}).eq("id", agent_id).execute()
                raise BudgetExceededError(
                    f"Budget exceeded for agent '{agent_id}': ${current_usd:.4f}/${cap['max_usd']:.4f} ({cap['period']}). Agent is frozen.",
                    code="budget_exceeded",
                )
            return {
                "status": "exceeded",
                "remaining_usd": 0.0,
                "budget_cap": cap,
                "percentage": round(percentage, 1),
            }

        if percentage >= WARNING_THRESHOLD * 100:
            return {
                "status": "warning",
                "remaining_usd": round(remaining, 4),
                "budget_cap": cap,
                "percentage": round(percentage, 1),
            }

        return {
            "status": "ok",
            "remaining_usd": round(remaining, 4),
            "budget_cap": cap,
            "percentage": round(percentage, 1),
        }

    async def increment_counter(self, org_id: str, agent_id: str, cost_usd: float) -> None:
        """Increment Redis budget counters for all applicable caps."""
        caps = self._get_applicable_caps(org_id, agent_id)
        for cap in caps:
            key = self._counter_key(org_id, agent_id, cap["period"])
            if self._redis:
                await self._redis.incrbyfloat(key, cost_usd)
                # Set TTL if not already set (monthly = ~35 days, daily = ~2 days)
                ttl = 35 * 24 * 3600 if cap["period"] == "monthly" else 2 * 24 * 3600
                await self._redis.expire(key, ttl)

    # ------------------------------------------------------------------
    # Freeze / unfreeze (kill switch integration)
    # ------------------------------------------------------------------

    async def freeze_agent(self, org_id: str, agent_id: str, reason: str = "budget") -> None:
        if self._redis:
            await self._redis.set(f"frozen:{org_id}:{agent_id}", reason)
        self._db.table("agents").update({"is_frozen": True}).eq("id", agent_id).execute()

    async def unfreeze_agent(self, org_id: str, agent_id: str) -> None:
        if self._redis:
            await self._redis.delete(f"frozen:{org_id}:{agent_id}")
        self._db.table("agents").update({"is_frozen": False}).eq("id", agent_id).execute()

    async def is_frozen(self, org_id: str, agent_id: str) -> bool:
        if self._redis:
            val = await self._redis.get(f"frozen:{org_id}:{agent_id}")
            return bool(val)
        # Fallback to DB
        result = self._db.table("agents").select("is_frozen").eq("id", agent_id).maybe_single().execute()
        return bool(result.data and result.data.get("is_frozen"))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_applicable_caps(self, org_id: str, agent_id: str) -> list[dict]:
        """Return caps that apply: agent-specific + org-wide (agent_id=null)."""
        result = (
            self._db.table("budget_caps")
            .select("*")
            .eq("organization_id", org_id)
            .eq("is_active", True)
            .execute()
        )
        caps = result.data or []
        return [c for c in caps if c.get("agent_id") in (None, agent_id)]

    def _counter_key(self, org_id: str, agent_id: str, period: str) -> str:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        if period == "monthly":
            suffix = f"{now.year}-{now.month:02d}"
        elif period == "weekly":
            suffix = f"{now.year}-W{now.isocalendar()[1]:02d}"
        else:  # daily
            suffix = now.strftime("%Y-%m-%d")
        return f"budget:{org_id}:{agent_id}:{period}:{suffix}"

    async def _get_counter(self, org_id: str, agent_id: str, period: str) -> float:
        key = self._counter_key(org_id, agent_id, period)
        if self._redis:
            val = await self._redis.get(key)
            return float(val) if val else 0.0
        return 0.0

    def _enrich_budget(self, budget: dict) -> dict:
        agent_name = None
        if budget.get("agent_id"):
            res = self._db.table("agents").select("name").eq("id", budget["agent_id"]).maybe_single().execute()
            if res.data:
                agent_name = res.data["name"]
        # current_usd from DB events (fallback when Redis not available)
        return {
            **budget,
            "agent_name": agent_name,
            "current_usd": 0.0,
            "percentage": 0.0,
            "is_frozen": False,
        }
