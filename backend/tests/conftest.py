"""Test configuration and shared fixtures."""
import os
import pytest
from fastapi.testclient import TestClient


# Set required environment variables before importing app modules
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-that-is-long-enough-for-hs256")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")


from app.main import app  # noqa: E402 — must come after env vars are set


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
