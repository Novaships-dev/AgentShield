"""Cost Autopilot — model recommendations via Claude API."""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

REDIS_TTL = 7 * 24 * 3600  # 7 days


class RecommendationService:
    def __init__(self, db, redis=None):
        self._db = db
        self._redis = redis

    async def get_recommendations(self, org_id: str) -> list[dict]:
        """Return cached recommendations for the org."""
        if self._redis:
            try:
                cached = await self._redis.get(f"recommendations:{org_id}")
                if cached:
                    return json.loads(cached)
            except Exception:
                pass
        return []

    def compute_and_cache_sync(self, org_id: str) -> list[dict]:
        """Compute recommendations synchronously (used by Celery task)."""
        import asyncio

        # Gather last 7 days of events, grouped by agent + model
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        result = (
            self._db.table("events")
            .select("agent_id, model, cost_usd, total_tokens, status")
            .eq("organization_id", org_id)
            .gte("tracked_at", since)
            .execute()
        )
        events = result.data or []

        if not events:
            return []

        # Group by (agent_id, model)
        groups: dict[tuple, dict] = {}
        for e in events:
            key = (e.get("agent_id", ""), e.get("model", ""))
            if key not in groups:
                groups[key] = {"costs": [], "tokens": [], "errors": 0, "count": 0}
            g = groups[key]
            g["count"] += 1
            g["costs"].append(e.get("cost_usd") or 0)
            g["tokens"].append(e.get("total_tokens") or 0)
            if e.get("status") == "error":
                g["errors"] += 1

        # Build context for Claude
        context_rows = []
        agent_names: dict[str, str] = {}
        for (agent_id, model), g in groups.items():
            if not model or g["count"] < 5:
                continue
            avg_cost = sum(g["costs"]) / len(g["costs"])
            avg_tokens = sum(g["tokens"]) / len(g["tokens"])
            error_rate = g["errors"] / g["count"] * 100

            if agent_id and agent_id not in agent_names:
                agent_res = self._db.table("agents").select("name").eq("id", agent_id).maybe_single().execute()
                if agent_res.data:
                    agent_names[agent_id] = agent_res.data["name"]

            context_rows.append({
                "agent": agent_names.get(agent_id, agent_id),
                "model": model,
                "call_count": g["count"],
                "avg_cost_usd": round(avg_cost, 6),
                "avg_tokens": int(avg_tokens),
                "error_rate_pct": round(error_rate, 1),
            })

        if not context_rows:
            return []

        from app.services.claude import call_claude
        system = """You are an AI cost optimization expert. Analyze the usage data and recommend cheaper models where appropriate.
Respond ONLY with a valid JSON array. Each item:
{
  "agent": "agent name",
  "current_model": "gpt-4o",
  "suggested_model": "gpt-4o-mini",
  "reasoning": "Most calls are simple classification tasks that don't require GPT-4o quality.",
  "estimated_savings_pct": 68
}
Only suggest models that are known to be cheaper and capable. If no change is needed, return an empty array []."""

        user_msg = f"Usage data (last 7 days):\n{json.dumps(context_rows, indent=2)}"
        result = call_claude(system, user_msg)

        # Claude should return a list; handle both list and dict
        if isinstance(result, list):
            recs = result
        elif isinstance(result, dict) and "recommendations" in result:
            recs = result["recommendations"]
        else:
            recs = []

        # Cache in Redis
        if self._redis:
            try:
                asyncio.get_event_loop().run_until_complete(
                    self._redis.setex(f"recommendations:{org_id}", REDIS_TTL, json.dumps(recs))
                )
            except Exception:
                pass

        return recs
