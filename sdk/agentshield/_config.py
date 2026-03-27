from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any


@dataclass
class _Config:
    api_key: str | None = None
    api_url: str = "https://api.agentshield.one"
    timeout: float = 10.0
    retry_max: int = 3
    retry_backoff: float = 1.0
    debug: bool = False
    pii_redaction: bool = True
    options: dict[str, Any] = field(default_factory=dict)


_config = _Config()


def configure(
    api_key: str | None = None,
    api_url: str | None = None,
    timeout: float | None = None,
    retry_max: int | None = None,
    retry_backoff: float | None = None,
    debug: bool = False,
    pii_redaction: bool = True,
    **options: Any,
) -> None:
    """Configure the AgentShield SDK.

    Must be called before using any SDK functions, or set AGENTSHIELD_API_KEY env var.

    Args:
        api_key: Your AgentShield API key (starts with ags_live_).
        api_url: Override the default API URL (for self-hosted or testing).
        timeout: HTTP request timeout in seconds. Default: 10.0.
        retry_max: Number of retry attempts for transient errors. Default: 3.
        retry_backoff: Base backoff in seconds for exponential retry. Default: 1.0.
        debug: Enable verbose debug logging. Default: False.
        pii_redaction: Enable client-side PII redaction. Default: True.
        **options: Additional options.
    """
    resolved_key = api_key or os.environ.get("AGENTSHIELD_API_KEY")
    if resolved_key:
        _config.api_key = resolved_key
    if api_url is not None:
        _config.api_url = api_url
    if timeout is not None:
        _config.timeout = timeout
    if retry_max is not None:
        _config.retry_max = retry_max
    if retry_backoff is not None:
        _config.retry_backoff = retry_backoff
    _config.debug = debug
    _config.pii_redaction = pii_redaction
    _config.options.update(options)


def get_config() -> _Config:
    """Return the current SDK configuration."""
    return _config
