export type Article = {
  slug: string
  title: string
  description: string
  date: string
  readTime: string
  tags: string[]
  content: string
}

export const articles: Article[] = [
  {
    slug: 'ai-agent-monitoring',
    title: 'Why Every AI Agent Needs Monitoring in Production',
    description:
      'AI agents fail in unpredictable ways. Learn how real-time observability prevents runaway costs, hallucinations, and silent failures before they reach your users.',
    date: '2025-03-15',
    readTime: '6 min read',
    tags: ['Monitoring', 'Production', 'Best Practices'],
    content: `## The Hidden Cost of Unmonitored AI Agents

Deploying an AI agent to production without monitoring is like running a server without logs. Everything seems fine — until it isn't, and by then the cost is already paid.

AI agents fail differently from traditional software. They don't throw exceptions. They produce plausible-looking wrong answers. They loop on edge cases, spending $50 on a single session. They expose PII when context windows fill up. None of these failures are visible without purpose-built observability.

## What Can Go Wrong

**Runaway costs.** An agent stuck in a tool loop can make hundreds of LLM calls in minutes. Without a budget cap, you find out on your billing dashboard at month end.

**Silent quality degradation.** Prompt changes can shift output quality. Without session replay and metric tracking, you have no baseline to compare against.

**PII leakage.** When agents process user-submitted documents, sensitive data can appear in model inputs. Without PII scanning, you may not know until a user reports it.

**Latency spikes.** A slow external tool call can cascade into multi-minute sessions. Without p95 latency tracking, user experience degrades invisibly.

## The Four Pillars of AI Agent Monitoring

**1. Cost tracking per agent, per session.** Not just total spend — cost per call, per session, broken down by model and operation. This lets you identify the expensive paths.

**2. Session replay.** Every conversation reconstructed: prompts in, completions out, tool calls, timing, cost. Reproducible investigation of any issue.

**3. Anomaly detection.** Statistical baselines per agent. When cost or latency spikes beyond 3σ from normal, alert immediately — before it accumulates across sessions.

**4. Guardrails + PII.** Before and after LLM calls: block prohibited content, redact PII from inputs, scan outputs for policy violations.

## Getting Started

\`\`\`python
import agentshield

shield = agentshield.init(api_key="your-key")

with shield.session(agent_id="your-agent-id") as session:
    response = your_llm_call(prompt)
    session.track(prompt=prompt, response=response, cost_usd=0.001)
\`\`\`

Three lines of instrumentation gives you full cost tracking, session replay, and anomaly detection. The dashboard surfaces the rest.

## Conclusion

AI agent monitoring is not optional in production. The failure modes are too invisible and too expensive. Start with cost tracking and session replay — those two alone will surface 80% of issues.`,
  },
  {
    slug: 'llm-observability',
    title: 'LLM Observability: Beyond Logging Prompts and Responses',
    description:
      'Most teams log prompts and responses and call it observability. Real LLM observability tracks cost per session, token drift, latency percentiles, and PII exposure.',
    date: '2025-03-22',
    readTime: '8 min read',
    tags: ['LLM', 'Observability', 'OpenTelemetry'],
    content: `## Logging Is Not Observability

Most teams instrument their LLM applications by logging prompts and responses to a database. This feels like observability. It isn't.

True observability means you can answer any question about system behavior from your data. With logs, you can answer "what did the model say?" With real LLM observability, you can answer: why did session costs spike on Tuesday? Which agent is degrading? Which prompts produce the highest error rates?

## The Dimensions That Matter

**Cost attribution.** Total cost is meaningless. You need cost per agent, per session, per operation, and per model. Only then can you optimize.

**Token accounting.** Input vs output tokens tracked separately. Output tokens cost more on most models. Prompt templates that add 200 tokens per call add up to thousands of dollars at scale.

**Latency percentiles.** Average latency lies. p50, p95, p99 tell the real story. A p99 latency of 30 seconds means 1% of your users are waiting half a minute.

**Session coherence.** Multi-turn conversations tracked as unified sessions. Cost and latency rolled up per session, not just per call.

**PII exposure surface.** Which sessions contained PII in inputs? Which outputs included data that shouldn't have been there? Queryable.

## The Correlation Problem

The real value of LLM observability is correlation. When anomaly detection fires on a cost spike, you need to immediately drill into: which agent, which sessions, what changed. This requires:

- Agent-level cost histograms
- Session replay for any flagged session
- Timeline view: cost over time overlaid with deploys and prompt changes

Without this correlation, MTTR for LLM incidents is measured in hours. With it, minutes.

## Instrumentation Patterns

### Wrap, don't replace

The best instrumentation sits transparently around your existing LLM calls:

\`\`\`python
# Before
response = client.messages.create(model="claude-opus-4-5", ...)

# After — zero logic change
with shield.track_call(agent_id="my-agent") as call:
    response = client.messages.create(model="claude-opus-4-5", ...)
    call.record(response)
\`\`\`

### Semantic conventions

Adopt OpenTelemetry-compatible attribute names from the start: gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.response.model. This makes your data portable and queryable with standard tooling.

## What Good Looks Like

A mature LLM observability setup gives you:

- Real-time cost dashboard with per-agent breakdown
- Alert within 60 seconds of an anomalous session
- Full replay of any session within 90 days
- PII exposure report on demand
- Weekly cost trend per model

Logging prompts to Postgres is not this. Build toward it.`,
  },
  {
    slug: 'ai-cost-tracking',
    title: 'AI Cost Tracking: How to Stop Burning Budget on LLM APIs',
    description:
      'LLM API costs compound fast. Learn the patterns that cause runaway spend and how automated budget caps, anomaly detection, and Cost Autopilot keep costs predictable.',
    date: '2025-03-29',
    readTime: '7 min read',
    tags: ['Cost', 'Budget', 'Optimization'],
    content: `## The Cost Problem Is Structural

LLM API billing is per-token, per-call, continuous. Unlike a monthly SaaS subscription, costs scale directly with usage in ways that are easy to underestimate.

The most common failure mode: a developer tests an agent at 10 calls/day. It ships to production at 10,000 calls/day with longer context. The $5/day estimate becomes $500/day. Nobody notices for two weeks.

## The Patterns That Cause Runaway Spend

**Context accumulation.** Multi-turn agents that include full conversation history in every call. A 100-turn conversation means call 100 includes 99 prior turns as context. Cost grows quadratically.

**Tool loops.** Agents that retry failed tool calls indefinitely. A broken external API can trigger hundreds of retries. Add a maximum retry count to every tool.

**Model mismatches.** Using GPT-4 or Claude Opus for tasks that a smaller model handles fine. The 5–10x cost difference compounds immediately at scale.

**No budget gates.** The most expensive calls are often the easiest to prevent. A single malformed input that causes an agent to loop should be stopped at $1, not $100.

## The Three-Layer Defense

### Layer 1: Real-time cost tracking

Track cost at the finest granularity available: per call, per session, per agent. Aggregate up. The granular data is what tells you where the cost is coming from.

### Layer 2: Budget caps with kill switches

Set hard budget caps per agent per period. When an agent hits its monthly cap, requests return 429 rather than continuing to accumulate cost. Combine with soft warnings at 80% to give time to investigate before the kill switch activates.

\`\`\`python
# AgentShield budget cap — set once, enforced automatically
shield.set_budget(agent_id="my-agent", max_usd=50.0, period="monthly")
\`\`\`

### Layer 3: Anomaly detection

Statistical baselines per agent. When a session costs 3x the normal mean, fire an alert immediately. This catches loops and regressions before they drain budget.

## Cost Autopilot

Beyond alerting, the most effective cost reduction is recommendation-driven optimization. Analyzing cost patterns surfaces which agents have high output-to-input ratios, which are calling expensive models on simple tasks, and which context windows could be compressed.

Acting on these recommendations typically reduces LLM spend by 20–40% without quality loss.

## The ROI of Cost Tracking

Teams that instrument LLM cost tracking recover the cost of the tooling within weeks. The common discovery: 20% of agents account for 80% of spend, and at least one has a bug causing unnecessary re-calls.

Track everything. Optimize what matters. Cap the rest.`,
  },
  {
    slug: 'n8n-ai-cost-tracking',
    title: 'How to Track AI Agent Costs in n8n',
    description:
      'Your n8n workflows call OpenAI or Anthropic — but do you know what each run costs? This step-by-step guide shows how to add cost tracking in under 5 minutes.',
    date: '2025-04-05',
    readTime: '5 min read',
    tags: ['n8n', 'Cost Tracking', 'No-Code', 'Tutorial'],
    content: `## The Problem With n8n AI Workflows

n8n makes it easy to connect AI models to your workflows. OpenAI node here, Anthropic node there, and suddenly you have a powerful automation. What you don't have is any visibility into what each run costs.

The provider dashboard shows your total API spend. It doesn't show which workflow spent what, which run spiked, or which automation is running 10x more than expected.

## What You Need

Before you start, you need:

- An n8n instance (cloud or self-hosted)
- An AI node in your workflow (OpenAI, Anthropic, or any LLM)
- An AgentShield account — free at agentshield.one

## Step 1: Get Your AgentShield API Key

Sign up at agentshield.one → Settings → API Keys → Create key.
Your key starts with \`ags_live_\`.

## Step 2: Find Where Your AI Node Outputs Token Usage

Most LLM nodes in n8n return token usage in the response. For OpenAI:

\`\`\`
$json.usage.prompt_tokens
$json.usage.completion_tokens
\`\`\`

For Anthropic:
\`\`\`
$json.usage.input_tokens
$json.usage.output_tokens
\`\`\`

## Step 3: Add an HTTP Request Node

After your AI node, add a new node: **HTTP Request**.

Configure it exactly like this:

\`\`\`
Method: POST
URL: https://api.agentshield.one/v1/track

Headers:
  Authorization: Bearer ags_live_xxxxx
  Content-Type: application/json

Body (JSON):
{
  "agent": "my-n8n-workflow",
  "model": "gpt-4o",
  "input_tokens": {{ $json.usage.prompt_tokens }},
  "output_tokens": {{ $json.usage.completion_tokens }}
}
\`\`\`

Replace \`my-n8n-workflow\` with a name that identifies this workflow in your dashboard.

## Step 4: Run Your Workflow

Execute the workflow. In AgentShield's dashboard, you'll see:

- Cost per run, in real time
- Token breakdown (input vs output)
- Cost trend over time for this workflow
- Anomaly detection — if a run costs 3x the baseline, you get an alert

## Setting Budget Caps

Once you're tracking costs, you can set a budget cap per workflow. If your research workflow hits $5 in a day, AgentShield can send you a Slack alert or freeze the workflow automatically.

This is the per-agent, per-session visibility that your provider dashboard doesn't give you.

## Conclusion

Five minutes of setup. An HTTP Request node. That's all it takes to go from zero visibility to complete cost attribution for your n8n AI workflows.

Track costs, catch spikes, optimize what matters.`,
  },
  {
    slug: 'provider-limits-vs-agentshield',
    title: 'Why OpenAI Spending Limits Are Not Enough for AI Agent Teams',
    description:
      'OpenAI and Anthropic have spending limits. So why do teams still get blindsided by cost spikes? Because provider limits cap the total — not per agent, per session, per workflow.',
    date: '2025-04-08',
    readTime: '6 min read',
    tags: ['Cost', 'Monitoring', 'Provider Limits', 'Best Practices'],
    content: `## Provider Limits Are Real — And Insufficient

OpenAI has spending limits. Anthropic has credit caps (and charges upfront). Google Cloud has billing alerts. Every major AI provider gives you some way to cap your total spend.

So why do AI teams still get blindsided by unexpected cost spikes?

Because total caps tell you when you've spent too much. They don't tell you which agent caused it.

## What Provider Limits Actually Show You

Here's what you see in the OpenAI dashboard:

- Total tokens used this month
- Total cost this month
- A rate limit (requests per minute)
- A hard cap (stop everything at $X)

That's useful. It's not enough.

## The Attribution Problem

Imagine you have three AI agents in production:

- \`support-agent\` — handles customer queries, runs 500x/day
- \`research-agent\` — long context, runs 20x/day
- \`classifier-agent\` — cheap, runs 2000x/day

Your OpenAI dashboard says you spent $340 this month. Which agent spent what? You don't know. All three share the same API key.

Now imagine your spend jumps to $680 in week two. Which agent doubled? Did \`research-agent\` start looping? Did someone change the \`support-agent\` prompt and triple the context? Did a bug trigger \`classifier-agent\` 10x too many times?

The provider dashboard shows you $680. It cannot show you the cause.

## What Per-Agent Attribution Looks Like

With per-agent tracking, the same scenario looks like this:

\`\`\`
support-agent:    $42/month  (normal)
research-agent:   $280/month (⚠ 3x above baseline)
classifier-agent: $18/month  (normal)

research-agent breakdown:
  → session #4847: $40 in one session (looped 97 times)
  → Tuesday 14:32 UTC
  → anomaly detected: 3.2σ above mean
  → Slack alert sent
  → budget cap hit: agent frozen automatically
\`\`\`

Now you know exactly where to look. You fix the loop in \`research-agent\`. Total cost goes back to normal. The whole thing takes 20 minutes.

Without attribution, you're comparing month-over-month totals and guessing.

## The Difference Between Total Caps and Per-Agent Caps

Provider limits: "Stop all API calls when total spend hits $500/month."

Per-agent budget caps: "Stop \`research-agent\` when it hits $50/month. Let \`support-agent\` and \`classifier-agent\` keep running."

With total caps, one runaway agent can kill all your workflows. With per-agent caps, you isolate the problem automatically.

## Note on Anthropic Billing

Anthropic uses a prepaid credit model — you buy credits upfront, not monthly invoices. This makes a total spending limit even less useful as an operational tool, because you've already paid. Per-session attribution becomes more important, not less, because you want to know if your credits are being consumed efficiently before they run out.

## What This Means in Practice

The teams that get surprised by AI costs aren't the ones who forgot to set limits. They're the ones who set total limits and assumed that was enough.

Per-agent cost attribution is the missing layer. It's the difference between knowing HOW MUCH and knowing WHERE.

That per-agent, per-session breakdown is what AgentShield adds on top of whatever provider limits you already have.`,
  },
  {
    slug: 'ai-agent-monitoring-tools-2026',
    title: 'AI Agent Monitoring Tools Compared: 2026 Guide',
    description:
      'LangSmith, Helicone, Langfuse, or AgentShield? A practical comparison of the leading AI agent monitoring tools in 2026 — features, pricing, and when to use each.',
    date: '2025-04-10',
    readTime: '8 min read',
    tags: ['Comparison', 'Monitoring', 'Tools', 'LangSmith', 'Helicone'],
    content: `## The Market in 2026

AI agent observability is a new category. A year ago, teams were logging prompts to a database and calling it monitoring. Today, there are purpose-built tools — and they differ significantly in architecture, scope, and philosophy.

This guide compares the four main options: LangSmith, Helicone, Langfuse, and AgentShield.

## Quick Summary

| Tool | Best for | Proxy? | Budget caps? | No-code? |
|------|----------|--------|--------------|----------|
| LangSmith | LangChain teams | No | No | No |
| Helicone | Zero-config logging | Yes | No | No |
| Langfuse | Self-hosted / open source | No | No | No |
| AgentShield | Per-agent attribution + enforcement | No | Yes | Yes |

## LangSmith

LangSmith is LangChain's observability platform. If you're building with LangGraph or LangChain Expression Language, the integration is seamless — traces appear automatically.

**Strengths:** Deep LangChain integration, open source option, good UI for prompt debugging.

**Limitations:** Requires LangChain. If you use raw OpenAI calls, CrewAI without LangChain, or any other framework, you're doing manual instrumentation. No budget caps, no kill switches, no no-code support.

**Pricing:** Free tier available. Cloud version charges per trace at scale.

**Verdict:** Best if you're 100% on LangChain and need deep tracing of chains and agents.

## Helicone

Helicone works as a proxy. You change your OpenAI base URL to point at Helicone's servers, and every call gets logged automatically.

**Strengths:** Truly zero-config for OpenAI users, request caching, simple UI, good cost visibility.

**Limitations:** All your production LLM traffic flows through Helicone's servers. Some teams have compliance requirements that make this difficult. No per-agent budget caps, no session replay, no guardrails.

**Pricing:** Free tier. Usage-based above that.

**Verdict:** Best for developers who want instant logging with zero code and are comfortable with the proxy architecture.

## Langfuse

Langfuse is open-source and can be self-hosted. It has good tracing, evaluation, and a solid UI. The cloud version is managed.

**Strengths:** Open source, self-hostable, good tracing and evaluation features, active community.

**Limitations:** Self-hosting means you own the infra. No per-agent budget caps or kill switches. No no-code support. No anomaly detection.

**Pricing:** Open source is free (but you pay for infra). Cloud has usage-based pricing.

**Verdict:** Best for teams with data sovereignty requirements and capacity to manage infrastructure.

## AgentShield

AgentShield focuses on three things: per-agent cost attribution, budget enforcement, and universal compatibility.

**Strengths:** Per-agent and per-session cost breakdown, budget caps with automatic kill switches, anomaly detection, session replay, PII redaction, works with any tool (Python, JavaScript, n8n, Make, Zapier, cURL).

**Limitations:** Newer product. Less community content than LangSmith or Langfuse.

**Pricing:** Free tier. Paid plans from $49/month.

**Verdict:** Best when you need to know which agent caused a cost spike — not just total spend — and want to enforce limits automatically.

## The Key Differentiator

All four tools show you what happened. Only AgentShield shows you which agent caused it and stops it automatically.

Your OpenAI dashboard shows $340 this month. LangSmith, Helicone, and Langfuse show you the traces. AgentShield shows you that research-agent spent $280 and session #4847 looped 97 times — and already froze the agent before you checked.

That per-agent attribution and automatic enforcement is the gap in the market.

## Which One Should You Use?

- LangChain shop, need deep tracing → **LangSmith**
- Want instant logging, zero setup → **Helicone**
- Need self-hosted, open source → **Langfuse**
- Need per-agent budgets, no-code support, anomaly detection → **AgentShield**

Most production teams end up needing AgentShield's enforcement features once their agents are running at scale.`,
  },
  {
    slug: 'ai-agent-cost-mistakes',
    title: '5 Mistakes That Make Your AI Agents Cost 10x More',
    description:
      'Most AI agent cost problems come from the same five patterns. Here\'s what they are, how much they cost, and how to fix each one.',
    date: '2025-04-12',
    readTime: '6 min read',
    tags: ['Cost', 'Optimization', 'Best Practices'],
    content: `## The Pattern Is Always the Same

When an AI team gets hit with an unexpected cost spike, it's almost always one of five things. Not a provider pricing change. Not unusual traffic. One of five patterns that are completely preventable.

Here they are, with the cost impact and the fix.

## Mistake 1: Context Accumulation

**What it is:** Multi-turn agents that include the full conversation history in every call.

**The cost math:** A 100-turn conversation means call #100 sends 99 previous turns as context. If each turn is 200 tokens, call #100 sends 19,800 tokens just for history. At GPT-4 pricing, that's ~$0.20 per call — for context the model mostly ignores.

**The fix:** Implement a context window strategy. Keep the last N turns. Summarize older turns with a cheap model. Most agents need the last 5-10 turns, not the full history.

## Mistake 2: Tool Loops Without Retry Limits

**What it is:** An agent that retries a failed tool call indefinitely.

**The cost math:** A broken API endpoint causes your agent to retry 100 times before failing. Each retry = one LLM call. If each call costs $0.05, that's $5 from one broken request. At scale, one flaky dependency can cause thousands of dollars in unnecessary calls.

**The fix:** Set a maximum retry count on every tool call. 3 retries with exponential backoff, then fail gracefully. AgentShield's budget caps catch this at the session level — if a session costs 3x the baseline, the agent freezes.

## Mistake 3: Using the Wrong Model for the Task

**What it is:** Using GPT-4 or Claude Opus for tasks that GPT-3.5 or Claude Haiku handles equally well.

**The cost math:** GPT-4 Turbo costs ~$0.01/1K input tokens. GPT-3.5 Turbo costs ~$0.0005/1K input tokens. That's a 20x difference. If you're using GPT-4 to classify customer intent (a task GPT-3.5 handles fine), you're paying 20x too much for classification.

**The fix:** Test your tasks on smaller models. Classification, summarization, and simple Q&A almost always work fine on cheaper models. AgentShield's Cost Autopilot surfaces exactly this recommendation based on your actual usage patterns.

## Mistake 4: No Per-Agent Budget Caps

**What it is:** Relying on provider-level total spending limits instead of per-agent caps.

**The cost math:** Your provider cap is $500/month. One runaway agent loop spends $400 in 2 hours. Your other agents are now effectively frozen because the budget is exhausted — even though they're working correctly.

**The fix:** Set per-agent budget caps. Your support-agent gets $5/day. Your research-agent gets $50/day. When either hits the cap, only that agent freezes — the others keep running. This is what provider dashboards can't do.

## Mistake 5: No Monitoring At All

**What it is:** Deploying agents to production with zero observability.

**The cost math:** You don't know which agent is expensive. You don't know which sessions are outliers. You find out at the end of the month when the bill lands. By then, you've been paying for the problem for weeks.

**The fix:** Instrument before you go to production. It takes one HTTP POST per LLM call to get per-agent, per-session cost attribution. The 5 minutes of setup cost pays back in the first week.

## The Common Thread

All five mistakes share the same root cause: no per-agent visibility. When you can see which agent costs what — per session, in real time — you catch these problems in hours, not weeks.

AgentShield catches all five. Budget caps handle mistakes 2 and 4. Cost Autopilot surfaces mistake 3. Real-time monitoring prevents mistake 5. Context tracking catches mistake 1 before it compounds.`,
  },
  {
    slug: 'ai-agent-budget-limits',
    title: 'How to Set Budget Limits on AI Agents (Step by Step)',
    description:
      'A step-by-step guide to setting budget limits on your AI agents — the difference between provider total caps and per-agent caps, and how to set both.',
    date: '2025-04-15',
    readTime: '6 min read',
    tags: ['Budget', 'Kill Switch', 'Tutorial', 'Cost'],
    content: `## Two Types of Budget Limits

Before you set budget limits, it's worth understanding the two types and what each one does.

**Provider total caps** — Set on OpenAI, Anthropic, or Google. Stops all API calls when your total account spend reaches a threshold. Protects against catastrophic overspend but applies to every agent and workflow equally.

**Per-agent budget caps** — Set in your monitoring tool. Stops a specific agent when it hits its budget. Other agents keep running. This is what AgentShield adds.

Most teams need both.

## Step 1: Set a Provider-Level Safety Net

First, set a hard cap on your provider account. This is your last line of defense.

**OpenAI:**
1. Go to platform.openai.com → Settings → Limits
2. Set a "Hard limit" — all API calls stop when this is hit
3. Set a "Soft limit" — you get an email warning before the hard limit

**Anthropic:**
Anthropic uses a prepaid credit model. Buy credits, and usage draws from that balance. Set your initial credit purchase conservatively until you understand your usage patterns.

**Google AI:**
Set billing alerts in Google Cloud Console at 50%, 80%, and 100% of your expected budget.

## Step 2: Identify Your Agents and Their Expected Costs

Before setting per-agent caps, you need baselines. If you don't have them yet, run your agents for a week with tracking enabled and measure.

Typical patterns:
- Support agents (short context, high volume): $0.05-0.50 per session
- Research agents (long context, low volume): $0.50-5.00 per session
- Classifier agents (minimal tokens, very high volume): $0.001-0.01 per session

Set your initial caps at 3-5x your expected daily cost. This gives room for legitimate spikes while catching runaway loops.

## Step 3: Set Per-Agent Caps in AgentShield

Using the Python SDK:

\`\`\`python
import agentshield as shield

# Set a daily budget cap with automatic freeze
shield.set_budget(
    agent_id="research-agent",
    max_usd=50.0,
    period="daily",
    action="freeze"  # or "alert" for email/Slack only
)

# Set a monthly cap on a cheaper agent
shield.set_budget(
    agent_id="support-agent",
    max_usd=200.0,
    period="monthly",
    action="freeze"
)
\`\`\`

Using the REST API (for n8n, Make, Zapier, or any language):

\`\`\`bash
curl -X POST https://api.agentshield.one/v1/budgets \\
  -H "Authorization: Bearer ags_live_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "research-agent",
    "max_usd": 50.0,
    "period": "daily",
    "action": "freeze"
  }'
\`\`\`

## Step 4: Configure Alerts

Set up alerts before the cap is hit:

\`\`\`python
shield.set_alert(
    agent_id="research-agent",
    threshold_pct=80,  # Alert at 80% of budget
    channels=["email", "slack"]
)
\`\`\`

This gives you time to investigate before the agent freezes.

## Step 5: Test Your Caps

Before going to production, verify your caps work:

1. Set a very low cap (e.g., $0.01) on a test agent
2. Make a few API calls through it
3. Verify the agent freezes and you receive the alert
4. Reset the cap to your production value

## What Happens When a Cap Is Hit

When an agent hits its budget cap with action set to "freeze":

- The agent returns HTTP 402 on the next call
- An alert is sent to your configured channels
- The agent stays frozen until you manually reset it or the period resets
- All other agents continue running normally

This is the key difference from provider total caps: one agent's problem doesn't affect the rest.

## Recommended Cap Strategy

| Agent type | Daily cap | Monthly cap | Action |
|-----------|-----------|-------------|--------|
| Support/customer | $10 | $200 | Freeze |
| Research/long-context | $50 | $500 | Alert at 80%, freeze at 100% |
| Classifier/cheap | $5 | $50 | Freeze |
| Experimental/new | $2 | $20 | Freeze |

Start conservative. You can always raise caps. It's harder to explain a surprise $800 charge.`,
  },
]

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug)
}
