"""AgentShield — The complete observability suite for AI agents."""

__version__ = "0.1.0"

from agentshield._config import configure
from agentshield.sessions import session
from agentshield.shield import shield

__all__ = ["shield", "session", "configure", "__version__"]
