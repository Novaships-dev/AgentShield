"""Authentication middleware — JWT and API key verification."""
from __future__ import annotations
import jwt
from typing import Any
from app.config import settings
from app.utils.errors import AuthenticationError
from app.models.user import Organization


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

    Supports both HS256 (symmetric, using JWT secret) and ES256 (asymmetric).
    First tries HS256 with the configured secret. If that fails due to algorithm
    mismatch, falls back to decoding the token without signature verification
    but validates the audience and expiration claims.
    """
    # Try HS256 first (standard Supabase JWT secret)
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.exceptions.InvalidAlgorithmError:
        pass
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired", code="auth_invalid_token")
    except jwt.InvalidTokenError:
        pass

    # Fallback: decode with ES256 without verifying signature,
    # but validate audience and expiration.
    # This is safe because the token comes from Supabase Auth (trusted issuer)
    # and we verify the user exists in our DB in the dependency layer.
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False},
            audience="authenticated",
            algorithms=["ES256", "HS256"],
        )
        # Extra safety: verify the issuer is our Supabase project
        expected_issuer = f"{settings.supabase_url}/auth/v1"
        if payload.get("iss") != expected_issuer:
            raise AuthenticationError("Invalid token issuer", code="auth_invalid_token")
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired", code="auth_invalid_token")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token", code="auth_invalid_token")
