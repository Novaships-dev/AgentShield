# SKILL-FASTAPI.md — Comment coder les endpoints FastAPI dans AgentShield

> Lire AVANT de créer ou modifier un endpoint backend.
> Réfs : CONVENTIONS.md, API.md, ERRORS.md, SECURITY.md

---

## STRUCTURE D'UN ENDPOINT

```python
# app/api/v1/{resource}.py

from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_org, get_current_user, require_role, require_plan
from app.schemas.{resource} import {Resource}Request, {Resource}Response
from app.services.{resource} import {Resource}Service

router = APIRouter(prefix="/v1", tags=["{resource}"])

@router.post(
    "/{resource}",
    response_model={Resource}Response,
    status_code=201,
    summary="Short description",
)
async def create_{resource}(
    request: {Resource}Request,
    user: User = Depends(require_role("admin")),
    org: Organization = Depends(require_plan("pro")),
    service: {Resource}Service = Depends(),
) -> {Resource}Response:
    """Docstring in English."""
    return await service.create(org, request)
```

## PATTERN OBLIGATOIRE PAR ENDPOINT

```
1. Auth         → Depends(get_current_org) ou Depends(get_current_user)
2. Plan check   → Depends(require_plan("starter")) si feature payante
3. Role check   → Depends(require_role("admin")) si action admin
4. Validation   → Pydantic schema (automatique)
5. Service call  → Jamais de logique métier dans le endpoint
6. Response     → Pydantic response_model (automatique)
```

## DEPENDENCIES INJECTION

```python
# app/dependencies.py

async def get_current_org(authorization: str = Header()) -> Organization:
    """Extract org from API key or JWT."""

async def get_current_user(authorization: str = Header()) -> User:
    """Extract user from JWT (dashboard endpoints only)."""

def require_role(min_role: str):
    """Check user role (owner > admin > member)."""

def require_plan(min_plan: str):
    """Check org plan (team > pro > starter > free)."""

def get_db() -> AsyncClient:
    """Get Supabase client."""

def get_redis() -> Redis:
    """Get Redis client."""
```

## ROUTER REGISTRATION

```python
# app/api/v1/router.py

from fastapi import APIRouter
from app.api.v1 import track, agents, analytics, alerts, budgets, ...

v1_router = APIRouter()
v1_router.include_router(track.router)
v1_router.include_router(agents.router)
# ... tous les routers

# app/main.py
app.include_router(v1_router)
```

## RÈGLES STRICTES

```
1. Jamais de logique métier dans le endpoint → toujours dans services/
2. Jamais de query DB directe dans le endpoint → toujours via service
3. Toujours un response_model Pydantic
4. Toujours un status_code explicite
5. Toujours un summary et une docstring
6. Les erreurs sont des exceptions AgentShieldError (jamais HTTPException directement)
7. Les tags correspondent au nom du fichier
8. Chaque endpoint a au minimum 3 tests
```

## MIDDLEWARE ORDER (dans main.py)

```python
# L'ordre est CRITIQUE — du plus externe au plus interne
app.add_middleware(CORSMiddleware, ...)          # 1. CORS
app.add_middleware(RequestIdMiddleware)           # 2. Request ID
app.add_middleware(RateLimitMiddleware)           # 3. Rate limiting
# Auth est un Depends(), pas un middleware global
# Plan/role checks sont des Depends()
# Budget/guardrail/PII checks sont dans le service layer de POST /v1/track
```
