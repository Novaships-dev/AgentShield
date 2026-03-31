import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.utils.errors import AgentShieldError

# ---------------------------------------------------------------------------
# Sentry — initialise before the app is created
# ---------------------------------------------------------------------------

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.05,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        send_default_pii=False,
    )

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AgentShield API",
    version="0.1.0",
    docs_url="/docs" if settings.app_debug else None,
    redoc_url="/redoc" if settings.app_debug else None,
)

# ---------------------------------------------------------------------------
# Request ID Middleware
# ---------------------------------------------------------------------------


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Any:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-AGS-Request-Id"] = request_id
        return response


# RequestIdMiddleware FIRST (so it runs AFTER CORS in the middleware chain)
app.add_middleware(RequestIdMiddleware)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------

# CORS LAST (so it runs FIRST and handles OPTIONS preflight before anything else)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Exception Handlers
# ---------------------------------------------------------------------------


@app.exception_handler(AgentShieldError)
async def agentshield_error_handler(request: Request, exc: AgentShieldError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
        headers={"X-AGS-Request-Id": getattr(request.state, "request_id", "")},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": exc.errors()},
            }
        },
        headers={"X-AGS-Request-Id": getattr(request.state, "request_id", "")},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {},
            }
        },
        headers={"X-AGS-Request-Id": getattr(request.state, "request_id", "")},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


from app.api.v1.router import router as v1_router
app.include_router(v1_router)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, Any]:
    from app.utils.redis import get_redis_client
    from app.utils.supabase import get_supabase_client

    services: dict[str, str] = {}

    # Check Redis
    try:
        redis = get_redis_client()
        await redis.ping()
        services["redis"] = "ok"
    except Exception:
        services["redis"] = "error"

    # Check Supabase/database
    try:
        sb = get_supabase_client()
        sb.table("organizations").select("id").limit(1).execute()
        services["database"] = "ok"
    except Exception:
        services["database"] = "error"

    overall = "ok" if all(v == "ok" for v in services.values()) else "degraded"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
        "services": services,
    }
