"""AgentShield LangChain integration — BaseCallbackHandler."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger("agentshield.langchain")

try:
    from langchain_core.callbacks.base import BaseCallbackHandler
    from langchain_core.outputs import LLMResult
    _LANGCHAIN_AVAILABLE = True
except ImportError:
    _LANGCHAIN_AVAILABLE = False
    BaseCallbackHandler = object  # type: ignore[assignment,misc]
    LLMResult = None  # type: ignore[assignment,misc]


class AgentShieldCallback(BaseCallbackHandler):
    """LangChain callback that tracks costs and sessions in AgentShield.

    Usage::

        from agentshield.integrations.langchain import AgentShieldCallback

        callback = AgentShieldCallback(agent_name="my-langchain-agent")
        chain.invoke({"input": query}, config={"callbacks": [callback]})
    """

    def __init__(
        self,
        agent_name: str,
        session_id: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> None:
        if not _LANGCHAIN_AVAILABLE:
            raise ImportError(
                "langchain-core is required. Install it with: pip install langchain-core"
            )
        super().__init__()
        self.agent_name = agent_name
        self.session_id = session_id
        self.tags = tags or {}
        self._start: dict[str, float] = {}

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        self._start[str(run_id)] = time.time()

    def on_llm_end(
        self,
        response: Any,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        try:
            from agentshield.client import AgentShieldClient
            from agentshield.models import TrackEvent

            elapsed = time.time() - self._start.pop(str(run_id), time.time())
            llm_output = getattr(response, "llm_output", {}) or {}
            usage = llm_output.get("token_usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)

            # Try to extract model name
            model = "unknown"
            generations = getattr(response, "generations", [[]])
            if generations and generations[0]:
                gen = generations[0][0]
                generation_info = getattr(gen, "generation_info", {}) or {}
                model = generation_info.get("model_name", model)

            event = TrackEvent(
                agent=self.agent_name,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                latency_ms=int(elapsed * 1000),
                session_id=self.session_id,
                metadata=self.tags,
            )
            client = AgentShieldClient()
            client._track(event)
        except Exception as exc:
            logger.debug("AgentShield tracking error (non-blocking): %s", exc)

    def on_llm_error(self, error: Exception, *, run_id: UUID, **kwargs: Any) -> None:
        self._start.pop(str(run_id), None)
        logger.debug("LLM error in AgentShield callback: %s", error)
