"""Alert rules service — CRUD and metric evaluation."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional


class AlertService:
    def __init__(self, db, redis=None):
        self._db = db
        self._redis = redis

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create_rule(self, org_id: str, data: dict) -> dict:
        rule_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        rule = {
            "id": rule_id,
            "organization_id": org_id,
            "name": data["name"],
            "agent_id": str(data["agent_id"]) if data.get("agent_id") else None,
            "metric": data["metric"],
            "threshold": data["threshold"],
            "channel": data.get("channel", "email"),
            "slack_webhook": data.get("slack_webhook"),
            "cooldown_minutes": data.get("cooldown_minutes", 60),
            "is_active": True,
            "last_triggered": None,
            "created_at": now,
        }
        self._db.table("alert_rules").insert(rule).execute()
        return self._enrich_rule(rule)

    def list_rules(self, org_id: str, page: int = 1, per_page: int = 50) -> dict:
        result = self._db.table("alert_rules").select("*").eq("organization_id", org_id).order("created_at", desc=True).execute()
        rules = result.data or []
        enriched = [self._enrich_rule(r) for r in rules]
        total = len(enriched)
        start = (page - 1) * per_page
        return {
            "data": enriched[start:start + per_page],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": max(1, (total + per_page - 1) // per_page),
            },
        }

    def get_rule(self, org_id: str, rule_id: str) -> dict | None:
        result = self._db.table("alert_rules").select("*").eq("id", rule_id).eq("organization_id", org_id).maybe_single().execute()
        return self._enrich_rule(result.data) if result.data else None

    def update_rule(self, org_id: str, rule_id: str, updates: dict) -> dict | None:
        result = self._db.table("alert_rules").select("id").eq("id", rule_id).eq("organization_id", org_id).maybe_single().execute()
        if not result.data:
            return None
        self._db.table("alert_rules").update(updates).eq("id", rule_id).execute()
        updated = self._db.table("alert_rules").select("*").eq("id", rule_id).maybe_single().execute()
        return self._enrich_rule(updated.data) if updated.data else None

    def delete_rule(self, org_id: str, rule_id: str) -> bool:
        result = self._db.table("alert_rules").select("id").eq("id", rule_id).eq("organization_id", org_id).maybe_single().execute()
        if not result.data:
            return False
        self._db.table("alert_rules").delete().eq("id", rule_id).execute()
        return True

    def toggle_rule(self, org_id: str, rule_id: str, is_active: bool) -> dict | None:
        return self.update_rule(org_id, rule_id, {"is_active": is_active})

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def list_history(self, org_id: str, page: int = 1, per_page: int = 50) -> dict:
        result = (
            self._db.table("alert_history")
            .select("*, alert_rules(name, metric, threshold, channel), agents(name)")
            .eq("organization_id", org_id)
            .order("sent_at", desc=True)
            .execute()
        )
        records = result.data or []
        enriched = []
        for r in records:
            rule = r.get("alert_rules") or {}
            agent = r.get("agents") or {}
            enriched.append({
                "id": r["id"],
                "alert_rule_id": r["alert_rule_id"],
                "alert_name": rule.get("name", ""),
                "agent_name": agent.get("name"),
                "metric": rule.get("metric", r.get("metric", "")),
                "triggered_value": r.get("triggered_value", 0),
                "threshold": rule.get("threshold", r.get("threshold", 0)),
                "channel": rule.get("channel", r.get("channel", "email")),
                "smart_diagnosis": r.get("smart_diagnosis"),
                "suggested_fix": r.get("suggested_fix"),
                "sent_at": r.get("sent_at"),
            })
        total = len(enriched)
        start = (page - 1) * per_page
        return {
            "data": enriched[start:start + per_page],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": max(1, (total + per_page - 1) // per_page),
            },
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _enrich_rule(self, rule: dict) -> dict:
        agent_name = None
        if rule.get("agent_id"):
            res = self._db.table("agents").select("name").eq("id", rule["agent_id"]).maybe_single().execute()
            if res.data:
                agent_name = res.data.get("name")
        return {**rule, "agent_name": agent_name}

    # ------------------------------------------------------------------
    # Metric evaluation (called by Celery task)
    # ------------------------------------------------------------------

    def evaluate_metric(self, org_id: str, agent_id: Optional[str], metric: str) -> float:
        now = datetime.now(timezone.utc)
        if metric == "cost_daily":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return self._sum_cost(org_id, agent_id, start, now)
        elif metric == "cost_weekly":
            start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            return self._sum_cost(org_id, agent_id, start, now)
        elif metric == "cost_monthly":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            return self._sum_cost(org_id, agent_id, start, now)
        elif metric == "requests_daily":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return float(self._count_events(org_id, agent_id, start, now))
        elif metric == "requests_hourly":
            start = now - timedelta(hours=1)
            return float(self._count_events(org_id, agent_id, start, now))
        elif metric == "error_rate":
            return self._calc_error_rate(org_id, agent_id, hours=1)
        return 0.0

    def _sum_cost(self, org_id: str, agent_id: Optional[str], start: datetime, end: datetime) -> float:
        query = self._db.table("events").select("cost_usd").eq("organization_id", org_id).gte("tracked_at", start.isoformat()).lte("tracked_at", end.isoformat())
        if agent_id:
            query = query.eq("agent_id", agent_id)
        result = query.execute()
        return sum(e.get("cost_usd") or 0 for e in (result.data or []))

    def _count_events(self, org_id: str, agent_id: Optional[str], start: datetime, end: datetime) -> int:
        query = self._db.table("events").select("id", count="exact").eq("organization_id", org_id).gte("tracked_at", start.isoformat()).lte("tracked_at", end.isoformat())
        if agent_id:
            query = query.eq("agent_id", agent_id)
        result = query.execute()
        return result.count or 0

    def _calc_error_rate(self, org_id: str, agent_id: Optional[str], hours: int = 1) -> float:
        start = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = self._db.table("events").select("status").eq("organization_id", org_id).gte("tracked_at", start.isoformat())
        if agent_id:
            query = query.eq("agent_id", agent_id)
        result = query.execute()
        events = result.data or []
        if not events:
            return 0.0
        errors = sum(1 for e in events if e.get("status") == "error")
        return round(errors / len(events) * 100, 2)

    def should_trigger(self, rule: dict) -> bool:
        """Check cooldown before evaluating metric."""
        if not rule.get("last_triggered"):
            return True
        try:
            last = datetime.fromisoformat(rule["last_triggered"].replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - last).total_seconds()
            return elapsed > rule["cooldown_minutes"] * 60
        except Exception:
            return True

    def record_alert(self, org_id: str, rule: dict, triggered_value: float, agent_id: Optional[str] = None) -> str:
        """Insert alert_history record and update last_triggered. Returns history_id."""
        history_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        self._db.table("alert_history").insert({
            "id": history_id,
            "organization_id": org_id,
            "alert_rule_id": rule["id"],
            "agent_id": agent_id or rule.get("agent_id"),
            "metric": rule["metric"],
            "triggered_value": triggered_value,
            "threshold": rule["threshold"],
            "channel": rule["channel"],
            "sent_at": now,
        }).execute()
        self._db.table("alert_rules").update({"last_triggered": now}).eq("id", rule["id"]).execute()
        return history_id
