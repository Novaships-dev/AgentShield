"""AgentShield AutoGen integration."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agentshield.autogen")

try:
    from autogen import ConversableAgent
    _AUTOGEN_AVAILABLE = True
except ImportError:
    _AUTOGEN_AVAILABLE = False
    ConversableAgent = object  # type: ignore[assignment,misc]


class AgentShieldAutoGenHook:
    """AutoGen hook that tracks LLM calls in AgentShield.

    Usage::

        from agentshield.integrations.autogen import AgentShieldAutoGenHook

        hook = AgentShieldAutoGenHook(agent_name="my-autogen-agent")
        assistant = AssistantAgent("assistant", llm_config={...})
        hook.register(assistant)
    """

    def __init__(
        self,
        agent_name: str,
        session_id: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> None:
        self.agent_name = agent_name
        self.session_id = session_id
        self.tags = tags or {}
        self._start: float | None = None

    def register(self, agent: Any) -> None:
        """Register pre/post reply hooks on a ConversableAgent."""
        if not _AUTOGEN_AVAILABLE:
            raise ImportError("autogen is required. Install it with: pip install pyautogen")
        agent.register_hook("process_message_before_send", self._before_send)
        agent.register_hook("process_last_received_message", self._after_receive)

    def _before_send(self, message: Any, sender: Any, silent: bool) -> Any:
        self._start = time.time()
        return message

    def _after_receive(self, message: Any) -> Any:
        try:
            from agentshield.client import AgentShieldClient
            from agentshield.models import TrackEvent

            elapsed = time.time() - (self._start or time.time())
            content = message if isinstance(message, str) else str(message)
            # AutoGen doesn't expose token counts easily, estimate from content length
            estimated_tokens = max(1, len(content) // 4)

            event = TrackEvent(
                agent=self.agent_name,
                model="unknown",
                prompt_tokens=0,
                completion_tokens=estimated_tokens,
                latency_ms=int(elapsed * 1000),
                session_id=self.session_id,
                metadata=self.tags,
            )
            AgentShieldClient()._track(event)
        except Exception as exc:
            logger.debug("AgentShield tracking error (non-blocking): %s", exc)
        return message
