"""AgentShield CrewAI integration."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("agentshield.crewai")

try:
    from crewai.utilities.events import (
        AgentTaskCompletedEvent,
        CrewKickoffEvent,
        LLMCallCompletedEvent,
        LLMCallStartedEvent,
    )
    from crewai.utilities.events.base_event_listener import BaseEventListener
    _CREWAI_AVAILABLE = True
except ImportError:
    _CREWAI_AVAILABLE = False
    BaseEventListener = object  # type: ignore[assignment,misc]


class AgentShieldCrewCallback(BaseEventListener if _CREWAI_AVAILABLE else object):  # type: ignore[misc]
    """CrewAI event listener that tracks costs and sessions in AgentShield.

    Usage::

        from agentshield.integrations.crewai import AgentShieldCrewCallback

        callback = AgentShieldCrewCallback(agent_name="my-crew")
        # The listener registers itself automatically when instantiated.
        crew = Crew(agents=[...], tasks=[...])
        crew.kickoff()
    """

    def __init__(
        self,
        agent_name: str,
        session_id: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> None:
        if not _CREWAI_AVAILABLE:
            raise ImportError(
                "crewai is required. Install it with: pip install crewai"
            )
        super().__init__()
        self.agent_name = agent_name
        self.session_id = session_id
        self.tags = tags or {}
        self._llm_start: float | None = None

    def setup_listeners(self, crewai_event_bus: Any) -> None:  # type: ignore[override]
        @crewai_event_bus.on(LLMCallStartedEvent)
        def on_llm_start(source: Any, event: Any) -> None:
            self._llm_start = time.time()

        @crewai_event_bus.on(LLMCallCompletedEvent)
        def on_llm_end(source: Any, event: Any) -> None:
            try:
                from agentshield.client import AgentShieldClient
                from agentshield.models import TrackEvent

                elapsed = time.time() - (self._llm_start or time.time())
                response = getattr(event, "response", None)
                usage = getattr(response, "usage_metadata", {}) or {}

                event_obj = TrackEvent(
                    agent=self.agent_name,
                    model=getattr(response, "model", "unknown"),
                    prompt_tokens=usage.get("input_tokens", 0),
                    completion_tokens=usage.get("output_tokens", 0),
                    latency_ms=int(elapsed * 1000),
                    session_id=self.session_id,
                    metadata=self.tags,
                )
                AgentShieldClient()._track(event_obj)
            except Exception as exc:
                logger.debug("AgentShield tracking error (non-blocking): %s", exc)
