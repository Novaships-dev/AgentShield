# SKILL-DEPLOY.md — Comment déployer AgentShield

> Lire AVANT de toucher au déploiement, aux Dockerfiles, ou au CI/CD. Réfs : DEPLOY.md

---

## SERVICES

```
Railway : agentshield-api (Dockerfile), agentshield-worker (Dockerfile.worker), agentshield-beat (Dockerfile.beat), Redis
Vercel  : frontend Next.js (auto-deploy depuis main)
Supabase: migrations via supabase db push
```

## ORDRE DE DEPLOY (changement breaking)

```
1. supabase db push (migrations d'abord)
2. Deploy backend (Railway auto ou manual)
3. Deploy frontend (Vercel auto)
4. Smoke tests (/health, dashboard, POST /v1/track)
```

## ROLLBACK

```
Backend  : Railway > Deployments > Redeploy previous
Frontend : Vercel > Deployments > Promote previous
DB       : Écrire une migration corrective (forward-only)
Redis    : FLUSHDB si nécessaire (cache se reconstruit)
```

## CI/CD

```
Push sur main :
  → ci-backend.yml (lint + tests) → deploy si pass
  → ci-frontend.yml (lint + type check + build) → Vercel auto-deploy
  → ci-sdk.yml (lint + tests) si sdk/ modifié

Tag sdk-v* :
  → publish-sdk.yml → PyPI
```

## RÈGLES

```
1. Jamais de deploy en prod sans tests CI verts
2. Migrations DB AVANT le deploy backend
3. Beat = EXACTEMENT 1 instance (jamais 2)
4. Les env vars sont dans Railway/Vercel, jamais hardcodées
5. Tester en staging avant prod pour les changements majeurs
```
