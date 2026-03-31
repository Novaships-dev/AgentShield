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
    """Verify a Supabase JWT and return decoded payload."""
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256", "ES256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token expired", code="auth_invalid_token")
    except jwt.InvalidTokenError:
        raise AuthenticationError("Invalid token", code="auth_invalid_token")
