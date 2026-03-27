"""Anomaly detection service — z-score with exponential moving average baseline."""
from __future__ import annotations
import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Z-score thresholds (fixed, not user-configurable)
SPIKE_THRESHOLD = 3.0
DROP_THRESHOLD = -2.0
MIN_SAMPLES = 100  # learning phase

# EMA smoothing factor
ALPHA = 0.1


class AnomalyService:
    def __init__(self, db):
        self._db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check_for_anomaly(
        self,
        org_id: str,
        agent_id: str,
        metric: str,
        current_value: float,
    ) -> dict | None:
        """
        Check if current_value is anomalous vs the stored baseline.
        Returns anomaly dict or None if no anomaly / insufficient data.
        """
        now = datetime.now(timezone.utc)
        baseline = self._get_baseline(org_id, agent_id, metric, now.hour, now.weekday())

        if not baseline or baseline.get("sample_count", 0) < MIN_SAMPLES:
            return None  # still in learning phase

        stddev = baseline.get("stddev", 0.0)
        mean = baseline.get("mean", 0.0)

        if stddev == 0:
            return None  # perfectly constant — no variance to detect

        z = (current_value - mean) / stddev

        if z > SPIKE_THRESHOLD:
            multiplier = round(current_value / mean, 2) if mean > 0 else 0
            return {
                "type": "spike",
                "z_score": round(z, 3),
                "multiplier": multiplier,
                "current_value": current_value,
                "mean": mean,
                "stddev": stddev,
                "metric": metric,
            }
        elif z < DROP_THRESHOLD:
            return {
                "type": "drop",
                "z_score": round(z, 3),
                "multiplier": 0,
                "current_value": current_value,
                "mean": mean,
                "stddev": stddev,
                "metric": metric,
            }
        return None

    def update_baseline(
        self,
        org_id: str,
        agent_id: str,
        metric: str,
        current_value: float,
    ) -> None:
        """Update the EMA baseline for (org, agent, metric, hour, weekday)."""
        now = datetime.now(timezone.utc)
        hour = now.hour
        weekday = now.weekday()

        baseline = self._get_baseline(org_id, agent_id, metric, hour, weekday)

        if not baseline:
            # First data point — seed the baseline
            self._upsert_baseline(org_id, agent_id, metric, hour, weekday,
                                  mean=current_value, stddev=0.0, sample_count=1)
            return

        old_mean = baseline["mean"]
        old_stddev = baseline["stddev"]
        count = baseline["sample_count"] + 1

        new_mean = ALPHA * current_value + (1 - ALPHA) * old_mean
        new_stddev = math.sqrt(
            ALPHA * (current_value - new_mean) ** 2 + (1 - ALPHA) * old_stddev ** 2
        )

        self._upsert_baseline(org_id, agent_id, metric, hour, weekday,
                              mean=new_mean, stddev=new_stddev, sample_count=count)

    def get_current_metric_value(
        self,
        org_id: str,
        agent_id: str,
        metric: str,
    ) -> float:
        """Compute the current hourly value for a metric."""
        now = datetime.now(timezone.utc)
        hour_start = now.replace(minute=0, second=0, microsecond=0)

        if metric == "cost_hourly":
            result = (
                self._db.table("events")
                .select("cost_usd")
                .eq("organization_id", org_id)
                .eq("agent_id", agent_id)
                .gte("tracked_at", hour_start.isoformat())
                .execute()
            )
            return sum(e.get("cost_usd") or 0 for e in (result.data or []))

        elif metric == "requests_hourly":
            result = (
                self._db.table("events")
                .select("id", count="exact")
                .eq("organization_id", org_id)
                .eq("agent_id", agent_id)
                .gte("tracked_at", hour_start.isoformat())
                .execute()
            )
            return float(result.count or 0)

        elif metric == "error_rate_hourly":
            result = (
                self._db.table("events")
                .select("status")
                .eq("organization_id", org_id)
                .eq("agent_id", agent_id)
                .gte("tracked_at", hour_start.isoformat())
                .execute()
            )
            events = result.data or []
            if not events:
                return 0.0
            errors = sum(1 for e in events if e.get("status") == "error")
            return round(errors / len(events) * 100, 2)

        return 0.0

    def update_all_baselines_for_org(self, org_id: str) -> int:
        """Recalculate baselines for all active agents in an org. Called hourly."""
        agents_res = self._db.table("agents").select("id").eq("organization_id", org_id).eq("is_active", True).execute()
        agents = agents_res.data or []
        count = 0
        for agent in agents:
            agent_id = agent["id"]
            for metric in ("cost_hourly", "requests_hourly", "error_rate_hourly"):
                value = self.get_current_metric_value(org_id, agent_id, metric)
                self.update_baseline(org_id, agent_id, metric, value)
                count += 1
        return count

    # ------------------------------------------------------------------
    # Internal DB helpers
    # ------------------------------------------------------------------

    def _get_baseline(
        self, org_id: str, agent_id: str, metric: str, hour: int, weekday: int
    ) -> dict | None:
        result = (
            self._db.table("anomaly_baselines")
            .select("*")
            .eq("organization_id", org_id)
            .eq("agent_id", agent_id)
            .eq("metric", metric)
            .eq("hour_of_day", hour)
            .eq("day_of_week", weekday)
            .maybe_single()
            .execute()
        )
        return result.data

    def _upsert_baseline(
        self,
        org_id: str,
        agent_id: str,
        metric: str,
        hour: int,
        weekday: int,
        mean: float,
        stddev: float,
        sample_count: int,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._db.table("anomaly_baselines").upsert({
            "organization_id": org_id,
            "agent_id": agent_id,
            "metric": metric,
            "hour_of_day": hour,
            "day_of_week": weekday,
            "mean": mean,
            "stddev": stddev,
            "sample_count": sample_count,
            "updated_at": now,
        }, on_conflict="organization_id,agent_id,metric,hour_of_day,day_of_week").execute()
