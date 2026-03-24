"""Plan limit enforcement middleware stub.

Full implementation in Sprint 1.
"""
from __future__ import annotations


async def check_plan_limits(organization_id: str, resource: str) -> None:
    """Check if the organization has exceeded the limits of its plan.

    Stub — Sprint 1 will validate agents count, monthly requests, etc.
    """
    pass
