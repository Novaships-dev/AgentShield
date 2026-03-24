"""Rate limiting middleware stub.

Full implementation in Sprint 1.
"""
from __future__ import annotations


async def check_rate_limit(organization_id: str, endpoint: str) -> None:
    """Check if the organization has exceeded its rate limit for the endpoint.

    Stub — Sprint 1 will use Redis sliding-window counters.
    """
    pass
