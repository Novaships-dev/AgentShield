"""Tests for session() context manager and step tracking."""
import pytest

from agentshield.sessions import _current_session, _current_step, session
from agentshield.steps import get_session_id, next_step


def test_session_sets_session_id():
    assert _current_session.get() is None
    with session("my-session-42"):
        assert _current_session.get() == "my-session-42"
    assert _current_session.get() is None


def test_session_auto_increments_step():
    with session("step-test"):
        assert _current_step.get() == 0
        s1 = next_step()
        assert s1 == 1
        s2 = next_step()
        assert s2 == 2
        s3 = next_step()
        assert s3 == 3


def test_session_nested_raises_error():
    with pytest.raises(ValueError, match="Nested sessions"):
        with session("outer"):
            with session("inner"):
                pass


def test_session_cleans_up_on_exit():
    with session("cleanup-test"):
        pass
    assert _current_session.get() is None
    assert _current_step.get() == 0


def test_session_cleans_up_on_exception():
    try:
        with session("exception-test"):
            raise RuntimeError("dev error")
    except RuntimeError:
        pass
    assert _current_session.get() is None


def test_get_session_id_outside_session():
    assert get_session_id() is None


def test_get_session_id_inside_session():
    with session("test-id-123"):
        assert get_session_id() == "test-id-123"


def test_next_step_outside_session():
    """next_step() works even without a session."""
    initial = _current_step.get()
    val = next_step()
    assert val == initial + 1
    # Reset for other tests
    _current_step.set(0)


def test_session_resets_step_counter():
    """Each new session starts fresh at step 0."""
    with session("first"):
        next_step()
        next_step()
    with session("second"):
        assert _current_step.get() == 0
        s = next_step()
        assert s == 1


@pytest.mark.asyncio
async def test_async_session_sets_id():
    async with session("async-session"):
        assert _current_session.get() == "async-session"
    assert _current_session.get() is None


@pytest.mark.asyncio
async def test_async_session_cleans_up_on_exception():
    try:
        async with session("async-exc"):
            raise RuntimeError("async dev error")
    except RuntimeError:
        pass
    assert _current_session.get() is None
