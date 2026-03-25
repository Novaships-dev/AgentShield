"""Step counter utilities for session-based tracking."""

from __future__ import annotations

from agentshield.sessions import _current_session, _current_step


def next_step() -> int:
    """Increment and return the next step number for the current session.

    Returns 1 on the first call, 2 on the second, etc.
    Returns 1 even if no session is active (standalone step tracking).
    """
    current = _current_step.get()
    new_step = current + 1
    _current_step.set(new_step)
    return new_step


def get_session_id() -> str | None:
    """Return the current session_id, or None if not inside a session() block."""
    return _current_session.get()
