"""AgentShield LlamaIndex integration."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional
from uuid import UUID

logger = logging.getLogger("agentshield.llamaindex")

try:
    from llama_index.core.callbacks.base_handler import BaseCallbackHandler
    from llama_index.core.callbacks.schema import CBEventType, EventPayload
    _LLAMAINDEX_AVAILABLE = True
except ImportError:
    _LLAMAINDEX_AVAILABLE = False
    BaseCallbackHandler = object  # type: ignore[assignment,misc]
    CBEventType = None  # type: ignore[assignment]
    EventPayload = None  # type: ignore[assignment]


class AgentShieldLlamaIndexCallback(BaseCallbackHandler if _LLAMAINDEX_AVAILABLE else object):  # type: ignore[misc]
    """LlamaIndex callback handler that tracks LLM calls in AgentShield.

    Usage::

        from agentshield.integrations.llamaindex import AgentShieldLlamaIndexCallback
        from llama_index.core import Settings
        from llama_index.core.callbacks import CallbackManager

        callback = AgentShieldLlamaIndexCallback(agent_name="my-llama-agent")
        Settings.callback_manager = CallbackManager([callback])
    """

    def __init__(
        self,
        agent_name: str,
        session_id: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> None:
        if not _LLAMAINDEX_AVAILABLE:
            raise ImportError(
                "llama-index-core is required. Install it with: pip install llama-index-core"
            )
        super().__init__(
            event_starts_to_ignore=[],
            event_ends_to_ignore=[],
        )
        self.agent_name = agent_name
        self.session_id = session_id
        self.tags = tags or {}
        self._starts: dict[str, float] = {}

    def on_event_start(
        self,
        event_type: Any,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        parent_id: str = "",
        **kwargs: Any,
    ) -> str:
        if _LLAMAINDEX_AVAILABLE and event_type == CBEventType.LLM:
            self._starts[event_id] = time.time()
        return event_id

    def on_event_end(
        self,
        event_type: Any,
        payload: Optional[Dict[str, Any]] = None,
        event_id: str = "",
        **kwargs: Any,
    ) -> None:
        if not (_LLAMAINDEX_AVAILABLE and event_type == CBEventType.LLM):
            return
        try:
            from agentshield.client import AgentShieldClient
            from agentshield.models import TrackEvent

            elapsed = time.time() - self._starts.pop(event_id, time.time())
            payload = payload or {}
            response = payload.get(EventPayload.RESPONSE)
            usage = {}
            model = "unknown"

            if response is not None:
                raw = getattr(response, "raw", {}) or {}
                usage = raw.get("usage", {})
                model = raw.get("model", "unknown")

            event = TrackEvent(
                agent=self.agent_name,
                model=model,
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                latency_ms=int(elapsed * 1000),
                session_id=self.session_id,
                metadata=self.tags,
            )
            AgentShieldClient()._track(event)
        except Exception as exc:
            logger.debug("AgentShield tracking error (non-blocking): %s", exc)

    def start_trace(self, trace_id: Optional[str] = None) -> None:
        pass

    def end_trace(
        self,
        trace_id: Optional[str] = None,
        trace_map: Optional[Dict[str, List[str]]] = None,
    ) -> None:
        pass
