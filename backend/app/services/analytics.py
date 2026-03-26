"""Analytics service — aggregated cost/usage data for the dashboard."""
from __future__ import annotations
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.schemas.analytics import (
    AnalyticsResponse, AnalyticsSummary,
    TimeseriesPoint, AgentBreakdown, ProviderBreakdown, ModelBreakdown, TeamBreakdown,
)


def _range_to_interval(range_val: str) -> tuple[datetime, datetime]:
    """Return (start, end) UTC datetimes for a named range."""
    now = datetime.now(timezone.utc)
    match range_val:
        case "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        case "7d":
            start = now - timedelta(days=7)
        case "30d":
            start = now - timedelta(days=30)
        case "90d":
            start = now - timedelta(days=90)
        case _:
            start = now - timedelta(days=30)
    return start, now


def _auto_granularity(start: datetime, end: datetime) -> str:
    delta = end - start
    return "hour" if delta.total_seconds() <= 2 * 86400 else "day"


def _pct(value: float, total: float) -> float:
    if total == 0:
        return 0.0
    return round(value / total * 100, 1)


class AnalyticsService:
    def __init__(self, db, redis):
        self._db = db
        self._redis = redis

    async def get_analytics(
        self,
        org_id: str,
        range_val: str = "30d",
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        agent_id: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        team_label: Optional[str] = None,
        granularity: Optional[str] = None,
    ) -> AnalyticsResponse:
        # Resolve time range
        if start is None or end is None:
            start, end = _range_to_interval(range_val)

        if granularity is None:
            granularity = _auto_granularity(start, end)

        # Build cache key
        cache_params = {
            "org": org_id, "start": start.isoformat(), "end": end.isoformat(),
            "agent": agent_id, "provider": provider, "model": model,
            "team": team_label, "gran": granularity,
        }
        query_hash = hashlib.md5(json.dumps(cache_params, sort_keys=True).encode()).hexdigest()[:12]
        cache_key = f"analytics:{org_id}:{query_hash}"

        # Try cache
        try:
            cached = await self._redis.get(cache_key)
            if cached:
                return AnalyticsResponse.model_validate_json(cached)
        except Exception:
            pass

        result = self._build_analytics(org_id, start, end, granularity, agent_id, provider, model, team_label)

        # Cache for 30s
        try:
            await self._redis.setex(cache_key, 30, result.model_dump_json())
        except Exception:
            pass

        return result

    def _build_analytics(
        self,
        org_id: str,
        start: datetime,
        end: datetime,
        granularity: str,
        agent_id: Optional[str],
        provider: Optional[str],
        model: Optional[str],
        team_label: Optional[str],
    ) -> AnalyticsResponse:
        db = self._db
        start_iso = start.isoformat()
        end_iso = end.isoformat()

        # ── Base filter ────────────────────────────────────────────────────
        def base_query():
            q = db.table("events").select("*").eq("organization_id", org_id)
            q = q.gte("tracked_at", start_iso).lte("tracked_at", end_iso)
            if agent_id:
                q = q.eq("agent_id", agent_id)
            if provider:
                q = q.eq("provider", provider)
            if model:
                q = q.eq("model", model)
            if team_label:
                q = q.eq("team_label", team_label)
            return q

        events = base_query().execute().data or []

        # ── Summary ────────────────────────────────────────────────────────
        total_cost = sum(float(e.get("cost_usd") or 0) for e in events)
        total_requests = len(events)
        total_tokens = sum(int(e.get("total_tokens") or 0) for e in events)
        error_count = sum(1 for e in events if e.get("status") not in ("success", None, ""))
        active_agent_ids = {e.get("agent_id") for e in events if e.get("agent_id")}

        summary = AnalyticsSummary(
            total_cost_usd=round(total_cost, 6),
            total_requests=total_requests,
            total_tokens=total_tokens,
            active_agents=len(active_agent_ids),
            avg_cost_per_request=round(total_cost / total_requests, 6) if total_requests else 0.0,
            error_rate_pct=_pct(error_count, total_requests),
        )

        # ── Timeseries ─────────────────────────────────────────────────────
        from collections import defaultdict
        ts_buckets: dict[str, dict] = defaultdict(lambda: {"cost": 0.0, "requests": 0})
        for e in events:
            ts = e.get("tracked_at", "")
            if not ts:
                continue
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if granularity == "hour":
                    bucket = dt.strftime("%Y-%m-%dT%H:00:00+00:00")
                else:
                    bucket = dt.strftime("%Y-%m-%dT00:00:00+00:00")
            except ValueError:
                continue
            ts_buckets[bucket]["cost"] += float(e.get("cost_usd") or 0)
            ts_buckets[bucket]["requests"] += 1

        timeseries = [
            TimeseriesPoint(
                timestamp=ts,
                cost_usd=round(v["cost"], 6),
                requests=v["requests"],
            )
            for ts, v in sorted(ts_buckets.items())
        ]

        # ── By agent ───────────────────────────────────────────────────────
        agent_buckets: dict[str, dict] = defaultdict(lambda: {"cost": 0.0, "name": ""})
        for e in events:
            aid = e.get("agent_id") or "unknown"
            agent_buckets[aid]["cost"] += float(e.get("cost_usd") or 0)
            if not agent_buckets[aid]["name"]:
                # Look up agent name from a separate query lazily on first occurrence
                agent_buckets[aid]["name"] = aid  # fallback

        # Resolve agent names in batch
        if active_agent_ids:
            agents_result = (
                db.table("agents")
                .select("id,name")
                .in_("id", list(active_agent_ids))
                .execute()
            )
            for row in (agents_result.data or []):
                if row["id"] in agent_buckets:
                    agent_buckets[row["id"]]["name"] = row["name"]

        by_agent = sorted(
            [
                AgentBreakdown(
                    agent_id=aid,
                    agent_name=v["name"],
                    cost_usd=round(v["cost"], 6),
                    pct=_pct(v["cost"], total_cost),
                )
                for aid, v in agent_buckets.items()
            ],
            key=lambda x: x.cost_usd,
            reverse=True,
        )

        # ── By provider ────────────────────────────────────────────────────
        prov_buckets: dict[str, float] = defaultdict(float)
        for e in events:
            prov_buckets[e.get("provider") or "unknown"] += float(e.get("cost_usd") or 0)

        by_provider = sorted(
            [
                ProviderBreakdown(
                    provider=p,
                    cost_usd=round(cost, 6),
                    pct=_pct(cost, total_cost),
                )
                for p, cost in prov_buckets.items()
            ],
            key=lambda x: x.cost_usd,
            reverse=True,
        )

        # ── By model ───────────────────────────────────────────────────────
        model_buckets: dict[str, dict] = defaultdict(lambda: {"cost": 0.0, "provider": "unknown"})
        for e in events:
            m = e.get("model") or "unknown"
            model_buckets[m]["cost"] += float(e.get("cost_usd") or 0)
            model_buckets[m]["provider"] = e.get("provider") or "unknown"

        by_model = sorted(
            [
                ModelBreakdown(
                    model=m,
                    provider=v["provider"],
                    cost_usd=round(v["cost"], 6),
                    pct=_pct(v["cost"], total_cost),
                )
                for m, v in model_buckets.items()
            ],
            key=lambda x: x.cost_usd,
            reverse=True,
        )

        # ── By team ────────────────────────────────────────────────────────
        team_buckets: dict[str, float] = defaultdict(float)
        for e in events:
            label = e.get("team_label") or "unassigned"
            team_buckets[label] += float(e.get("cost_usd") or 0)

        by_team = sorted(
            [
                TeamBreakdown(
                    team_label=t,
                    cost_usd=round(cost, 6),
                    pct=_pct(cost, total_cost),
                )
                for t, cost in team_buckets.items()
            ],
            key=lambda x: x.cost_usd,
            reverse=True,
        )

        return AnalyticsResponse(
            summary=summary,
            timeseries=timeseries,
            by_agent=by_agent,
            by_provider=by_provider,
            by_model=by_model,
            by_team=by_team,
        )
