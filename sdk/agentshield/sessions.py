"""session() context manager for multi-step replay tracking."""

from __future__ import annotations

import contextvars
from typing import Any

_current_session: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "ags_session", default=None
)
_current_step: contextvars.ContextVar[int] = contextvars.ContextVar("ags_step", default=0)


class session:
    """Context manager that groups @shield() calls under a shared session_id.

    Usage::

        with session("my-session-id"):
            result1 = agent_call_1()   # step=1 auto-assigned
            result2 = agent_call_2()   # step=2 auto-assigned

    The session_id and step counter are stored in contextvars, making them
    safe for both threading and asyncio.

    Nested sessions are not supported and will raise ValueError.
    """

    def __init__(self, session_id: str) -> None:
        self._session_id = session_id
        self._token_session: Any = None
        self._token_step: Any = None

    def __enter__(self) -> "session":
        if _current_session.get() is not None:
            raise ValueError(
                "Nested sessions are not supported. "
                "Exit the current session before starting a new one."
            )
        self._token_session = _current_session.set(self._session_id)
        self._token_step = _current_step.set(0)
        return self

    def __exit__(self, *exc: Any) -> bool:
        _current_session.reset(self._token_session)
        _current_step.reset(self._token_step)
        return False  # Never swallow exceptions

    async def __aenter__(self) -> "session":
        return self.__enter__()

    async def __aexit__(self, *exc: Any) -> bool:
        return self.__exit__(*exc)
