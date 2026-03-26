"""Aggregation service — compute hourly/daily rollups from raw events."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from collections import defaultdict


class AggregationService:
    def __init__(self, db):
        self._db = db

    def compute_hourly(self) -> int:
        """Aggregate events from the last 2 hours into aggregations_hourly. Returns rows upserted."""
        now = datetime.now(timezone.utc)
        since = (now - timedelta(hours=2)).isoformat()

        events = (
            self._db.table("events")
            .select("organization_id,agent_id,provider,model,tracked_at,total_tokens,cost_usd,status")
            .gte("tracked_at", since)
            .execute()
            .data or []
        )

        return self._upsert_buckets(events, granularity="hour", table="aggregations_hourly")

    def compute_daily(self) -> int:
        """Aggregate yesterday's events into aggregations_daily. Returns rows upserted."""
        now = datetime.now(timezone.utc)
        yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_end = yesterday_start.replace(hour=23, minute=59, second=59)

        events = (
            self._db.table("events")
            .select("organization_id,agent_id,provider,model,tracked_at,total_tokens,cost_usd,status")
            .gte("tracked_at", yesterday_start.isoformat())
            .lte("tracked_at", yesterday_end.isoformat())
            .execute()
            .data or []
        )

        return self._upsert_buckets(events, granularity="day", table="aggregations_daily")

    def _upsert_buckets(self, events: list[dict], granularity: str, table: str) -> int:
        buckets: dict[tuple, dict] = defaultdict(lambda: {
            "request_count": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "error_count": 0,
        })

        for e in events:
            ts_raw = e.get("tracked_at", "")
            try:
                dt = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                if granularity == "hour":
                    bucket_ts = dt.replace(minute=0, second=0, microsecond=0).isoformat()
                else:
                    bucket_ts = dt.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            except (ValueError, AttributeError):
                continue

            key = (
                e.get("organization_id", ""),
                e.get("agent_id") or "",
                e.get("provider") or "unknown",
                e.get("model") or "unknown",
                bucket_ts,
            )
            b = buckets[key]
            b["request_count"] += 1
            b["total_tokens"] += int(e.get("total_tokens") or 0)
            b["cost_usd"] += float(e.get("cost_usd") or 0)
            if e.get("status") not in ("success", None, ""):
                b["error_count"] += 1

        if not buckets:
            return 0

        rows = [
            {
                "organization_id": key[0],
                "agent_id": key[1] or None,
                "provider": key[2],
                "model": key[3],
                "bucket": key[4],
                "request_count": vals["request_count"],
                "total_tokens": vals["total_tokens"],
                "cost_usd": round(vals["cost_usd"], 8),
                "error_count": vals["error_count"],
            }
            for key, vals in buckets.items()
            if key[0]  # skip rows with no org_id
        ]

        if rows:
            self._db.table(table).upsert(
                rows,
                on_conflict="organization_id,agent_id,provider,model,bucket",
            ).execute()

        return len(rows)
