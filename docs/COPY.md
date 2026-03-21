# COPY.md — Tous les textes AgentShield

> Ce fichier contient TOUS les textes de l'application : UI, emails, notifications, erreurs user-facing, onboarding, landing. Claude Code le lit avant d'écrire du texte visible par l'utilisateur.
> Cohérent avec : UI.md (design), SPEC.md (features), ERRORS.md (messages techniques)
> Dernière mise à jour : mars 2026
> Langue : ANGLAIS uniquement pour tout le contenu user-facing

---

## 1. LANDING PAGE

### Hero

```
Badge      : "Now in public beta — Join early"
Headline   : "Your AI agents are running blind."
Accent     : "See everything."
Subtitle   : "Monitor costs. Replay every session. Protect with guardrails. One SDK. One line of code. Full visibility."
CTA primary: "Start Free →"
CTA secondary: "▶ Watch Demo"
```

### Module cards

```
Monitor :
  Icon    : 📊
  Title   : "Monitor"
  Tagline : "Track every dollar, in real-time"
  Desc    : "Cost tracking per agent, smart alerts with AI diagnosis, forecast your end-of-month bill, and get automatic model recommendations."

Replay :
  Icon    : 🔄
  Title   : "Replay"
  Tagline : "Debug in seconds, not hours"
  Desc    : "Step-by-step visual timeline of every agent session. See inputs, outputs, costs, and errors — then share with your team in one click."

Protect :
  Icon    : 🛡️
  Title   : "Protect"
  Tagline : "Guardrails that actually guard"
  Desc    : "Configurable content rules, automatic PII redaction, budget caps with kill switch, and compliance-ready audit logs."
```

### Features (bento grid)

```
1. Icon: ⚡ | Tag: CORE | Title: "Real-time Cost Tracking"
   Desc: "See every API call, every token, every dollar — the moment it happens. Not at the end of the month."

2. Icon: 🧠 | Tag: AI | Title: "Smart Alerts"
   Desc: "When something goes wrong, AI diagnoses why and suggests a fix. Not just 'threshold exceeded'."

3. Icon: 📉 | Tag: SAVINGS | Title: "Cost Autopilot"
   Desc: "Automatic model recommendations with estimated savings. 'Switch to gpt-4o-mini here — save $85/month.'"

4. Icon: 🔄 | Tag: DEBUG | Title: "Session Replay"
   Desc: "Visual step-by-step timeline of every agent run. Inputs, outputs, costs — all in one view."

5. Icon: 🛡️ | Tag: SECURITY | Title: "Guardrails & PII"
   Desc: "Block unwanted content, redact personal data automatically, kill switch when things go wrong."

6. Icon: 📊 | Tag: FORECAST | Title: "Cost Forecast"
   Desc: "Know your end-of-month bill before it arrives. Per agent, per team, with confidence intervals."
```

### How it works

```
Step 01 : "Install the SDK"
  Desc  : "One line. pip install agentshield. Works with OpenAI, Anthropic, Google, LangChain, CrewAI, and more."

Step 02 : "Add one decorator"
  Desc  : "@shield(agent='my-agent') — that's it. Costs, sessions, and guardrails are now tracked."

Step 03 : "See everything"
  Desc  : "Open your dashboard. Costs in real-time. Sessions you can replay. Violations you can prevent."
```

### Pricing

```
Section title : "Start free. Scale with confidence."

Free    : "For side projects" — "Get started with basic monitoring."
Starter : "For growing teams" — "Add replay and smart alerts."
Pro     : "For production agents" — "Full suite: Monitor + Replay + Protect."
Team    : "For agencies & enterprises" — "Multi-user, compliance, and everything else."
```

### Final CTA

```
Title  : "Your agents are running."
Accent : "Do you know what they're doing?"
Subtitle: "Set up in 2 minutes. No credit card. Free tier forever."
Button : "Start Free — It's Free →"
```

### Footer

```
Brand   : "AgentShield"
Built by: "Nova"
Links   : Privacy, Terms, Status, Docs, GitHub
```

---

## 2. ONBOARDING

```
Step 1 — Welcome :
  Title   : "Welcome to AgentShield"
  Subtitle: "Let's monitor your first AI agent in 2 minutes."
  Action  : [Continue]

Step 2 — API Key :
  Title   : "Your API Key"
  Subtitle: "Copy this key — you won't see it again."
  Warning : "⚠️ Save this key somewhere safe. It cannot be retrieved after this step."
  Action  : [Copy Key] → "Copied!" confirmation

Step 3 — Install SDK :
  Title   : "Install the SDK"
  Tabs    : Python SDK | LangChain | CrewAI | API Direct | cURL
  Action  : [I've installed it →]

Step 4 — First Event :
  Title   : "Send your first event"
  Waiting : "Waiting for your first event..."
  Timeout : "No event yet? Check our troubleshooting guide →"
  Success : "🎉 Your first event is tracked!"
  Detail  : "Agent: {name} | Model: {model} | Cost: ${cost}"

Step 5 — Dashboard :
  Title   : "You're all set!"
  Subtitle: "Your dashboard is live. Here's what you can do next."
  Tips    : "Set up alerts" | "Invite your team" | "Configure guardrails"
  Action  : [Go to Dashboard →]

Skip link (all steps) : "Skip setup →"
```

---

## 3. DASHBOARD

### Navigation labels

```
MONITOR section : Dashboard, Agents, Alerts, Budgets, Forecast, Reports, Team
REPLAY section  : Sessions
PROTECT section : Guardrails, PII, Violations
Other           : Audit, Settings
```

### KPI Cards

```
Today        : "${amount}" — "+{pct}% vs yesterday" or "-{pct}%"
This Month   : "${amount}"
Projected EOM: "${amount}" — "±${confidence}"
Active Agents: "{count}"
```

### Empty states

```
No agents yet :
  Icon    : 🤖
  Title   : "No agents tracked yet"
  Desc    : "Send your first event to see your agents here."
  Action  : [View Setup Guide]

No sessions yet :
  Icon    : 🔄
  Title   : "No sessions recorded yet"
  Desc    : "Pass a session_id in your SDK calls to start recording sessions."
  Action  : [View Replay Docs]

No alerts configured :
  Icon    : 🔔
  Title   : "No alert rules yet"
  Desc    : "Set up alerts to get notified when costs exceed your thresholds."
  Action  : [Create Alert Rule]

No violations :
  Icon    : ✅
  Title   : "No violations detected"
  Desc    : "All clear! Your guardrails haven't flagged any content yet."

No forecast data :
  Icon    : 📈
  Title   : "Not enough data yet"
  Desc    : "We need at least 3 days of data to generate a forecast. Check back soon."
```

### Agent statuses

```
Active   : "Active" (green badge)
Warning  : "Warning" (orange badge) — tooltip: "Anomaly detected" or "Budget > 80%"
Frozen   : "Frozen" (red badge) — tooltip: "Kill switch active" or "Budget exceeded"
Inactive : "Inactive" (gray badge) — tooltip: "No events in 7+ days"
```

### Upgrade prompts (upsell)

```
Feature locked (sidebar) :
  "🔒 {Module} — Available on {Plan}+"
  [Upgrade →]

Feature locked (page) :
  Title   : "{Feature} requires the {Plan} plan"
  Desc    : "{Short description of what they're missing}"
  Action  : [Upgrade to {Plan} — €{price}/mo]
  Link    : "Compare plans →"
```

---

## 4. NOTIFICATIONS

### Alert email

```
Subject : "⚠️ AgentShield — {alert_type} for '{agent_name}'"

Body :
  "Your agent '{agent_name}' has exceeded your {metric} threshold."
  ""
  "Current: ${value}"
  "Threshold: ${threshold}"
  "Overage: ${overage} (+{pct}%)"
  ""
  [View in Dashboard →]

Smart Alert addition (Pro+) :
  "💡 AI Diagnosis:"
  "{diagnosis}"
  ""
  "Suggested fix:"
  "{suggested_fix}"
  ""
  [Open Replay for this agent →]
```

### Anomaly email

```
Subject : "🔴 AgentShield — Anomaly detected on '{agent_name}'"

Body :
  "Unusual activity detected on '{agent_name}'."
  ""
  "Metric: {metric}"
  "Current value: {value} ({multiplier}x above normal)"
  "Normal range: {mean} ± {stddev}"
  "Time: {timestamp}"
  ""
  "Possible causes:"
  "• Agent looping on an edge case"
  "• Unexpected traffic spike"
  "• Prompt change causing longer outputs"
  ""
  [Investigate in Dashboard →]
```

### Budget email

```
Subject (warning) : "⚠️ AgentShield — Budget warning for '{agent_name}' ({pct}%)"
Subject (exceeded): "🔴 AgentShield — Budget exceeded for '{agent_name}' — Agent frozen"

Body (exceeded) :
  "Your agent '{agent_name}' has exceeded its {period} budget."
  ""
  "Budget: ${max}/month"
  "Current: ${current}"
  "Status: 🔴 Frozen (kill switch activated)"
  ""
  "What to do:"
  "• Increase the budget cap"
  "• Optimize the agent (check Cost Autopilot recommendations)"
  "• Deactivate the kill switch manually"
  ""
  [Manage Budget →]
```

### Welcome email

```
Subject : "Welcome to AgentShield 🛡️"

Body :
  "You're in."
  ""
  "AgentShield is ready to monitor your AI agents."
  "Here's how to get started:"
  ""
  "1. Copy your API key from the dashboard"
  "2. Install the SDK: pip install agentshield"
  "3. Add @shield(agent='my-agent') to your code"
  "4. See your first event in real-time"
  ""
  [Open Dashboard →]
  ""
  "Questions? Reply to this email — we read everything."
  ""
  "— Nova, @NovaShips"
```

### Payment failed email

```
Subject : "⚠️ AgentShield — Payment failed"

Body :
  "Your payment for AgentShield {plan} (€{price}/mo) has failed."
  ""
  "You have 7 days to update your payment method."
  "After {grace_date}, your account will be downgraded to Free."
  ""
  [Update Payment Method →]
```

---

## 5. SLACK NOTIFICATIONS

### Alert Slack

```
⚠️ *Cost Alert* — {agent_name}
Current: *${value}* | Threshold: ${threshold} | Overage: +{pct}%
<dashboard_url|View in Dashboard>
```

### Smart Alert Slack

```
🔴 *Smart Alert* — {agent_name}
Cost today: *${value}* (threshold: ${threshold})

*Diagnosis:* {diagnosis}
*Suggested fix:* {suggested_fix}

🔁 <replay_url|Replay this session> | <dashboard_url|Dashboard>
```

### Anomaly Slack

```
🔴 *Anomaly Detected* — {agent_name}
{metric}: *{value}* (normal: ~{mean} ±{stddev})
This is *{multiplier}x* above normal for {day_time}.
<dashboard_url|Investigate>
```

### Budget Slack

```
🔴 *Budget Exceeded* — {agent_name}
${current}/${max} ({period}) — *Agent frozen*
<dashboard_url|Manage Budget>
```

### Violation Slack

```
⚠️ *Guardrail Violation* — {agent_name}
Rule: "{rule_name}" | Action: {action}
Session: {session_id}
<replay_url|View in Replay>
```

---

## 6. SDK ERROR MESSAGES

```
BudgetExceededError :
  "Budget exceeded for agent '{agent}': ${current}/{max} ({period}). Agent is frozen."

AgentFrozenError :
  "Agent '{agent}' is frozen (kill switch active). Disable kill switch to resume tracking."

GuardrailBlockedError :
  "Request blocked by guardrail rule '{rule_name}'."

AuthenticationError :
  "Invalid API key. Check your AGENTSHIELD_API_KEY environment variable."

RateLimitError :
  "Rate limit exceeded. Retry after {retry_after} seconds."

NetworkError :
  "Could not reach AgentShield API. Check your network connection."

ServerError :
  "AgentShield API error. Your code is not affected — events will be tracked when the service recovers."
```

---

## 7. TONE & VOICE RULES

```
1. Concise — pas de phrases inutiles, pas de filler
2. Technical — les utilisateurs sont des développeurs, pas des marketeurs
3. Direct — "Your agent is frozen" pas "We noticed an issue with your agent"
4. Data-first — toujours montrer les chiffres avant l'explication
5. No hype — pas de "amazing", "revolutionary", "game-changing"
6. No emoji spam — max 1 emoji par message (au début, pour le type)
7. Actionable — chaque notification a un lien vers l'action suivante
8. English only — tout le contenu user-facing est en anglais
```

---

> **Règle :** Chaque string visible par l'utilisateur est dans ce fichier. Si Claude Code doit écrire du texte user-facing, il vérifie ici d'abord.
> Le ton est technique, concis, data-first. Pas de corporate speak.
