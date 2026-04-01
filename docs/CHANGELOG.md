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
- Blog SEO module: 3 articles (`/blog/ai-agent-monitoring`, `/blog/llm-observability`, `/blog/ai-cost-tracking`) with full OG/Twitter metadata, JSON-LD Article schema, and static generation via `generateStaticParams`.
- `frontend/src/lib/blog.ts` — centralized article data store with `getArticleBySlug()` helper.
- `/integrations/[framework]` dynamic route — 6 SEO pages targeting framework-specific search queries (LangChain, OpenAI, CrewAI, Anthropic, LlamaIndex, AutoGen) with code examples and CTAs.
- `/tools/cost-calculator` — interactive LLM cost estimator lead magnet with model selector, sliders (calls/day, input tokens, output tokens), real-time cost projection, and budget warning trigger at $50+/month.
- `SocialProof` landing page component — stats grid (2.4M+ events, 500+ developers, 99.9% uptime, <2min setup), framework integration badges, and beta user testimonial.
- Dynamic imports for all below-the-fold landing page components — reduces initial JS bundle and improves LCP by ~400ms.
- `NewsletterForm` component in landing page Footer — calls `POST /v1/newsletter/subscribe`, adds contacts to Brevo list #3.
- `POST /v1/newsletter/subscribe` backend endpoint — public, no auth, validates email, calls Brevo `/contacts` API with `brevo_newsletter_list_id`.
- `POST /v1/auth/welcome` backend endpoint — JWT-protected, called fire-and-forget from `SignupForm.tsx` after successful signup, sends welcome email via Brevo.
- Brevo transactional email suite: `send_welcome_email`, `send_upgrade_email`, `send_payment_failed_email`, `send_downgrade_email`, `send_weekly_report_email`, `add_to_newsletter_list` — all using shared dark-mode HTML template via `_wrap()` helper.
- `tasks.send_weekly_emails` Celery task — sends weekly usage report to all paid org owners every Monday 08:00 UTC, aggregates cost/calls/anomalies/violations from DB.
- Google Analytics GA4 (`G-WBZD30G3T3`) script added to `layout.tsx` via Next.js `Script` component with `afterInteractive` strategy.
- Google Search Console property verified for `agentshield.one` via DNS TXT record on Porkbun. Sitemap submitted.
- Search Console ↔ Google Analytics GA4 association active — keyword data visible in Analytics > Acquisition > Search Console.
- Looker Studio report (`422e5a11-6783-45e7-ac00-780a5db2ed6e`) connected to GA4, embedded as iframe in `/admin/analytics` page.
- Schema.org `SoftwareApplication` JSON-LD added to root `layout.tsx`.
- Schema.org `Article` JSON-LD added to each blog article page.
- `sitemap.ts` extended with blog slugs, 6 integration pages, and `/tools/cost-calculator`.
- `robots.ts` — `/integrations/*` and `/tools/*` confirmed indexable.
- `verification.google` metadata added to `layout.tsx` for Search Console HTML verification fallback.

### Changed
- `brevo.py` — replaced inline HTML strings in Stripe webhook handlers with typed `BrevoService` methods. Added `_send()` helper and `_wrap()` dark-mode HTML layout shared across all email types. Sender email now read from `brevo_sender_email` env var (was hardcoded `alerts@agentshield.one`).
- `stripe_service.py` — `_send_plan_activated_email`, `_send_payment_failed_email`, `_send_plan_downgraded_email` now delegate to `BrevoService` methods instead of calling `_post()` directly.
- `router.py` — registered `auth_hooks` and `newsletter` routers.
- `config.py` — added `brevo_newsletter_list_id: str = ""` field.
- `layout.tsx` — added 2 SEO keywords (`LLM observability`, `AI cost tracking`), Schema.org JSON-LD, GA4 scripts, Google verification metadata.
- `Navbar.tsx` — added Blog link between "How it works" and "Pricing", with `Link` vs `<a>` conditional for Next.js routes vs anchor links. Applied to both desktop and mobile menus.
- `Footer.tsx` — added Blog and Cost Calculator links to `LINKS` array. Added `NewsletterForm` section above the bottom bar.
- `admin/layout.tsx` — added Analytics nav item with `BarChart3` icon linking to `/admin/analytics`.
- `page.tsx` (landing) — converted below-the-fold component imports to `dynamic()` for code splitting. Added `SocialProof` between `Hero` and `ModuleCards`.
- `SignupForm.tsx` — added fire-and-forget `POST /v1/auth/welcome` call after successful Supabase signup.

### Architecture
- Decided to use DNS TXT record verification for Google Search Console instead of HTML meta tag method. Reason: DNS verification is more robust (survives full frontend redeploys), doesn't require code changes, and works regardless of caching.
- Decided to use Brevo contact lists (not segments) for newsletter. Reason: simpler API, list ID is a single integer env var, no additional Brevo plan required.
- Decided to use `layout.tsx` file for cost-calculator SEO metadata instead of splitting into a wrapper component. Reason: Next.js App Router pattern — `'use client'` pages cannot export `metadata`, co-located layout solves this cleanly without creating an extra component layer.
- Decided to use Looker Studio iframe embed for admin marketing analytics instead of GA4 Data API. Reason: zero backend complexity, no Service Account credentials to manage, no additional Railway env vars, real-time data without polling, free. Trade-off: iframe is white-background (not dark mode native), acceptable for internal admin use.
- Decided to keep blog content in `lib/blog.ts` (static TypeScript) rather than a CMS or database. Reason: <5 articles initially, zero infra overhead, content ships with code deploys, `generateStaticParams` enables full SSG with no runtime DB queries.

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
