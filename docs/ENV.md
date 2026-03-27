# ENV.md — Variables d'environnement AgentShield

> Ce fichier liste TOUTES les variables d'environnement du projet. Claude Code le lit avant de configurer un service, créer un .env, ou débugger un problème de connexion.
> Cohérent avec : ARCH.md (stack), DEPLOY.md (déploiement), INTEGRATIONS.md (services tiers)
> Dernière mise à jour : mars 2026

---

## 1. STRUCTURE DES FICHIERS .env

```
agentshield/
├── backend/.env              ← Variables backend (FastAPI + Celery)
├── backend/.env.example      ← Template committé (valeurs vides)
├── frontend/.env.local       ← Variables frontend (Next.js)
├── frontend/.env.example     ← Template committé (valeurs vides)
├── sdk/.env                  ← Variables SDK (dev/test uniquement)
└── sdk/.env.example          ← Template committé
```

**Règles :**
- Les fichiers `.env` ne sont JAMAIS committés (dans .gitignore)
- Les fichiers `.env.example` sont TOUJOURS committés (templates avec valeurs vides)
- Chaque variable a un commentaire dans le .env.example
- Pas de valeur par défaut dans le code pour les secrets — le service crash au démarrage si manquant

---

## 2. BACKEND — FastAPI + Celery

### Application

```bash
# ── App ──────────────────────────────────────────────
APP_ENV=development                    # development | staging | production
APP_DEBUG=true                         # true | false — active les logs détaillés
APP_HOST=0.0.0.0                       # Host du serveur
APP_PORT=8000                          # Port du serveur
APP_WORKERS=1                          # Nombre de workers uvicorn (1 en dev, 4 en prod)
APP_LOG_LEVEL=info                     # debug | info | warning | error

# ── CORS ─────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000     # Origines autorisées, séparées par virgule
                                       # Prod : https://app.agentshield.one
                                       # Staging : https://staging-app.agentshield.one

# ── API Versioning ───────────────────────────────────
API_V1_PREFIX=/v1                      # Préfixe de l'API v1
```

### Supabase

```bash
# ── Supabase ─────────────────────────────────────────
SUPABASE_URL=http://localhost:54321    # URL du projet Supabase
                                       # Prod : https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...              # Clé anonyme (publique, pour le frontend aussi)
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Clé service role (SECRÈTE — backend uniquement)
                                       # Donne accès admin, bypass RLS
SUPABASE_JWT_SECRET=super-secret-jwt  # Secret JWT pour vérifier les tokens
                                       # Trouvé dans Settings > API > JWT Secret
DATABASE_URL=postgresql://...          # Connexion directe PostgreSQL (pour les migrations)
                                       # Format : postgresql://user:pass@host:port/db
```

### Redis

```bash
# ── Redis ────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0     # URL Redis complète
                                       # Prod Railway : redis://default:pass@host:port
REDIS_MAX_CONNECTIONS=20               # Pool de connexions max
REDIS_SSL=false                        # true en production (Railway)
```

### Celery

```bash
# ── Celery ───────────────────────────────────────────
CELERY_BROKER_URL=redis://localhost:6379/1    # Broker (Redis DB 1)
CELERY_RESULT_BACKEND=redis://localhost:6379/2 # Results (Redis DB 2)
CELERY_TASK_ALWAYS_EAGER=false                 # true = exécution synchrone (tests)
CELERY_WORKER_CONCURRENCY=4                    # Nombre de workers
CELERY_TASK_TIME_LIMIT=300                     # Timeout par task en secondes
```

### Stripe

```bash
# ── Stripe ───────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...          # Clé secrète Stripe
                                       # Prod : sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...        # Secret de vérification des webhooks
STRIPE_PRICE_FREE=price_xxx            # Price ID du plan Free (€0)
STRIPE_PRICE_STARTER=price_xxx         # Price ID du plan Starter (€49)
STRIPE_PRICE_PRO=price_xxx             # Price ID du plan Pro (€99)
STRIPE_PRICE_TEAM=price_xxx            # Price ID du plan Team (€199)
```

### Claude API

```bash
# ── Claude API (Smart Alerts + Cost Autopilot) ──────
ANTHROPIC_API_KEY=sk-ant-...           # Clé API Anthropic
ANTHROPIC_MODEL=claude-sonnet-4-6      # Modèle utilisé
ANTHROPIC_MAX_TOKENS=1000              # Tokens max par réponse
ANTHROPIC_TIMEOUT=30                   # Timeout en secondes
```

### Brevo (Email)

```bash
# ── Brevo ────────────────────────────────────────────
BREVO_API_KEY=xkeysib-...             # Clé API Brevo
BREVO_SENDER_EMAIL=alerts@agentshield.one  # Email expéditeur
BREVO_SENDER_NAME=AgentShield          # Nom expéditeur
```

### Slack

```bash
# ── Slack ────────────────────────────────────────────
SLACK_CLIENT_ID=xxxx.xxxx             # OAuth App client ID
SLACK_CLIENT_SECRET=xxxxx             # OAuth App client secret
SLACK_SIGNING_SECRET=xxxxx            # Pour vérifier les requêtes Slack
SLACK_BOT_TOKEN=xoxb-...             # Token du bot (après OAuth install)
```

### Sentry

```bash
# ── Sentry ───────────────────────────────────────────
SENTRY_DSN=https://xxx@sentry.io/xxx  # DSN du projet Sentry
SENTRY_ENVIRONMENT=development         # development | staging | production
SENTRY_TRACES_SAMPLE_RATE=0.1         # % des requêtes tracées (0.1 = 10%)
```

### Sécurité

```bash
# ── Security ─────────────────────────────────────────
API_KEY_HASH_SALT=random-salt-here    # Salt pour le hash des API keys (optionnel, SHA-256 pur sinon)
ENCRYPTION_KEY=32-byte-key-here       # Clé de chiffrement pour les secrets stockés (webhooks, Slack tokens)
RATE_LIMIT_ENABLED=true               # Activer/désactiver le rate limiting (false en tests)
```

---

## 3. FRONTEND — Next.js

```bash
# ── Public (exposées au browser — prefix NEXT_PUBLIC_) ──
NEXT_PUBLIC_APP_URL=http://localhost:3000          # URL de l'app
NEXT_PUBLIC_API_URL=http://localhost:8000           # URL du backend API
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/dashboard # URL WebSocket
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321     # URL Supabase (même que backend)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...               # Clé anonyme Supabase (publique)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...     # Clé publique Stripe
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=agentshield.one        # Domaine Plausible analytics
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx   # DSN Sentry (optionnel côté front)

# ── Private (server-side uniquement) ─────────────────
SUPABASE_SERVICE_ROLE_KEY=eyJ...                   # Pour les Server Components qui ont besoin d'admin access
```

**Règle critique :** Seules les variables préfixées `NEXT_PUBLIC_` sont exposées au browser. JAMAIS de secret dans une variable `NEXT_PUBLIC_`.

---

## 4. SDK — Dev/Test uniquement

```bash
# ── SDK (utilisé uniquement pour les tests du SDK) ───
AGENTSHIELD_API_KEY=ags_live_test_xxx              # Clé API pour les tests
AGENTSHIELD_API_URL=http://localhost:8000           # URL du backend local
AGENTSHIELD_TIMEOUT=10                             # Timeout en secondes
AGENTSHIELD_RETRY_MAX=3                            # Nombre max de retries
AGENTSHIELD_DEBUG=true                             # Active les logs SDK
```

---

## 5. VARIABLES PAR ENVIRONNEMENT

### Development (local)

```bash
APP_ENV=development
APP_DEBUG=true
CORS_ORIGINS=http://localhost:3000
SUPABASE_URL=http://localhost:54321
REDIS_URL=redis://localhost:6379/0
REDIS_SSL=false
STRIPE_SECRET_KEY=sk_test_...
CELERY_TASK_ALWAYS_EAGER=false          # false pour tester les tasks réellement
RATE_LIMIT_ENABLED=false                # Désactivé en dev pour ne pas bloquer
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=1.0          # 100% en dev
```

### Staging

```bash
APP_ENV=staging
APP_DEBUG=false
CORS_ORIGINS=https://staging-app.agentshield.one
SUPABASE_URL=https://xxxx.supabase.co
REDIS_URL=redis://default:pass@staging-redis.railway.internal:6379
REDIS_SSL=true
STRIPE_SECRET_KEY=sk_test_...           # Toujours test mode en staging
RATE_LIMIT_ENABLED=true
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=0.5
```

### Production

```bash
APP_ENV=production
APP_DEBUG=false
APP_WORKERS=4
CORS_ORIGINS=https://app.agentshield.one
SUPABASE_URL=https://xxxx.supabase.co
REDIS_URL=redis://default:pass@prod-redis.railway.internal:6379
REDIS_SSL=true
STRIPE_SECRET_KEY=sk_live_...           # Live mode en prod
RATE_LIMIT_ENABLED=true
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1          # 10% en prod
```

---

## 6. VALIDATION AU DÉMARRAGE

Le backend DOIT valider les variables critiques au démarrage via Pydantic Settings. Si une variable requise manque → crash immédiat avec un message clair.

```python
# app/config.py

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Supabase — REQUIS
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Redis — REQUIS
    redis_url: str

    # Stripe — REQUIS en production
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Claude API — REQUIS pour Smart Alerts / Cost Autopilot
    anthropic_api_key: str = ""

    # Brevo — REQUIS pour les emails
    brevo_api_key: str = ""

    # Slack — Optionnel
    slack_client_id: str = ""
    slack_client_secret: str = ""

    model_config = {"env_file": ".env", "case_sensitive": False}

settings = Settings()
```

### Variables requises par environnement

| Variable | Dev | Staging | Prod |
|----------|-----|---------|------|
| SUPABASE_URL | ✅ | ✅ | ✅ |
| SUPABASE_ANON_KEY | ✅ | ✅ | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ | ✅ |
| SUPABASE_JWT_SECRET | ✅ | ✅ | ✅ |
| REDIS_URL | ✅ | ✅ | ✅ |
| STRIPE_SECRET_KEY | ⬜ | ✅ | ✅ |
| STRIPE_WEBHOOK_SECRET | ⬜ | ✅ | ✅ |
| ANTHROPIC_API_KEY | ⬜ | ✅ | ✅ |
| BREVO_API_KEY | ⬜ | ✅ | ✅ |
| SENTRY_DSN | ⬜ | ✅ | ✅ |
| SLACK_CLIENT_ID | ⬜ | ⬜ | ✅ |
| ENCRYPTION_KEY | ⬜ | ✅ | ✅ |

⬜ = optionnel (feature dégradée gracieusement si absent)
✅ = requis (crash au démarrage si absent)

---

## 7. SECRETS — OÙ LES STOCKER

| Environnement | Stockage |
|----------------|----------|
| Development | `.env` local (gitignored) |
| Staging | Railway environment variables |
| Production | Railway environment variables |
| CI/CD | GitHub Actions secrets |

**Jamais de secret dans :**
- Le code source
- Les commits
- Les logs
- Les messages d'erreur retournés au client
- Les fichiers .env.example

---

> **Règle :** Ce fichier est la référence complète des variables d'environnement.
> Chaque nouvelle variable ajoutée au code DOIT être ajoutée ici ET dans le .env.example correspondant.
