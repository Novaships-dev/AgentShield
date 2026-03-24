"""Rate limiting middleware — Redis sliding window."""
from __future__ import annotations
import time
from app.utils.errors import RateLimitError
from app.utils.redis import get_redis_client

RATE_LIMITS = {
    "free": {"track": 100, "dashboard": 30},
    "starter": {"track": 500, "dashboard": 60},
    "pro": {"track": 2000, "dashboard": 120},
    "team": {"track": 5000, "dashboard": 200},
}


async def check_rate_limit(org_id: str, endpoint: str, plan: str) -> tuple[int, int, int]:
    """Check rate limit using Redis sliding window.

    Returns (limit, remaining, reset_timestamp).
    Raises RateLimitError if exceeded.
    """
    from app.config import settings
    if not settings.rate_limit_enabled:
        limits = RATE_LIMITS.get(plan, RATE_LIMITS["free"])
        limit = limits.get(endpoint, 100)
        return limit, limit, int(time.time()) + 60

    redis = get_redis_client()
    window_seconds = 60
    current_window = int(time.time()) // window_seconds
    key = f"ratelimit:{org_id}:{endpoint}:{current_window}"

    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds * 2)
    results = await pipe.execute()

    current = results[0]
    limits = RATE_LIMITS.get(plan, RATE_LIMITS["free"])
    limit = limits.get(endpoint, 100)
    remaining = max(0, limit - current)
    reset = (current_window + 1) * window_seconds

    if current > limit:
        raise RateLimitError(
            f"Rate limit exceeded: {limit} requests/minute for {endpoint}",
            code="rate_limit_exceeded",
            details={"limit": limit, "remaining": 0, "reset": reset},
        )

    return limit, remaining, reset
