# Production Smoke Tests — AgentShield

> Run after every production deploy. All tests must pass before marking the release complete.
> Set: `export API=https://api.agentshield.one`

---

## 1. Infrastructure

```bash
# Backend health
curl -sf $API/health | jq .
# Expected: {"status": "ok", "services": {"redis": "ok", "database": "ok"}}

# Frontend loads
curl -sf -o /dev/null -w "%{http_code}" https://agentshield.one
# Expected: 200

# Docs load
curl -sf -o /dev/null -w "%{http_code}" https://agentshield.one/docs/quickstart
# Expected: 200

# Sitemap
curl -sf -o /dev/null -w "%{http_code}" https://agentshield.one/sitemap.xml
# Expected: 200
```

## 2. Auth flow

- [ ] Visit `https://agentshield.one` — landing page renders correctly
- [ ] Click "Start Free →" — redirects to `/setup`
- [ ] Sign up with a test email
- [ ] Confirm email (check inbox)
- [ ] Complete onboarding wizard (all 5 steps)
- [ ] Redirected to dashboard with no errors

## 3. SDK + Event tracking

```bash
# Install SDK
pip install agentshield

# Set key (from onboarding or Settings → API Keys)
export AGENTSHIELD_API_KEY="ags_live_..."

# Send a test event
python3 -c "
import agentshield as shield

@shield(agent='smoke-test')
def fake_agent():
    return 'ok'

fake_agent()
print('Event sent')
"
```

- [ ] Event appears in dashboard within 5 seconds
- [ ] Agent `smoke-test` visible on Agents page
- [ ] Cost > 0 (pricing lookup working)

## 4. WebSocket (real-time)

- [ ] Open dashboard in browser
- [ ] Send an event via SDK
- [ ] Dashboard KPI cards update without page refresh

## 5. Billing (Stripe live mode)

- [ ] Visit Settings → Billing
- [ ] Click "Upgrade to Starter"
- [ ] Stripe checkout opens with EUR pricing (€49/mo)
- [ ] Complete with test card `4242 4242 4242 4242`
- [ ] Dashboard shows "Starter" plan badge
- [ ] Click "Manage Subscription" → Stripe portal opens

## 6. Alerts

- [ ] Create an alert rule (Settings → Alerts or Alerts page)
- [ ] Set threshold to $0.00 (guaranteed to trigger)
- [ ] Send an event → alert fires within 5 minutes
- [ ] Email received (check inbox)

## 7. Session Replay

- [ ] Send events with a `session_id`
- [ ] Sessions page shows the session
- [ ] Click session → step-by-step timeline renders
- [ ] Share link generated and accessible publicly

## 8. Guardrails

- [ ] Create a guardrail rule (keyword block)
- [ ] Send an event with the blocked keyword
- [ ] Event returns `GuardrailBlockedError` in SDK
- [ ] Violation appears on Violations page

## 9. Slack bot (if configured)

- [ ] In connected Slack workspace: `/shield status`
- [ ] Expected: cost + agent count for today
- [ ] `/shield help` — shows all commands

## 10. PDF Reports

- [ ] Visit Reports page
- [ ] Generate a report for current month
- [ ] WebSocket notification appears when ready
- [ ] Download PDF — file opens correctly

---

## Rollback procedure

If any test fails:

```bash
# Identify last working commit
git log --oneline -10

# Rollback Railway to previous deployment
railway rollback --service backend

# Rollback Vercel to previous deployment
vercel rollback --token $VERCEL_TOKEN
```

---

> Last updated: 2026-03-27
