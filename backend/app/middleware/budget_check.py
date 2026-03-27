"""Budget check helpers integrated into POST /v1/track."""
from __future__ import annotations
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def run_budget_check(
    org_id: str,
    agent_id: str,
    db,
    redis,
) -> dict:
    """
    SYNC check before event is stored.
    Returns budget status dict: {status, remaining_usd, budget_cap, percentage}.
    Raises AgentFrozenError or BudgetExceededError if applicable.
    """
    from app.services.budgets import BudgetService
    svc = BudgetService(db=db, redis=redis)
    return await svc.check_budget(org_id, agent_id)


async def increment_budget_counter(
    org_id: str,
    agent_id: str,
    cost_usd: float,
    db,
    redis,
) -> None:
    """Increment Redis budget counters after successful event insert."""
    if not cost_usd:
        return
    try:
        from app.services.budgets import BudgetService
        svc = BudgetService(db=db, redis=redis)
        await svc.increment_counter(org_id, agent_id, cost_usd)
    except Exception as exc:
        logger.warning(f"[budget] counter increment failed: {exc}")


async def publish_budget_ws(
    redis,
    org_id: str,
    agent_name: str,
    budget_status: dict,
) -> None:
    """Publish budget_warning or budget_frozen WebSocket events."""
    status = budget_status.get("status")
    if status not in ("warning", "exceeded"):
        return
    try:
        channel = f"ws:{org_id}"
        if status == "exceeded":
            event_type = "budget_frozen"
            data = {
                "agent": agent_name,
                "current_usd": budget_status.get("budget_cap", {}).get("max_usd", 0),
                "max_usd": budget_status.get("budget_cap", {}).get("max_usd", 0),
            }
        else:
            event_type = "budget_warning"
            data = {
                "agent": agent_name,
                "percentage": budget_status.get("percentage", 0),
            }
        payload = json.dumps({"type": event_type, "data": data})
        await redis.publish(channel, payload)
    except Exception:
        pass
