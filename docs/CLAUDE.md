# CLAUDE.md — Instructions Claude Code pour AgentShield

> Ce fichier est lu EN PREMIER par Claude Code à chaque session.
> Il définit les règles, le contexte, et les reflexes à avoir sur ce projet.
> Ne jamais contredire ce fichier. Si un doute existe, demander avant d'agir.

---

## RÈGLE 0 — SYNC OBLIGATOIRE

Avant chaque tâche :
```bash
git pull origin main
```

Après chaque modification :
```bash
git add .
git commit -m "[type]: [description courte]"
git push origin main
```

Ne jamais laisser de modifications en local sans push. Chaque tâche = un commit = un push.

---

## LE PROJET EN 30 SECONDES

**AgentShield** — "The complete observability suite for AI agents."

3 modules, 1 SDK, 1 ligne de code :
- **Monitor** : track coûts temps réel, smart alerts, forecast, cost autopilot
- **Replay** : timeline step-by-step de chaque session agent pour debug
- **Protect** : guardrails, PII redaction, budget caps, kill switch

Stack : FastAPI (Python 3.12) + Next.js 14 + Supabase + Redis/Celery + Stripe + Railway/Vercel

Tool #1 de Nova (@NovaShips). Domaine : agentshield.one

---

## STRUCTURE DU REPO

```
agentshield/
├── docs/           ← 28 fichiers de documentation (source de vérité)
├── skills/         ← 21 skills Claude Code (instructions spécialisées)
├── backend/        ← FastAPI — Python 3.12+
├── frontend/       ← Next.js 14 + TypeScript + Tailwind + shadcn/ui
├── sdk/            ← SDK Python — package PyPI "agentshield"
├── .github/        ← CI/CD workflows
├── .devcontainer/  ← Config Codespace
└── README.md
```

---

## QUEL FICHIER LIRE AVANT CHAQUE TÂCHE

| Tu dois... | Lis d'abord... |
|------------|----------------|
| Comprendre le projet | docs/CONTEXT.md |
| Coder un endpoint | docs/ARCH.md → docs/API.md → docs/CONVENTIONS.md |
| Coder une feature | docs/SPEC.md (section correspondante) |
| Coder le SDK | docs/SDK.md → skills/SKILL-SDK-PYTHON.md |
| Coder le frontend | docs/UI.md → skills/SKILL-NEXTJS.md |
| Coder le module Replay | docs/REPLAY.md → skills/SKILL-REPLAY.md |
| Coder le module Protect | docs/PROTECT.md → skills/SKILL-GUARDRAILS.md + skills/SKILL-PII-REDACTION.md |
| Coder une intégration framework | docs/FRAMEWORKS.md → skills/SKILL-FRAMEWORK-INTEGRATIONS.md |
| Toucher à la DB | docs/ARCH.md (section 3) → docs/MIGRATIONS.md |
| Toucher à l'auth | docs/SECURITY.md → skills/SKILL-AUTH.md |
| Toucher à Stripe | docs/INTEGRATIONS.md → skills/SKILL-STRIPE.md |
| Toucher à Celery/Redis | docs/QUEUE.md → skills/SKILL-CELERY.md |
| Toucher au WebSocket | docs/ARCH.md (section 4.6) → skills/SKILL-WEBSOCKET.md |
| Toucher aux alertes | docs/SPEC.md (sections 5-6) → skills/SKILL-ALERTS.md |
| Toucher au déploiement | docs/DEPLOY.md → skills/SKILL-DEPLOY.md |
| Écrire des tests | docs/TESTS.md → skills/SKILL-TESTING.md |
| Gérer les erreurs | docs/ERRORS.md |
| Gérer les variables d'env | docs/ENV.md |

**Règle : toujours lire le doc + le skill AVANT de coder. Jamais l'inverse.**

---

## CONVENTIONS CRITIQUES

### Langage
- Code, commentaires, messages d'erreur, UI, doc publique : **anglais uniquement**
- Documentation interne du repo (docs/, skills/) : français autorisé

### Naming
- Python : snake_case (fonctions, variables, fichiers)
- TypeScript : camelCase (variables, fonctions), PascalCase (composants, types)
- DB : snake_case (tables, colonnes)
- API endpoints : kebab-case (/v1/api-keys), REST verbs
- API keys : prefix `ags_live_` + 32 chars base62
- Commits : `type: description` (feat, fix, refactor, docs, test, chore)

### Architecture
- Backend : FastAPI avec services layer (api/ → services/ → models/)
- Frontend : Next.js 14 App Router, Server Components par défaut, Client Components quand nécessaire
- DB : Supabase PostgreSQL, RLS sur CHAQUE table, tout scopé par organization_id
- Auth : Supabase JWT (dashboard) + API Key Bearer (SDK) + JWT (WebSocket) + share_token (Replay public)
- Async : Celery + Redis pour tout ce qui prend > 100ms

### Sécurité — Zéro compromis
- RLS activé sur les 19 tables
- Chaque endpoint vérifie l'auth
- API keys hashées SHA-256 en DB, jamais en clair
- PII redaction par défaut (privacy by default)
- Inputs/outputs stockés uniquement si le plan le permet ET PII redacté
- CORS restrictif (uniquement app.agentshield.one en prod)
- Rate limiting par plan sur chaque endpoint

---

## MODULES ET PLANS

```
| Feature              | Free | Starter (€49) | Pro (€99) | Team (€199) |
|----------------------|------|----------------|-----------|-------------|
| Monitor (base)       | ✅   | ✅              | ✅         | ✅           |
| Alerts + Anomaly     | ❌   | ✅              | ✅         | ✅           |
| Forecast             | ❌   | ✅              | ✅         | ✅           |
| Replay               | ❌   | ✅              | ✅         | ✅           |
| Smart Alerts         | ❌   | ❌              | ✅         | ✅           |
| Cost Autopilot       | ❌   | ❌              | ✅         | ✅           |
| Budget caps + kill   | ❌   | ❌              | ✅         | ✅           |
| Protect (guardrails) | ❌   | ❌              | ✅         | ✅           |
| PII redaction config | ❌   | ❌              | ✅         | ✅           |
| Webhooks sortants    | ❌   | ❌              | ✅         | ✅           |
| Session sharing      | ❌   | ❌              | ✅         | ✅           |
| Multi-user           | ❌   | ❌              | ❌         | ✅           |
| Team attribution     | ❌   | ❌              | ❌         | ✅           |
| Audit log            | ❌   | ❌              | ❌         | ✅           |
| Slack bot            | ❌   | ❌              | ❌         | ✅           |
| PDF reports          | ❌   | ❌              | ❌         | ✅           |
| Dashboard custom     | ❌   | ❌              | ❌         | ✅           |
| Compliance mode      | ❌   | ❌              | ❌         | ✅           |
```

**Quand tu codes une feature, vérifie TOUJOURS quel plan est requis.**
Si l'utilisateur n'a pas le bon plan → retourner 403 avec un message clair qui indique le plan nécessaire.

---

## IDENTITÉ — RÈGLE ABSOLUE

Ce projet appartient à **Nova (@NovaShips)**.

**JAMAIS** dans le code, les commentaires, les commits, les configs, les messages d'erreur, les données de démo :
- FoundryTwo
- Fabrice
- Toute autre identité réelle

**TOUJOURS** :
- Nova, @NovaShips, AgentShield
- novaships.dev@outlook.com
- github.com/NovaShips

---

## FORMAT DES COMMITS

```
feat: add budget caps endpoint with kill switch
fix: PII redaction missing phone pattern for EU format
refactor: extract pricing logic into dedicated service
docs: update ARCH.md with new guardrail tables
test: add test coverage for anomaly detection z-score
chore: update dependencies, fix lint warnings
```

Un commit par tâche logique. Pas de mega-commits. Pas de commits vides.

---

## QUAND TU NE SAIS PAS

1. Cherche dans docs/ — la réponse est probablement là
2. Cherche dans skills/ — les best practices sont là
3. Si le fichier docs/skills correspondant est vide (placeholder) → demande avant d'improviser
4. Si deux docs se contredisent → CONTEXT.md gagne toujours
5. Si une décision archi n'est pas documentée → propose une solution ET documente-la

---

## CE QUE TU NE FAIS JAMAIS

1. Coder sans lire le doc correspondant d'abord
2. Inventer des chiffres dans les données de démo
3. Ajouter une dépendance sans justification
4. Skip le RLS sur une table
5. Stocker une API key en clair
6. Stocker des inputs/outputs sans PII redaction
7. Créer un endpoint sans auth
8. Créer un endpoint sans rate limiting
9. Créer un endpoint sans vérification du plan
10. Builder une feature proxy (on n'intercepte JAMAIS le trafic)
11. Écrire du code ou des commentaires en français
12. Committer sans push
13. Modifier CONTEXT.md sans demander d'abord

---

> Ce fichier est la loi de ce repo. Tout le reste en découle.
