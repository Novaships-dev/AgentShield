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
]

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug)
}
