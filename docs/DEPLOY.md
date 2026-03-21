# DEPLOY.md — Configuration de déploiement AgentShield

> Ce fichier définit comment déployer chaque composant du projet, de la config locale au CI/CD en production. Claude Code le lit avant de toucher au déploiement, aux Dockerfiles, ou aux GitHub Actions.
> Cohérent avec : ARCH.md (infrastructure), ENV.md (variables), QUEUE.md (Celery workers)
> Dernière mise à jour : mars 2026

---

## 1. VUE D'ENSEMBLE DE L'INFRASTRUCTURE

```
┌──────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE (DNS)                         │
│                                                              │
│  agentshield.io          → Vercel (landing)                  │
│  app.agentshield.io      → Vercel (frontend app)             │
│  api.agentshield.io      → Railway (backend FastAPI)         │
│  docs.agentshield.io     → Vercel (documentation)            │
└──────────────────────────────────────────────────────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   VERCEL     │  │   RAILWAY    │  │  SUPABASE    │
│              │  │              │  │              │
│  Frontend    │  │  Backend     │  │  PostgreSQL  │
│  Next.js 14  │  │  FastAPI     │  │  Auth        │
│              │  │              │  │  RLS         │
│              │  │  Celery      │  │              │
│              │  │  Worker      │  │              │
│              │  │              │  │              │
│              │  │  Celery      │  │              │
│              │  │  Beat        │  │              │
│              │  │              │  │              │
│              │  │  Redis       │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Services et leur rôle

| Service | Plateforme | Rôle | Scaling |
|---------|-----------|------|---------|
| Frontend | Vercel | Next.js SSR + static | Auto (Vercel Edge) |
| Backend API | Railway | FastAPI uvicorn | Manual (1-4 instances) |
| Celery Worker | Railway | Tasks async | Manual (1-2 instances) |
| Celery Beat | Railway | Scheduler tasks périodiques | 1 instance uniquement |
| Redis | Railway | Cache + broker + pub/sub | 1 instance (plan Railway) |
| PostgreSQL | Supabase | DB + Auth + RLS | Managed (Supabase plan) |
| DNS + CDN | Cloudflare | DNS, SSL, protection DDoS | Auto |
| Monitoring | Sentry | Error tracking | Managed |
| Email | Brevo | Transactional emails | Managed |
| Analytics | Plausible | Privacy-first analytics | Managed |

---

## 2. DÉVELOPPEMENT LOCAL

### Prérequis

```bash
# Versions requises
python >= 3.12
node >= 20
redis-server (ou Docker)
supabase CLI
```

### Setup initial

```bash
# 1. Cloner le repo
git clone https://github.com/NovaShips/agentshield.git
cd agentshield

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# → Remplir les variables dans .env

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env.local
# → Remplir les variables dans .env.local

# 4. SDK
cd ../sdk
pip install -e ".[dev]"

# 5. Supabase local
supabase start
# → URL locale : http://localhost:54321
# → Anon key et service role key affichées dans le terminal

# 6. Redis local
redis-server
# → Ou via Docker : docker run -d -p 6379:6379 redis:7-alpine

# 7. Appliquer les migrations
supabase db reset
```

### Démarrer les services

```bash
# Terminal 1 — Backend API
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Celery Worker
cd backend
celery -A app.workers.celery_app worker --loglevel=info

# Terminal 3 — Celery Beat (scheduler)
cd backend
celery -A app.workers.celery_app beat --loglevel=info

# Terminal 4 — Frontend
cd frontend
npm run dev
# → http://localhost:3000
```

### Codespace (GitHub)

Le `.devcontainer/devcontainer.json` configure automatiquement :
- Python 3.12 + Node 20 + Redis
- Ports forwarded : 8000 (API), 3000 (Frontend), 6379 (Redis)
- Extensions VS Code : Python, Ruff, ESLint, Prettier, Tailwind

```bash
# Dans un Codespace, lancer directement :
supabase start
cd backend && uvicorn app.main:app --reload --port 8000 &
cd frontend && npm run dev &
```

---

## 3. BACKEND — RAILWAY

### Configuration Railway

```
Project : agentshield
Services :
  1. agentshield-api      (Backend FastAPI)
  2. agentshield-worker   (Celery Worker)
  3. agentshield-beat     (Celery Beat)
  4. agentshield-redis    (Redis)
```

### Dockerfile — Backend API

```dockerfile
# backend/Dockerfile

FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# App code
COPY app/ app/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')"

# Run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Dockerfile — Celery Worker

```dockerfile
# backend/Dockerfile.worker

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY app/ app/

CMD ["celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info", "--concurrency=4"]
```

### Dockerfile — Celery Beat

```dockerfile
# backend/Dockerfile.beat

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY app/ app/

CMD ["celery", "-A", "app.workers.celery_app", "beat", "--loglevel=info"]
```

### Railway settings par service

**agentshield-api :**
```
Builder: Dockerfile
Dockerfile Path: backend/Dockerfile
Port: 8000
Health Check Path: /health
Restart Policy: Always
Custom Domain: api.agentshield.io
```

**agentshield-worker :**
```
Builder: Dockerfile
Dockerfile Path: backend/Dockerfile.worker
No port exposed (worker only)
Restart Policy: Always
```

**agentshield-beat :**
```
Builder: Dockerfile
Dockerfile Path: backend/Dockerfile.beat
No port exposed (scheduler only)
Restart Policy: Always
Replicas: 1 (JAMAIS plus — sinon les tasks scheduled se dupliquent)
```

**agentshield-redis :**
```
Template: Redis
Plan: Starter ($5/month) ou Pro selon besoin
Persistence: Enabled (AOF)
Max Memory: 256MB (starter) / 1GB (pro)
```

### Variables d'environnement Railway

Toutes les variables de ENV.md section "Backend" sont configurées dans Railway > Service > Variables. Railway les injecte automatiquement au runtime.

**Variable spéciale Railway :**
```bash
RAILWAY_ENVIRONMENT=production    # Auto-set par Railway
PORT=8000                         # Auto-set par Railway
```

### Health check endpoint

```python
# app/main.py

@app.get("/health")
async def health_check():
    """Health check for Railway."""
    checks = {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {}
    }

    # Check Redis
    try:
        await redis.ping()
        checks["services"]["redis"] = "ok"
    except Exception:
        checks["services"]["redis"] = "error"
        checks["status"] = "degraded"

    # Check Supabase
    try:
        await db.from_("organizations").select("id").limit(1).execute()
        checks["services"]["database"] = "ok"
    except Exception:
        checks["services"]["database"] = "error"
        checks["status"] = "degraded"

    status_code = 200 if checks["status"] == "ok" else 503
    return JSONResponse(content=checks, status_code=status_code)
```

---

## 4. FRONTEND — VERCEL

### Configuration Vercel

```
Project: agentshield-app
Framework: Next.js
Root Directory: frontend
Build Command: npm run build
Output Directory: .next
Node.js Version: 20.x
```

### Domains Vercel

```
app.agentshield.io         → Frontend app (dashboard)
agentshield.io             → Landing page (même deploy, route /)
staging-app.agentshield.io → Preview branch
```

### next.config.js

```javascript
// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Rewrites pour proxy API en dev (évite les problèmes CORS)
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/:path*",
        },
      ];
    }
    return [];
  },

  // Headers de sécurité
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  // Images (si besoin d'images externes)
  images: {
    domains: [],
  },
};

module.exports = nextConfig;
```

### Variables d'environnement Vercel

Configurées dans Vercel > Project > Settings > Environment Variables. Séparées par environnement (Production, Preview, Development).

```
NEXT_PUBLIC_APP_URL=https://app.agentshield.io
NEXT_PUBLIC_API_URL=https://api.agentshield.io
NEXT_PUBLIC_WS_URL=wss://api.agentshield.io/ws/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=agentshield.io
```

---

## 5. SUPABASE

### Configuration

```
Project: agentshield-prod
Region: EU West (Paris) — le plus proche des users cibles
Plan: Free tier au lancement → Pro quand > 500 users
```

### Migrations en production

```bash
# Lier au projet prod
supabase link --project-ref <project-id>

# Vérifier les migrations en attente
supabase migration list

# Appliquer
supabase db push

# Vérifier
supabase db diff  # Doit retourner vide si tout est synchronisé
```

### Backup
- Supabase Pro : backups automatiques quotidiens (7 jours rétention)
- Supabase Free : pas de backup auto → voir BACKUP.md pour la stratégie manuelle

---

## 6. CI/CD — GITHUB ACTIONS

### Pipeline Backend

```yaml
# .github/workflows/ci-backend.yml

name: Backend CI

on:
  push:
    paths:
      - "backend/**"
      - ".github/workflows/ci-backend.yml"
  pull_request:
    paths:
      - "backend/**"

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        working-directory: backend
        run: pip install -e ".[dev]"

      - name: Lint (Ruff)
        working-directory: backend
        run: |
          ruff check .
          ruff format --check .

      - name: Type check (mypy)
        working-directory: backend
        run: mypy app/ --ignore-missing-imports

      - name: Tests
        working-directory: backend
        env:
          APP_ENV: test
          REDIS_URL: redis://localhost:6379/0
          CELERY_TASK_ALWAYS_EAGER: "true"
          SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_KEY }}
          SUPABASE_JWT_SECRET: ${{ secrets.SUPABASE_TEST_JWT_SECRET }}
        run: pytest tests/ -v --cov=app --cov-report=term-missing

      - name: Coverage check
        working-directory: backend
        run: pytest tests/ --cov=app --cov-fail-under=80
```

### Pipeline Frontend

```yaml
# .github/workflows/ci-frontend.yml

name: Frontend CI

on:
  push:
    paths:
      - "frontend/**"
      - ".github/workflows/ci-frontend.yml"
  pull_request:
    paths:
      - "frontend/**"

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Lint (ESLint)
        working-directory: frontend
        run: npm run lint

      - name: Type check (TypeScript)
        working-directory: frontend
        run: npx tsc --noEmit

      - name: Build
        working-directory: frontend
        env:
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          NEXT_PUBLIC_API_URL: http://localhost:8000
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-key
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_xxx
        run: npm run build
```

### Pipeline SDK

```yaml
# .github/workflows/ci-sdk.yml

name: SDK CI

on:
  push:
    paths:
      - "sdk/**"
      - ".github/workflows/ci-sdk.yml"
  pull_request:
    paths:
      - "sdk/**"

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        working-directory: sdk
        run: pip install -e ".[dev]"

      - name: Lint
        working-directory: sdk
        run: ruff check . && ruff format --check .

      - name: Tests
        working-directory: sdk
        run: pytest tests/ -v --cov=agentshield --cov-report=term-missing
```

### Deploy Backend (Railway auto-deploy)

```yaml
# .github/workflows/deploy-backend.yml

name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - "backend/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [] # Ajouter "test" job en dépendance quand CI est prêt

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: agentshield-api
```

### Publish SDK (PyPI)

```yaml
# .github/workflows/publish-sdk.yml

name: Publish SDK

on:
  push:
    tags:
      - "sdk-v*"    # Déclenché par : git tag sdk-v0.1.0 && git push --tags

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install build tools
        run: pip install build twine

      - name: Build package
        working-directory: sdk
        run: python -m build

      - name: Publish to PyPI
        working-directory: sdk
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
        run: twine upload dist/*
```

---

## 7. DOMAINES — CLOUDFLARE

### Configuration DNS

| Record | Type | Name | Content | Proxy |
|--------|------|------|---------|-------|
| A | agentshield.io | Vercel IP | ☁️ Proxied |
| CNAME | app | cname.vercel-dns.com | ☁️ Proxied |
| CNAME | api | railway-app-xxx.up.railway.app | ☁️ Proxied |
| CNAME | docs | cname.vercel-dns.com | ☁️ Proxied |
| CNAME | staging-app | cname.vercel-dns.com | ☁️ Proxied |
| CNAME | staging-api | railway-app-xxx.up.railway.app | ☁️ Proxied |

### Cloudflare settings
- SSL/TLS : Full (strict)
- Always Use HTTPS : On
- Minimum TLS Version : 1.2
- Auto Minify : Off (Next.js gère ça)
- Caching : respecter les Cache-Control headers des origins
- WAF : activé, règles par défaut

---

## 8. STRATÉGIE DE DÉPLOIEMENT

### Workflow normal

```
1. Push sur main
2. GitHub Actions CI lance (lint + tests)
3. Si CI passe :
   - Backend : Railway auto-deploy (build Docker + deploy)
   - Frontend : Vercel auto-deploy (build Next.js + deploy Edge)
4. Les migrations DB sont appliquées MANUELLEMENT avant le deploy :
   supabase db push
```

### Ordre de déploiement pour un changement breaking

```
1. Appliquer les migrations DB (supabase db push)
   → La DB est backward-compatible avec l'ancien code
2. Deploy le backend
   → Le nouveau code utilise le nouveau schéma
3. Deploy le frontend
   → Le nouveau frontend utilise les nouveaux endpoints
4. Vérifier en production
   → Health check, smoke tests, Sentry
```

### Rollback

```
Backend (Railway) :
  → Railway > Service > Deployments > Redeploy previous
  → Instantané, Railway garde les 10 derniers deployments

Frontend (Vercel) :
  → Vercel > Project > Deployments > Promote to Production
  → Instantané, Vercel garde tous les deployments

Database :
  → Pas de rollback auto — écrire une migration corrective
  → Voir MIGRATIONS.md section Rollback

Redis :
  → Pas de rollback nécessaire (cache auto-expire)
  → Si problème → FLUSHDB (perte de cache, pas de données)
```

---

## 9. MONITORING POST-DEPLOY

### Vérifications immédiates (< 5 minutes après deploy)

```bash
# 1. Health check backend
curl https://api.agentshield.io/health

# 2. Vérifier que le frontend charge
curl -I https://app.agentshield.io

# 3. Vérifier que les WebSocket fonctionnent
# → Ouvrir le dashboard, vérifier la connexion WS dans DevTools

# 4. Vérifier Sentry
# → Pas de nouvelles erreurs dans les 5 minutes post-deploy

# 5. Vérifier que Celery worker est connecté
# → Railway > agentshield-worker > Logs > "ready" message
```

### Smoke tests post-deploy

```
□ Landing page charge (< 2s)
□ Login fonctionne (email magic link OU Google OAuth)
□ Dashboard affiche les données
□ POST /v1/track accepte un event
□ L'event apparaît dans le dashboard (WebSocket)
□ Les alertes se déclenchent (si test org configurée)
□ Stripe Checkout fonctionne (en test mode)
```

---

## 10. SCALING

### Quand scaler ?

| Signal | Action |
|--------|--------|
| API latency p95 > 200ms | Ajouter un worker uvicorn (APP_WORKERS++) |
| Celery queue > 100 tasks pending | Ajouter un worker Celery |
| Redis memory > 80% | Upgrader le plan Railway Redis |
| DB connections > 80% pool | Upgrader le plan Supabase |
| Frontend TTFB > 500ms | Vérifier Vercel Edge (normalement auto) |

### Capacité estimée au lancement

```
1 instance backend (4 workers uvicorn) :
  → 5000 req/s POST /v1/track
  → Suffisant pour ~100 clients Starter

1 instance Celery worker (4 concurrency) :
  → 50 tasks/s
  → Suffisant pour alertes + agrégation + anomaly

Redis 256MB :
  → ~500K clés
  → Suffisant pour ~100 orgs actives

Supabase Free :
  → 500MB storage, 50K rows/table estimated
  → Suffisant pour les premiers mois
  → Migrer vers Pro quand > 50 clients payants
```

---

> **Règle :** Le déploiement doit être reproductible. Si on doit recréer l'infra from scratch, ce fichier + ENV.md + MIGRATIONS.md suffisent.
> Pas de configuration manuelle non documentée. Si tu changes un setting dans Railway/Vercel → le documenter ici.
