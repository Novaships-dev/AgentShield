import pytest

from agentshield._config import _config


@pytest.fixture(autouse=True)
def reset_config():
    """Reset SDK config between tests."""
    original_key = _config.api_key
    original_url = _config.api_url
    yield
    _config.api_key = original_key
    _config.api_url = original_url
