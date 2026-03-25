import pytest

from agentshield._config import _config
import agentshield.client as _client_module


@pytest.fixture(autouse=True)
def reset_config():
    """Reset SDK config and client singleton between tests."""
    original_key = _config.api_key
    original_url = _config.api_url
    original_retry_max = _config.retry_max
    original_retry_backoff = _config.retry_backoff
    original_debug = _config.debug
    original_pii = _config.pii_redaction

    # Reset client singleton
    _client_module._client = None

    yield

    _config.api_key = original_key
    _config.api_url = original_url
    _config.retry_max = original_retry_max
    _config.retry_backoff = original_retry_backoff
    _config.debug = original_debug
    _config.pii_redaction = original_pii

    # Reset client singleton again
    _client_module._client = None
