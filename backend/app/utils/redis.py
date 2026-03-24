from __future__ import annotations

import redis.asyncio as aioredis

from app.config import settings

_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis:
    """Return the async Redis client.

    Uses a singleton so only one connection pool is created per process.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client
