"""PIIRedactionService — server-side PII redaction with per-org config cache."""
from __future__ import annotations

import json

from app.utils.pii_patterns import redact_text

_CACHE_TTL = 300  # 5 minutes


class PIIRedactionService:
    def __init__(self, db, redis):
        self._db = db
        self._redis = redis

    async def redact(
        self,
        org_id: str,
        text: str | None,
    ) -> tuple[str | None, list[str]]:
        """Redact PII from text using org-specific configuration.

        Returns (redacted_text, detected_types). If text is None, returns (None, []).
        """
        if not text:
            return text, []

        active_patterns = await self._get_active_patterns(org_id)
        redacted, detected = redact_text(text, active_patterns)
        return redacted, detected

    async def _get_active_patterns(self, org_id: str) -> list[str] | None:
        """Load org PII config from Redis cache or DB.

        Returns None to use all default patterns.
        """
        cache_key = f"pii:{org_id}"

        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        try:
            result = (
                self._db.table("pii_configs")
                .select("active_patterns")
                .eq("organization_id", org_id)
                .maybe_single()
                .execute()
            )
            if result.data and result.data.get("active_patterns"):
                patterns = result.data["active_patterns"]
                await self._redis.set(cache_key, json.dumps(patterns), ex=_CACHE_TTL)
                return patterns
        except Exception:
            pass

        # Default: all patterns enabled (cache as empty list = use defaults)
        return None
