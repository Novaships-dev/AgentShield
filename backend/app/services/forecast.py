"""Forecast service — linear regression on daily costs to project EOM spend."""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone, timedelta
import calendar

logger = logging.getLogger(__name__)

CONFIDENCE_PCT = 0.15  # ±15%
REDIS_TTL = 3600  # 1 hour cache
MIN_DAYS = 3


class ForecastService:
    def __init__(self, db, redis=None):
        self._db = db
        self._redis = redis

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_forecast(self, org_id: str) -> dict:
        """Return cached forecast or compute on-the-fly."""
        if self._redis:
            try:
                cached = await self._redis.get(f"forecast:{org_id}")
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        result = self._compute_forecast(org_id)

        if self._redis:
            try:
                await self._redis.setex(f"forecast:{org_id}", REDIS_TTL, json.dumps(result))
            except Exception:
                pass

        return result

    def compute_and_cache(self, org_id: str) -> dict:
        """Compute forecast synchronously (used by Celery task)."""
        return self._compute_forecast(org_id)

    # ------------------------------------------------------------------
    # Internal computation
    # ------------------------------------------------------------------

    def _compute_forecast(self, org_id: str) -> dict:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        days_elapsed = (now - month_start).days + 1
        days_remaining = days_in_month - days_elapsed

        # Fetch daily costs for this month
        daily_costs = self._get_daily_costs(org_id, month_start, now)
        total_so_far = sum(c for c in daily_costs.values())

        if len(daily_costs) < MIN_DAYS:
            return {
                "organization": {
                    "projected_eom_usd": None,
                    "confidence_low": None,
                    "confidence_high": None,
                    "current_month_usd": round(total_so_far, 4),
                    "days_elapsed": days_elapsed,
                    "days_remaining": days_remaining,
                    "insufficient_data": True,
                    "calculated_at": now.isoformat(),
                },
                "by_agent": [],
            }

        # Linear regression on daily costs
        projected_eom = self._linear_regression_projection(daily_costs, days_in_month)
        projected_eom = max(projected_eom, total_so_far)

        confidence_low = round(projected_eom * (1 - CONFIDENCE_PCT), 4)
        confidence_high = round(projected_eom * (1 + CONFIDENCE_PCT), 4)

        # Per-agent breakdown
        by_agent = self._get_agent_breakdown(org_id, month_start, now, projected_eom)

        return {
            "organization": {
                "projected_eom_usd": round(projected_eom, 4),
                "confidence_low": confidence_low,
                "confidence_high": confidence_high,
                "current_month_usd": round(total_so_far, 4),
                "days_elapsed": days_elapsed,
                "days_remaining": days_remaining,
                "insufficient_data": False,
                "calculated_at": now.isoformat(),
            },
            "by_agent": by_agent,
        }

    def _get_daily_costs(self, org_id: str, start: datetime, end: datetime) -> dict[int, float]:
        """Return {day_of_month: cost} for the given period."""
        result = (
            self._db.table("events")
            .select("cost_usd, tracked_at")
            .eq("organization_id", org_id)
            .gte("tracked_at", start.isoformat())
            .lte("tracked_at", end.isoformat())
            .execute()
        )
        daily: dict[int, float] = {}
        for event in (result.data or []):
            if not event.get("tracked_at") or not event.get("cost_usd"):
                continue
            try:
                day = datetime.fromisoformat(event["tracked_at"].replace("Z", "+00:00")).day
            except Exception:
                continue
            daily[day] = daily.get(day, 0) + (event["cost_usd"] or 0)
        return daily

    def _linear_regression_projection(self, daily_costs: dict[int, float], days_in_month: int) -> float:
        """
        Fit y = mx + b on (day, cost) pairs and project total for the month.
        Falls back to simple average if regression fails.
        """
        days = sorted(daily_costs.keys())
        costs = [daily_costs[d] for d in days]
        n = len(days)

        if n < 2:
            # Single data point — simple average
            avg = sum(costs) / n
            return avg * days_in_month

        sum_x = sum(days)
        sum_y = sum(costs)
        sum_xy = sum(d * c for d, c in zip(days, costs))
        sum_x2 = sum(d * d for d in days)

        denom = n * sum_x2 - sum_x ** 2
        if denom == 0:
            avg = sum_y / n
            return avg * days_in_month

        m = (n * sum_xy - sum_x * sum_y) / denom
        b = (sum_y - m * sum_x) / n

        # Sum projected cost for each day of the month
        projected_total = 0.0
        for day in range(1, days_in_month + 1):
            if day in daily_costs:
                projected_total += daily_costs[day]
            else:
                projected_total += max(0, m * day + b)

        return projected_total

    def _get_agent_breakdown(
        self, org_id: str, start: datetime, end: datetime, projected_total: float
    ) -> list[dict]:
        result = (
            self._db.table("events")
            .select("agent_id, cost_usd")
            .eq("organization_id", org_id)
            .gte("tracked_at", start.isoformat())
            .lte("tracked_at", end.isoformat())
            .execute()
        )
        agent_costs: dict[str, float] = {}
        for event in (result.data or []):
            aid = event.get("agent_id")
            if aid:
                agent_costs[aid] = agent_costs.get(aid, 0) + (event.get("cost_usd") or 0)

        total_actual = sum(agent_costs.values()) or 1.0
        breakdown = []
        for agent_id, cost in sorted(agent_costs.items(), key=lambda x: x[1], reverse=True):
            # Resolve agent name
            agent_res = self._db.table("agents").select("name").eq("id", agent_id).maybe_single().execute()
            agent_name = agent_res.data["name"] if agent_res.data else agent_id

            pct = cost / total_actual
            projected_agent = round(projected_total * pct, 4)

            breakdown.append({
                "agent_id": agent_id,
                "agent_name": agent_name,
                "projected_eom_usd": projected_agent,
                "pct_of_total": round(pct * 100, 1),
            })

        return breakdown
