from __future__ import annotations

from supabase import Client, create_client

from app.config import settings

_service_client: Client | None = None
_anon_client: Client | None = None


def get_supabase_client() -> Client:
    """Return the service-role Supabase client (bypasses RLS).

    Uses a singleton so only one client is created per process.
    """
    global _service_client
    if _service_client is None:
        _service_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _service_client


def get_supabase_anon_client() -> Client:
    """Return the anon-key Supabase client (respects RLS).

    Uses a singleton so only one client is created per process.
    """
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
    return _anon_client
