# SKILL-AUTH.md — Comment gérer l'authentification dans AgentShield

> Lire AVANT de toucher à l'auth, aux API keys, aux rôles, ou aux permissions.
> Réfs : SECURITY.md (section 2-4), ENV.md (clés Supabase)

---

## 4 SYSTÈMES D'AUTH

```
1. JWT Supabase   → Dashboard (frontend → backend)
2. API Key        → SDK (POST /v1/track)
3. JWT WebSocket  → Dashboard temps réel
4. Share Token    → Replay public (read-only, pas d'auth)
```

## JWT — VÉRIFICATION

```python
# app/middleware/auth.py

async def get_current_user(authorization: str = Header()) -> User:
    token = authorization.replace("Bearer ", "")

    # Essayer JWT d'abord
    if token.startswith("eyJ"):
        payload = verify_jwt(token)
        user = await get_user_by_id(payload["sub"])
        return user

    # Sinon c'est une API key
    if token.startswith("ags_live_"):
        org = await verify_api_key(token)
        return SystemUser(organization=org)  # Pas un vrai user, mais a une org

    raise AuthenticationError("auth_missing", "Invalid authorization")
```

## API KEY — CYCLE DE VIE

```
Création :
  1. Générer : "ags_live_" + secrets.token_urlsafe(32)[:32]
  2. Hash : SHA-256(full_key)
  3. Stocker en DB : key_hash + key_prefix (ags_live_xxxx)
  4. Retourner full_key UNE SEULE FOIS
  5. Cache Redis : apikey:{hash} → org data (TTL 5min)

Vérification :
  1. Recevoir Bearer ags_live_xxxxx
  2. SHA-256(received_key)
  3. Check Redis cache → si hit, retourner l'org
  4. Check DB → si trouvé et is_active, cache + retourner l'org
  5. Si pas trouvé → 401

Révocation :
  1. SET is_active = false en DB
  2. DELETE apikey:{hash} dans Redis
  3. Immédiat (le cache ne protège pas une clé révoquée grâce au TTL 5min)
```

## RÔLES — VÉRIFICATION

```python
def require_role(minimum_role: str):
    role_levels = {"owner": 3, "admin": 2, "member": 1}

    async def check(user: User = Depends(get_current_user)):
        if role_levels.get(user.role, 0) < role_levels[minimum_role]:
            raise AuthorizationError("role_insufficient", f"Need '{minimum_role}' role")
        return user
    return check

# Usage
@router.post("/api-keys")
async def create_key(user: User = Depends(require_role("admin"))):
    ...
```

## PLANS — VÉRIFICATION

```python
def require_plan(minimum_plan: str):
    plan_levels = {"team": 4, "pro": 3, "starter": 2, "free": 1}

    async def check(org: Organization = Depends(get_current_org)):
        if plan_levels.get(org.plan, 0) < plan_levels[minimum_plan]:
            raise AuthorizationError("plan_required_" + minimum_plan, f"Requires {minimum_plan} plan")
        return org
    return check
```

## MODULE CHECK

```python
def require_module(module: str):
    async def check(org: Organization = Depends(get_current_org)):
        if module not in org.modules_enabled:
            raise AuthorizationError("module_not_enabled", f"Module '{module}' not available")
        return org
    return check

# Usage
@router.get("/sessions")
async def list_sessions(org: Organization = Depends(require_module("replay"))):
    ...
```

## WEBSOCKET AUTH

```python
# Premier message après connexion = {"type": "auth", "token": "eyJ..."}
# Timeout 5s pour le message auth
# Si timeout ou token invalide → fermer connexion code 4001

async def authenticate_ws(websocket: WebSocket) -> User:
    try:
        data = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
        if data.get("type") != "auth":
            await websocket.close(code=4001)
            return None
        user = verify_jwt(data["token"])
        return user
    except asyncio.TimeoutError:
        await websocket.close(code=4001)
        return None
```

## RÈGLES

```
1. Chaque endpoint a un auth check (Depends)
2. API keys hashées SHA-256, jamais en clair en DB
3. JWT dans httpOnly cookie (pas localStorage)
4. Pas de token dans les URLs (sauf share_token qui est conçu pour)
5. Service role key UNIQUEMENT dans le backend
6. Le frontend n'utilise que l'anon key
7. Rate limit sur les endpoints auth (5/min par email)
```
