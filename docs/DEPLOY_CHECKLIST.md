# Production Deploy Checklist — AgentShield

> Run this checklist before every production release.
> Domain: agentshield.one | Backend: api.agentshield.one

---

## 1. Pre-deploy

- [ ] All tests passing (`ci-backend` + `ci-frontend` + `ci-sdk` workflows green)
- [ ] No uncommitted changes (`git status` clean)
- [ ] `CHANGELOG` / release notes drafted
- [ ] Supabase migrations applied (Dashboard → SQL Editor → run pending `.sql` files)

## 2. Backend (Railway)

- [ ] Railway service exists: `agentshield-backend`
- [ ] Environment variables set:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
  - `REDIS_URL` (Railway Redis plugin)
  - `SENTRY_DSN`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`
  - `BREVO_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
  - `APP_ENV=production`, `APP_URL=https://api.agentshield.one`
  - `CORS_ORIGINS=https://agentshield.one,https://app.agentshield.one`
- [ ] Health check passes: `curl https://api.agentshield.one/health`
- [ ] Celery workers running (Railway service: `agentshield-worker`)
- [ ] Celery beat running (Railway service: `agentshield-beat`)

## 3. Frontend (Vercel)

- [ ] Vercel project linked to `main` branch
- [ ] Environment variables set:
  - `NEXT_PUBLIC_API_URL=https://api.agentshield.one`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Custom domain `agentshield.one` configured in Vercel
- [ ] `app.agentshield.one` → Vercel alias configured
- [ ] Landing page loads: `curl -I https://agentshield.one`

## 4. DNS (Cloudflare)

- [ ] `agentshield.one` → Vercel A/CNAME record (proxy ON)
- [ ] `app.agentshield.one` → Vercel CNAME (proxy ON)
- [ ] `api.agentshield.one` → Railway CNAME (proxy ON)
- [ ] `status.agentshield.one` → BetterUptime / StatusPage
- [ ] SSL certificates active (Cloudflare issues automatically)

## 5. Stripe

- [ ] Switch from test mode to live mode
- [ ] Live price IDs updated in Railway env vars
- [ ] Webhook endpoint registered: `https://api.agentshield.one/v1/billing/webhooks`
- [ ] Webhook events selected: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- [ ] Test a real checkout flow with a test card

## 6. Slack App

- [ ] Slack app created at api.slack.com/apps
- [ ] Slash command `/shield` → `https://api.agentshield.one/v1/slack/commands`
- [ ] OAuth redirect URL: `https://api.agentshield.one/v1/slack/callback`
- [ ] `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` set in Railway

## 7. Supabase (production project)

- [ ] Production Supabase project created (not dev)
- [ ] All 22 migrations applied (supabase/migrations/*.sql)
- [ ] RLS enabled on all tables
- [ ] Service role key stored in Railway (NOT in frontend env)
- [ ] Realtime enabled for events table (WebSocket notifications)

## 8. Post-deploy smoke tests

Run `docs/SMOKE_TESTS.md` checklist after every deploy.

---

> Last updated: 2026-03-27
