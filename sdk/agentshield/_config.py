from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class _Config:
    api_key: str | None = None
    api_url: str = "https://api.agentshield.io"
    timeout: float = 10.0
    max_retries: int = 3
    debug: bool = False
    options: dict[str, Any] = field(default_factory=dict)


_config = _Config()


def configure(
    api_key: str,
    api_url: str | None = None,
    timeout: float | None = None,
    max_retries: int | None = None,
    debug: bool = False,
    **options: Any,
) -> None:
    """Configure the AgentShield SDK.

    Must be called before using any SDK functions.

    Args:
        api_key: Your AgentShield API key (starts with ags_live_).
        api_url: Override the default API URL (for self-hosted or testing).
        timeout: HTTP request timeout in seconds. Default: 10.0.
        max_retries: Number of retry attempts for transient errors. Default: 3.
        debug: Enable verbose debug logging. Default: False.
        **options: Additional options passed to the HTTP client.
    """
    _config.api_key = api_key
    if api_url is not None:
        _config.api_url = api_url
    if timeout is not None:
        _config.timeout = timeout
    if max_retries is not None:
        _config.max_retries = max_retries
    _config.debug = debug
    _config.options.update(options)


def get_config() -> _Config:
    """Return the current SDK configuration."""
    return _config
