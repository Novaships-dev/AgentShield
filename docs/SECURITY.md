# SECURITY.md — Sécurité AgentShield

> Ce fichier définit TOUTES les mesures de sécurité du projet. Claude Code le lit avant de toucher à l'auth, aux API keys, au RLS, au CORS, au rate limiting, ou à toute logique qui touche aux données utilisateurs.
> Cohérent avec : ARCH.md (architecture), ENV.md (variables), ERRORS.md (codes erreur)
> Dernière mise à jour : mars 2026

---

## 1. PRINCIPES DE SÉCURITÉ

```
1. Privacy by default    — PII redaction activée dès la création de l'org
2. Least privilege       — Chaque composant n'a accès qu'à ce dont il a besoin
3. Defense in depth      — Plusieurs couches de protection (SDK + middleware + DB)
4. Fail secure           — En cas de doute, refuser l'accès (sauf budget check — fail open)
5. Zero trust            — Chaque requête est authentifiée et autorisée, même interne
6. No secrets in code    — Aucun secret hardcodé, tout dans les variables d'env
7. Immutable audit trail — Les logs d'audit ne sont jamais modifiés ni supprimés
```

---

## 2. AUTHENTIFICATION

### 2.1 — Supabase JWT (Dashboard)

```
Flow :
1. User login via Supabase Auth (email magic link ou Google OAuth)
2. Supabase retourne un JWT signé
3. Le frontend stocke le JWT (httpOnly cookie via Supabase client)
4. Chaque requête API inclut : Authorization: Bearer <jwt>
5. Le backend vérifie le JWT avec SUPABASE_JWT_SECRET
6. Le payload JWT contient : sub (user_id), email, role, exp
```

**Vérification backend :**

```python
# app/middleware/auth.py

import jwt
from app.config import settings

def verify_jwt(token: str) -> dict:
    """Verify and decode a Supabase JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("auth_invalid_token", "Token expired")
    except jwt.InvalidTokenError:
        raise AuthenticationError("auth_invalid_token", "Invalid token")
```

**Règles :**
- JWT expire après 1 heure (Supabase default)
- Refresh token automatique côté client (Supabase SDK gère ça)
- La session globale expire après 7 jours sans activité
- Le JWT n'est JAMAIS stocké dans localStorage (httpOnly cookie uniquement)

### 2.2 — API Keys (SDK)

```
Flow :
1. User crée une API key dans /dashboard/settings
2. Le backend génère : ags_live_ + 32 chars base62 aléatoires
3. La clé complète est affichée UNE SEULE FOIS au user
4. Le backend stocke : SHA-256(clé) en DB + prefix (ags_live_ + 4 premiers chars)
5. Chaque requête SDK inclut : Authorization: Bearer ags_live_xxxxx...
6. Le backend hash la clé reçue et cherche le hash en DB
7. Le résultat est cached dans Redis (TTL 5 min) pour performance
```

**Génération :**

```python
# app/services/api_keys.py

import secrets
import hashlib

def generate_api_key() -> tuple[str, str, str]:
    """Generate an API key. Returns (full_key, key_hash, key_prefix)."""
    random_part = secrets.token_urlsafe(32)[:32]  # 32 chars base62-ish
    full_key = f"ags_live_{random_part}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    key_prefix = full_key[:13]  # "ags_live_xxxx"
    return full_key, key_hash, key_prefix
```

**Vérification :**

```python
async def verify_api_key(key: str) -> Organization:
    """Verify an API key and return the associated organization."""
    key_hash = hashlib.sha256(key.encode()).hexdigest()

    # 1. Check Redis cache
    cached = await redis.get(f"apikey:{key_hash}")
    if cached:
        return Organization.from_cache(cached)

    # 2. Check DB
    result = await db.from_("api_keys").select("*, organizations(*)").eq("key_hash", key_hash).eq("is_active", True).single().execute()

    if not result.data:
        raise AuthenticationError("auth_invalid_api_key", "Invalid API key")

    # 3. Update last_used_at
    await db.from_("api_keys").update({"last_used_at": "now()"}).eq("key_hash", key_hash).execute()

    # 4. Cache in Redis
    await redis.setex(f"apikey:{key_hash}", 300, result.data["organizations"])

    return Organization.from_db(result.data["organizations"])
```

**Règles :**
- La clé n'est JAMAIS affichée après la création (one-time display)
- La clé n'est JAMAIS stockée en clair en DB (SHA-256 hash uniquement)
- La clé n'est JAMAIS loggée (ni dans Sentry, ni dans les logs serveur)
- La révocation est immédiate (cache Redis invalidé)
- Max 5 clés actives par org
- Format : `ags_live_` + 32 chars (total 41 chars)

### 2.3 — WebSocket Auth

```
Flow :
1. Client ouvre la connexion WS : ws://api.agentshield.one/ws/dashboard
2. Premier message : {"type": "auth", "token": "<jwt>"}
3. Le backend vérifie le JWT (même logique que 2.1)
4. Si OK → subscribe au channel Redis ws:{org_id}
5. Si KO → fermer la connexion avec code 4001
```

**Règles :**
- Le token est envoyé dans le premier message, PAS dans l'URL (pas de token dans les logs d'accès)
- Timeout de 5 secondes pour le message auth — si pas reçu → fermer la connexion
- Heartbeat toutes les 30s pour maintenir la connexion

### 2.4 — Share Token (Replay public)

```
Flow :
1. User génère un lien de partage pour une session
2. Le backend génère un token : UUID + 8 chars aléatoires
3. URL publique : https://app.agentshield.one/share/{token}
4. La page share/ vérifie le token en DB
5. Si valide et non expiré → afficher la session en read-only
6. PII TOUJOURS redacté dans la vue partagée (même si store_original=true)
```

**Règles :**
- Pas de JWT requis pour les share links (c'est le but — accès sans compte)
- Le token est non prédictible (UUID + 8 chars aléatoires = 44 chars)
- Expiration configurable (1h, 24h, 7j, jamais)
- La vue partagée n'a AUCUN accès au reste du dashboard
- Pas d'informations sensibles dans l'URL (pas d'org_id, pas de session_id)

---

## 3. ROW LEVEL SECURITY (RLS) — SUPABASE

### Principe
Chaque table a RLS activé. Chaque requête ne retourne que les données de l'organisation de l'utilisateur authentifié. Même si le backend a un bug, la DB ne leak jamais de données cross-org.

### Policies par table

```sql
-- ============================================================
-- PATTERN COMMUN : l'utilisateur ne voit que son org
-- ============================================================

-- Helper function
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS UUID AS $$
    SELECT organization_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── organizations ────────────────────────────────────
CREATE POLICY "select_own_org" ON organizations
    FOR SELECT USING (id = auth.user_org_id());

CREATE POLICY "update_own_org" ON organizations
    FOR UPDATE USING (id = auth.user_org_id())
    WITH CHECK (id = auth.user_org_id());

-- ── users ────────────────────────────────────────────
CREATE POLICY "select_own_org_users" ON users
    FOR SELECT USING (organization_id = auth.user_org_id());

CREATE POLICY "insert_own_org_users" ON users
    FOR INSERT WITH CHECK (organization_id = auth.user_org_id());

CREATE POLICY "update_own_org_users" ON users
    FOR UPDATE USING (organization_id = auth.user_org_id());

-- ── agents ───────────────────────────────────────────
CREATE POLICY "all_own_org_agents" ON agents
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── events ───────────────────────────────────────────
CREATE POLICY "select_own_org_events" ON events
    FOR SELECT USING (organization_id = auth.user_org_id());

CREATE POLICY "insert_own_org_events" ON events
    FOR INSERT WITH CHECK (organization_id = auth.user_org_id());
-- Pas de UPDATE ni DELETE sur events (immutables)

-- ── sessions ─────────────────────────────────────────
CREATE POLICY "all_own_org_sessions" ON sessions
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── shared_sessions ──────────────────────────────────
CREATE POLICY "all_own_org_shared" ON shared_sessions
    FOR ALL USING (organization_id = auth.user_org_id());

-- Policy spéciale pour l'accès public via share_token
CREATE POLICY "public_share_access" ON shared_sessions
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- ── aggregations_hourly / aggregations_daily ─────────
CREATE POLICY "select_own_org_agg_hourly" ON aggregations_hourly
    FOR SELECT USING (organization_id = auth.user_org_id());

CREATE POLICY "select_own_org_agg_daily" ON aggregations_daily
    FOR SELECT USING (organization_id = auth.user_org_id());

-- ── alert_rules ──────────────────────────────────────
CREATE POLICY "all_own_org_alert_rules" ON alert_rules
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── alert_history ────────────────────────────────────
CREATE POLICY "select_own_org_alert_history" ON alert_history
    FOR SELECT USING (organization_id = auth.user_org_id());

-- ── budget_caps ──────────────────────────────────────
CREATE POLICY "all_own_org_budget_caps" ON budget_caps
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── anomaly_baselines ────────────────────────────────
CREATE POLICY "all_own_org_anomaly" ON anomaly_baselines
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── guardrail_rules ──────────────────────────────────
CREATE POLICY "all_own_org_guardrails" ON guardrail_rules
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── guardrail_violations ─────────────────────────────
CREATE POLICY "select_own_org_violations" ON guardrail_violations
    FOR SELECT USING (organization_id = auth.user_org_id());

-- ── pii_configs ──────────────────────────────────────
CREATE POLICY "all_own_org_pii" ON pii_configs
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── api_keys ─────────────────────────────────────────
CREATE POLICY "all_own_org_api_keys" ON api_keys
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── webhook_endpoints ────────────────────────────────
CREATE POLICY "all_own_org_webhooks" ON webhook_endpoints
    FOR ALL USING (organization_id = auth.user_org_id());

-- ── webhook_deliveries ───────────────────────────────
CREATE POLICY "select_own_org_deliveries" ON webhook_deliveries
    FOR SELECT USING (
        endpoint_id IN (
            SELECT id FROM webhook_endpoints
            WHERE organization_id = auth.user_org_id()
        )
    );

-- ── audit_log ────────────────────────────────────────
CREATE POLICY "select_own_org_audit" ON audit_log
    FOR SELECT USING (organization_id = auth.user_org_id());
-- Pas de UPDATE ni DELETE sur audit_log (immutable)
```

### Accès service role (backend)
Le backend utilise `SUPABASE_SERVICE_ROLE_KEY` pour les opérations qui bypass RLS :
- Ingestion d'events via API key (pas de JWT user, donc pas d'auth.uid())
- Celery tasks (agrégation, alertes, cleanup)
- Création d'org au signup

**Règle critique :** Le service role est utilisé UNIQUEMENT dans le backend. JAMAIS dans le frontend. JAMAIS dans le SDK.

---

## 4. RÔLES ET PERMISSIONS

### Rôles

| Rôle | Qui | Quantité par org |
|------|-----|------------------|
| owner | Créateur de l'org | Exactement 1 |
| admin | Invité avec droits élevés | 0+ |
| member | Invité lecture + tracking | 0+ |

### Matrice de permissions

| Action | owner | admin | member |
|--------|-------|-------|--------|
| Voir le dashboard | ✅ | ✅ | ✅ |
| Envoyer des events (SDK) | ✅ | ✅ | ✅ |
| Voir les sessions Replay | ✅ | ✅ | ✅ |
| Voir les contenus non-redactés | ✅ | ✅ | ❌ |
| Créer/modifier alert rules | ✅ | ✅ | ❌ |
| Créer/modifier budget caps | ✅ | ✅ | ❌ |
| Activer/désactiver kill switch | ✅ | ✅ | ❌ |
| Configurer guardrails | ✅ | ✅ | ❌ |
| Configurer PII | ✅ | ✅ | ❌ |
| Créer/révoquer API keys | ✅ | ✅ | ❌ |
| Configurer webhooks | ✅ | ✅ | ❌ |
| Générer share links | ✅ | ✅ | ❌ |
| Voir l'audit log | ✅ | ✅ | ❌ |
| Inviter des membres | ✅ | ✅ | ❌ |
| Changer le rôle d'un membre | ✅ | ✅ | ❌ |
| Retirer un membre | ✅ | ✅ | ❌ |
| Gérer le billing | ✅ | ❌ | ❌ |
| Changer le plan | ✅ | ❌ | ❌ |
| Activer compliance mode | ✅ | ❌ | ❌ |
| Supprimer l'org | ✅ | ❌ | ❌ |
| Transférer ownership | ✅ | ❌ | ❌ |

### Vérification dans le code

```python
# app/dependencies.py

def require_role(minimum_role: str):
    """Dependency that checks user role."""
    role_hierarchy = {"owner": 3, "admin": 2, "member": 1}

    async def checker(user: User = Depends(get_current_user)):
        if role_hierarchy.get(user.role, 0) < role_hierarchy.get(minimum_role, 0):
            raise AuthorizationError(
                "role_insufficient",
                f"You need '{minimum_role}' role to perform this action.",
                details={"current_role": user.role, "required_role": minimum_role},
            )
        return user
    return checker

# Usage
@router.post("/v1/api-keys")
async def create_api_key(user: User = Depends(require_role("admin"))):
    ...
```

---

## 5. RATE LIMITING

### Configuration par plan

| Plan | POST /v1/track | Dashboard API | WebSocket msgs | Auth endpoints |
|------|----------------|---------------|----------------|----------------|
| Free | 100/min | 30/min | 10/min | 5/min |
| Starter | 500/min | 60/min | 30/min | 10/min |
| Pro | 2000/min | 120/min | 60/min | 10/min |
| Team | 5000/min | 200/min | 120/min | 10/min |
| Unauthenticated | — | — | — | 5/min par IP |

### Implémentation Redis sliding window

```python
# app/middleware/rate_limit.py

async def check_rate_limit(
    org_id: str,
    endpoint: str,
    limit: int,
    window_seconds: int = 60,
) -> tuple[int, int, int]:
    """Check rate limit. Returns (limit, remaining, reset_timestamp)."""
    key = f"ratelimit:{org_id}:{endpoint}:{int(time.time()) // window_seconds}"

    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds)
    results = await pipe.execute()

    current = results[0]
    remaining = max(0, limit - current)
    reset = (int(time.time()) // window_seconds + 1) * window_seconds

    if current > limit:
        raise RateLimitError(
            limit=limit,
            remaining=0,
            reset=reset,
            retry_after=reset - int(time.time()),
        )

    return limit, remaining, reset
```

### Anti-brute-force (auth endpoints)
- 5 tentatives par email par heure
- Après 5 échecs → blocage 15 minutes pour cet email
- Le compteur est par IP + email (pas seulement email)

---

## 6. CORS

```python
# app/main.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-AGS-Request-Id",
        "X-AGS-Plan",
    ],
    max_age=3600,
)
```

**Par environnement :**
- Dev : `http://localhost:3000`
- Staging : `https://staging-app.agentshield.one`
- Prod : `https://app.agentshield.one`

**Jamais** `*` en production.

---

## 7. PII — PROTECTION DES DONNÉES

### Principe : Privacy by default

```
1. PII redaction est ACTIVÉE par défaut pour toute nouvelle org
2. Les inputs/outputs sont scannés AVANT stockage
3. store_original = false par défaut (les textes bruts ne sont PAS stockés)
4. Le user doit explicitement opt-in pour garder les contenus bruts
5. Double redaction : SDK (avant envoi) + serveur (avant stockage)
```

### Patterns PII (voir aussi PROTECT.md)

| Pattern | Regex simplifié | Remplacement |
|---------|----------------|-------------|
| email | `[\w.-]+@[\w.-]+\.\w+` | `[REDACTED:email]` |
| phone | `\+?[\d\s\-().]{7,20}` | `[REDACTED:phone]` |
| credit_card | `\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b` (+ Luhn) | `[REDACTED:cc]` |
| ssn | `\b\d{3}-\d{2}-\d{4}\b` | `[REDACTED:ssn]` |
| ip_address | `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` | `[REDACTED:ip]` |

### Stockage

```
events table :
├── input_text       → NULL si store_original=false, texte brut sinon
├── output_text      → NULL si store_original=false, texte brut sinon
├── input_redacted   → TOUJOURS rempli (version nettoyée)
└── output_redacted  → TOUJOURS rempli (version nettoyée)
```

### Accès aux contenus bruts
- Uniquement si store_original=true ET rôle owner ou admin
- Jamais dans les share links (toujours redacté)
- Jamais dans les exports PDF
- Jamais dans les webhooks sortants

---

## 8. CHIFFREMENT

### En transit
- HTTPS obligatoire partout (TLS 1.2+ via Cloudflare)
- WSS pour les WebSockets en production
- API key envoyée dans le header Authorization, pas dans l'URL

### Au repos
- Supabase chiffre les données at rest (AES-256)
- Les API keys sont hashées (SHA-256), pas chiffrées (irréversible)
- Les Slack tokens et webhook secrets sont chiffrés avec ENCRYPTION_KEY (AES-256-GCM)

```python
# app/utils/encryption.py

from cryptography.fernet import Fernet

def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret for storage."""
    f = Fernet(settings.encryption_key)
    return f.encrypt(plaintext.encode()).decode()

def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a stored secret."""
    f = Fernet(settings.encryption_key)
    return f.decrypt(ciphertext.encode()).decode()
```

---

## 9. WEBHOOKS — SÉCURITÉ

### Webhooks entrants (Stripe)
- Vérification de la signature Stripe sur chaque webhook
- `stripe.Webhook.construct_event(payload, sig_header, webhook_secret)`
- Rejet immédiat si la signature ne matche pas
- Idempotence : vérifier que l'event n'a pas déjà été traité (event ID)

### Webhooks sortants (vers les clients)
- Chaque payload est signé avec HMAC SHA-256
- Le secret est unique par endpoint (généré à la création)
- Le client vérifie : `X-AGS-Signature: sha256=<hmac>`
- Le timestamp est inclus : `X-AGS-Timestamp` (protection contre replay attacks)
- Fenêtre de validation : 5 minutes (rejeter les requêtes plus anciennes)

```python
# app/services/webhooks.py

import hmac
import hashlib
import time

def sign_webhook_payload(payload: str, secret: str) -> tuple[str, int]:
    """Sign a webhook payload. Returns (signature, timestamp)."""
    timestamp = int(time.time())
    message = f"{timestamp}.{payload}"
    signature = hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={signature}", timestamp
```

---

## 10. PROTECTION CONTRE LES ATTAQUES

### Injection SQL
- Supabase client utilise des requêtes paramétrées (pas de SQL brut)
- RLS comme couche de protection supplémentaire
- Pas de construction de requêtes SQL par concaténation de strings

### XSS
- Next.js escape automatiquement les données dans le JSX
- Les contenus Replay (inputs/outputs) sont affichés dans des `<pre>` avec escape
- Pas de `dangerouslySetInnerHTML` sauf nécessité absolue (et sanitize avec DOMPurify)

### CSRF
- SameSite=Lax sur les cookies Supabase
- CORS restrictif
- Token CSRF non nécessaire car l'API utilise des Bearer tokens (pas des cookies pour l'auth API)

### Timing attacks sur les API keys
- Comparaison par hash (SHA-256) → timing constant
- Pas de comparaison directe de strings

### Denial of Service
- Rate limiting par plan
- Payload max : 1MB par requête
- Timeout : 30s par requête
- Redis connection pool limité
- Celery task timeout : 5 minutes max

---

## 11. AUDIT ET COMPLIANCE

### Audit log (plan Team)
- Chaque action administrative est loggée
- Les entrées sont immutables (pas de UPDATE, pas de DELETE)
- Rétention : 1 an
- Contenu : user, action, resource_type, resource_id, details, ip_address, timestamp

### Compliance mode (plan Team)
- Quand activé : TOUS les events sont stockés de manière immuable
- Pas de soft delete possible sur les events
- Les exports GDPR sont disponibles
- Le compliance mode ne peut PAS être désactivé une fois activé

### GDPR
- Export des données utilisateur disponible (plan Team)
- Suppression du compte disponible (supprime l'org et toutes les données)
- PII redaction par défaut
- Pas de tracking de données personnelles sans consentement
- Les données de démo ne contiennent PAS de vraies données personnelles

---

## 12. CHECKLIST SÉCURITÉ — AVANT CHAQUE DEPLOY

```
□ RLS activé sur toutes les tables (19 tables)
□ Policies RLS testées (un user ne voit pas les données d'une autre org)
□ Chaque endpoint a un middleware auth
□ Chaque endpoint a un rate limiter
□ Chaque endpoint vérifie le plan
□ Chaque endpoint vérifie le rôle (si nécessaire)
□ Les API keys sont hashées en DB
□ PII redaction fonctionne sur tous les patterns
□ CORS configuré pour l'environnement cible
□ Pas de secrets dans les logs
□ Pas de secrets dans les réponses d'erreur
□ Webhook Stripe signé et vérifié
□ Webhooks sortants signés avec HMAC
□ HTTPS/WSS en staging et production
□ Sentry configuré (mais pas de données sensibles dans les breadcrumbs)
□ Pas de SUPABASE_SERVICE_ROLE_KEY dans le frontend
□ Pas de tokens dans les URLs
□ rate_limit_enabled=true en staging et production
```

---

> **Règle :** La sécurité n'est pas négociable. Chaque shortcut de sécurité est une dette qui peut tuer le produit.
> Si une feature nécessite de contourner une mesure de sécurité → discuter AVANT d'implémenter.
