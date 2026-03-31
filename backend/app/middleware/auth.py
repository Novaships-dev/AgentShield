"""Authentication middleware — JWT and API key verification."""
from __future__ import annotations
import jwt
import json
import logging
import time
from typing import Any
from jwt import PyJWK
from app.config import settings
from app.utils.errors import AuthenticationError
from app.models.user import Organization

logger = logging.getLogger(__name__)

# JWKS cache
_jwks_cache: dict[str, Any] | None = None
_jwks_cache_time: float = 0
_JWKS_CACHE_TTL = 3600  # 1 hour


def _get_jwks() -> dict[str, Any]:
    """Fetch and cache the Supabase JWKS public keys."""
    global _jwks_cache, _jwks_cache_time
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < _JWKS_CACHE_TTL:
        return _jwks_cache

    import httpx
    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(jwks_url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = now
        logger.info("[auth] JWKS keys refreshed from Supabase")
        return _jwks_cache
    except Exception as exc:
        logger.error(f"[auth] Failed to fetch JWKS: {exc}")
        if _jwks_cache:
            return _jwks_cache
        raise AuthenticationError("Unable to verify token", code="auth_invalid_token")


async def verify_api_key_middleware(authorization: str) -> Organization:
    """Extract and verify API key from Authorization header."""
    token = authorization.removeprefix("Bearer ").strip()
    if token.startswith("ags_live_"):
        from app.services.api_keys import verify_api_key
        return await verify_api_key(token)
    elif token.startswith("eyJ"):
        raise AuthenticationError("JWT auth not supported for API key endpoints", code="auth_invalid_api_key")
    else:
        raise AuthenticationError("Missing or invalid authorization", code="auth_missing")


def verify_jwt(token: str) -> dict[str, Any]:
    """Verify a Supabase JWT and return decoded payload.

    Strategy:
    1. Try HS256 with the configured JWT secret (fast, local)
    2. If algorithm mismatch, try ES256 with Supabase JWKS public key (secure, remote)
    """
    # --- Attempt 1: HS256 with JWT secret ---
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.exceptions.InvalidAlgorithmError:
        pass  # Token is not HS256, try ES256
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired", code="auth_invalid_token")
    except jwt.InvalidTokenError:
        pass  # Try ES256 fallback

    # --- Attempt 2: ES256 with JWKS public key ---
    try:
        # Get the kid from the token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        jwks_data = _get_jwks()
        keys = jwks_data.get("keys", [])

        # Find the matching key
        signing_key = None
        for key_data in keys:
            if kid and key_data.get("kid") != kid:
                continue
            signing_key = PyJWK(key_data).key
            break

        if not signing_key:
            raise AuthenticationError("No matching signing key found", code="auth_invalid_token")

        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            audience="authenticated",
        )

        # Extra safety: verify the issuer is our Supabase project
        expected_issuer = f"{settings.supabase_url}/auth/v1"
        if payload.get("iss") != expected_issuer:
            raise AuthenticationError("Invalid token issuer", code="auth_invalid_token")

        return payload

    except AuthenticationError:
        raise
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired", code="auth_invalid_token")
    except jwt.InvalidTokenError as exc:
        logger.warning(f"[auth] JWT ES256 verification failed: {exc}")
        raise AuthenticationError("Invalid token", code="auth_invalid_token")
    except Exception as exc:
        logger.error(f"[auth] Unexpected JWT verification error: {exc}")
        raise AuthenticationError("Invalid token", code="auth_invalid_token")
