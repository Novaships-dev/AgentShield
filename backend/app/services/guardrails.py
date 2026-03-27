"""Guardrails service — keyword/regex/topic/category evaluation with Redis cache."""
from __future__ import annotations
import json
import re
import logging
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

_CACHE_TTL = 300  # 5 minutes

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "hate_speech": ["hate", "racist", "bigot", "slur", "supremacist", "discriminate", "n-word"],
    "self_harm": ["suicide", "self-harm", "kill myself", "end my life", "cut myself", "self harm"],
    "illegal_activity": ["illegal", "drug deal", "hack into", "synthesize drugs", "money laundering", "buy weapons"],
    "violence": ["murder", "assault", "weapon", "bomb", "shoot", "stab", "attack", "kill"],
}

TOPIC_KEYWORDS: dict[str, list[str]] = {
    "politics": ["democrat", "republican", "liberal", "conservative", "election", "vote", "politician"],
    "religion": ["god", "allah", "jesus", "bible", "quran", "church", "mosque", "temple", "prayer"],
    "adult_content": ["sex", "porn", "nude", "explicit", "erotic", "adult content"],
    "gambling": ["casino", "bet", "wager", "poker", "slots", "gambling", "lottery"],
}


@dataclass
class Violation:
    rule_id: str
    rule_name: str
    rule_type: str
    action: str
    matched_content: str

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "rule_type": self.rule_type,
            "action": self.action,
            "matched_content": self.matched_content,
        }


class GuardrailService:
    def __init__(self, db, redis=None):
        self._db = db
        self._redis = redis

    # ------------------------------------------------------------------
    # Evaluation — < 5ms target
    # ------------------------------------------------------------------

    async def evaluate(
        self,
        org_id: str,
        agent_id: Optional[str],
        input_text: Optional[str],
        output_text: Optional[str],
    ) -> list[Violation]:
        rules = await self._load_rules(org_id)
        if not rules:
            return []

        content = " ".join(filter(None, [input_text, output_text]))
        violations: list[Violation] = []

        for rule in rules:
            # Skip rules for other agents
            if rule.get("agent_id") and rule["agent_id"] != agent_id:
                continue

            matched = self._evaluate_rule(rule, content)
            if matched is not None:
                violations.append(Violation(
                    rule_id=rule["id"],
                    rule_name=rule["name"],
                    rule_type=rule["type"],
                    action=rule["action"],
                    matched_content=matched[:200],  # truncate
                ))

        return violations

    def _evaluate_rule(self, rule: dict, content: str) -> Optional[str]:
        """Return matched string or None if no match."""
        rule_type = rule.get("type", "")
        config = rule.get("config") or {}

        if rule_type == "keyword":
            keywords = config.get("keywords", [])
            case_sensitive = config.get("case_sensitive", False)
            flags = 0 if case_sensitive else re.IGNORECASE
            for kw in keywords:
                if re.search(re.escape(kw), content, flags):
                    return kw

        elif rule_type == "regex":
            pattern = config.get("pattern", "")
            flags_val = config.get("flags", "i")
            regex_flags = re.IGNORECASE if "i" in flags_val else 0
            try:
                m = re.search(pattern, content, regex_flags)
                if m:
                    return m.group(0)
            except re.error:
                pass

        elif rule_type == "topic":
            topics = config.get("topics", [])
            for topic in topics:
                kws = TOPIC_KEYWORDS.get(topic, [])
                for kw in kws:
                    if re.search(re.escape(kw), content, re.IGNORECASE):
                        return kw

        elif rule_type == "category":
            categories = config.get("categories", [])
            for cat in categories:
                kws = CATEGORY_KEYWORDS.get(cat, [])
                for kw in kws:
                    if re.search(re.escape(kw), content, re.IGNORECASE):
                        return kw

        return None

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
            "type": data["type"],
            "config": data["config"],
            "action": data["action"],
            "is_active": True,
            "created_at": now,
        }
        self._db.table("guardrail_rules").insert(rule).execute()
        self._invalidate_cache(org_id)
        return rule

    def list_rules(self, org_id: str) -> list[dict]:
        result = (
            self._db.table("guardrail_rules")
            .select("*")
            .eq("organization_id", org_id)
            .order("created_at", desc=False)
            .execute()
        )
        rules = result.data or []
        # Enrich with 7-day violation count
        for rule in rules:
            try:
                from datetime import timedelta
                since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                cnt = (
                    self._db.table("guardrail_violations")
                    .select("id", count="exact")
                    .eq("rule_id", rule["id"])
                    .gte("created_at", since)
                    .execute()
                )
                rule["violation_count"] = cnt.count or 0
            except Exception:
                rule["violation_count"] = 0
        return rules

    def update_rule(self, org_id: str, rule_id: str, updates: dict) -> dict | None:
        result = (
            self._db.table("guardrail_rules")
            .select("id")
            .eq("id", rule_id)
            .eq("organization_id", org_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None
        self._db.table("guardrail_rules").update(updates).eq("id", rule_id).execute()
        self._invalidate_cache(org_id)
        updated = self._db.table("guardrail_rules").select("*").eq("id", rule_id).maybe_single().execute()
        return updated.data

    def delete_rule(self, org_id: str, rule_id: str) -> bool:
        result = (
            self._db.table("guardrail_rules")
            .select("id")
            .eq("id", rule_id)
            .eq("organization_id", org_id)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return False
        self._db.table("guardrail_rules").delete().eq("id", rule_id).execute()
        self._invalidate_cache(org_id)
        return True

    # ------------------------------------------------------------------
    # Cache
    # ------------------------------------------------------------------

    async def _load_rules(self, org_id: str) -> list[dict]:
        cache_key = f"guardrails:{org_id}"
        if self._redis:
            try:
                cached = await self._redis.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        result = (
            self._db.table("guardrail_rules")
            .select("*")
            .eq("organization_id", org_id)
            .eq("is_active", True)
            .order("created_at", desc=False)
            .execute()
        )
        rules = result.data or []

        if self._redis:
            try:
                await self._redis.setex(cache_key, _CACHE_TTL, json.dumps(rules))
            except Exception:
                pass

        return rules

    def _invalidate_cache(self, org_id: str) -> None:
        """Sync cache invalidation — fire-and-forget."""
        if self._redis:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                loop.create_task(self._redis.delete(f"guardrails:{org_id}"))
            except Exception:
                pass
