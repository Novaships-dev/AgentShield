# CHANGELOG.md — Versioning AgentShield

> Ce fichier trace toutes les modifications significatives du projet. Claude Code le met à jour après chaque changement impactant (nouvelle feature, breaking change, fix important, décision d'architecture).
> Format : [Keep a Changelog](https://keepachangelog.com/) + Semantic Versioning
> Dernière mise à jour : mars 2026

---

## Format des entrées

```markdown
## [version] — YYYY-MM-DD

### Added
- Nouvelles features

### Changed
- Modifications de features existantes

### Fixed
- Corrections de bugs

### Removed
- Features supprimées

### Security
- Corrections de sécurité

### Architecture
- Décisions d'architecture (avec le raisonnement)

### Breaking
- Changements qui cassent la compatibilité (API, SDK)
```

### Règles

```
1. Chaque entrée est une phrase complète en anglais, commençant par un verbe
2. Les breaking changes sont toujours en section "Breaking" avec instructions de migration
3. Les décisions d'architecture incluent le POURQUOI (pas juste le quoi)
4. Les numéros de version suivent semver : MAJOR.MINOR.PATCH
5. La date est au format ISO 8601 (YYYY-MM-DD)
6. La version la plus récente est en haut du fichier
7. "[Unreleased]" regroupe les changements pas encore taggés
```

---

## [Unreleased]

### Architecture
- Rename project from AgentCostGuard to AgentShield — pivot from cost-only tracker to complete observability suite (Monitor + Replay + Protect). Reason: competitive analysis showed gap in the market for a unified tool. Single-module approach was too narrow for the target ICP (teams of 3-30).
- Adopt 3-module architecture: Monitor (cost tracking, alerts, forecast), Replay (session timeline, debug), Protect (guardrails, PII, kill switch). All modules share the same SDK and data pipeline.
- Add 19 database tables (up from 14 in AgentCostGuard) to support sessions, guardrails, PII configs, violations, and shared sessions.
- Price repositioning from €19-99 to €49-199 to reflect the expanded value proposition.

### Added
- Complete documentation scaffold: 28 docs + 21 skills covering every aspect of the project.
- CONTEXT.md — project source of truth (13 sections)
- ARCH.md — technical architecture (19 tables, 6 data flows, 4 auth systems)
- SPEC.md — functional specifications (27 features across 3 modules)
- CLAUDE.md — Claude Code instructions
- CONVENTIONS.md — code standards (Python, TypeScript, SQL, API, Git)
- ENV.md — all environment variables with per-environment values
- ERRORS.md — error catalogue (60+ error codes with HTTP status and SDK mapping)
- SECURITY.md — complete security spec (RLS policies, roles, rate limiting, PII, encryption)
- MIGRATIONS.md — database migration strategy with 23 initial migrations
- DEPLOY.md — deployment configuration (Railway, Vercel, Cloudflare, CI/CD)
- QUEUE.md — Celery/Redis task queue (11 task categories, 12 scheduled tasks)
- API.md — complete API documentation (33 endpoints)
- SDK.md — Python SDK specification (14 sections)
- WEBHOOKS.md — inbound + outbound webhooks (Stripe, Slack, client webhooks)
- PRICING-ENGINE.md — AI model pricing engine (14 models V1, aliases, fallbacks)
- INTEGRATIONS.md — all third-party services (10 services documented)
- REPLAY.md — Replay module technical spec (sessions, timeline, sharing, comparison)
- PROTECT.md — Protect module technical spec (guardrails, PII, kill switch, compliance)
- FRAMEWORKS.md — framework integrations (LangChain, CrewAI, AutoGen, LlamaIndex)
- UI.md — design system (glassmorphism, dark mode, components, layouts, animations)
- COPY.md — all user-facing text (landing, onboarding, dashboard, emails, Slack, SDK errors)
- ANALYTICS.md — event tracking (25+ Plausible events, 15 internal metrics, funnel)
- TESTS.md — testing strategy (pytest, Vitest, Playwright, coverage targets)
- MONITORING.md — operational monitoring (Sentry, health checks, 7 runbooks)
- BACKUP.md — backup and restore (daily pg_dump, disaster recovery scenarios)
- TASKS.md — implementation order (8 sprints, 255h estimated)
- ROADMAP.md — product evolution (V1 → V1.1 → V1.2 → V2)
- CHANGELOG.md — this file

---

## [0.0.1] — 2026-03-22

### Added
- Initial repository scaffold with 28 docs + 21 skills (empty placeholders).
- README.md with project description and repo structure.
- .devcontainer/devcontainer.json configured for Python 3.12 + Node 20 + Redis.

### Architecture
- Decided on monorepo structure: backend/ + frontend/ + sdk/ in a single repository. Reason: solo developer, shared types, synchronized deploys, single context for Claude Code.
- Decided on FastAPI + Next.js + Supabase + Redis/Celery stack. Reason: Python for AI ecosystem compatibility, Next.js for SSR + Edge, Supabase for managed PostgreSQL + Auth + RLS, Redis for caching + queuing.

---

## Template — Copy this for new releases

```markdown
## [x.y.z] — YYYY-MM-DD

### Added
-

### Changed
-

### Fixed
-

### Security
-

### Architecture
-

### Breaking
-
```

---

> **Règle :** Ce fichier est mis à jour à chaque changement significatif. Pas à chaque commit — uniquement quand quelque chose change pour les utilisateurs OU pour l'architecture.
> Les breaking changes sont annoncés ICI et dans le SDK README au minimum 2 semaines avant d'être appliqués (après v1.0.0).
