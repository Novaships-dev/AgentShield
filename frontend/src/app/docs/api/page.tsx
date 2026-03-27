function Code({ children }: { children: string }) {
  return (
    <pre
      className="rounded-xl p-4 text-xs font-mono overflow-x-auto my-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#a78bfa',
        lineHeight: '1.8',
      }}
    >
      <code>{children}</code>
    </pre>
  )
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-bold mt-10 mb-4 scroll-mt-20" style={{ color: '#fff' }}>
      {children}
    </h2>
  )
}

function Endpoint({
  method,
  path,
  desc,
  auth,
}: {
  method: string
  path: string
  desc: string
  auth: string
}) {
  const methodColors: Record<string, string> = {
    GET: '#4ade80',
    POST: '#60a5fa',
    PATCH: '#fbbf24',
    DELETE: '#f87171',
  }
  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded font-mono"
          style={{ background: `${methodColors[method]}20`, color: methodColors[method] }}
        >
          {method}
        </span>
        <code className="text-sm font-mono" style={{ color: 'rgba(255,255,255,0.8)' }}>{path}</code>
        <span className="text-xs ml-auto px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
          {auth}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
      {children}
    </p>
  )
}

export const metadata = {
  title: 'API Reference — AgentShield Docs',
  description: 'REST API reference for AgentShield.',
}

export default function APIPage() {
  return (
    <div>
      <div className="mb-8">
        <span
          className="text-xs font-bold tracking-widest px-2 py-1 rounded-md"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
        >
          API REFERENCE
        </span>
        <h1 className="text-3xl font-bold mt-4 mb-2" style={{ color: '#fff' }}>API Reference</h1>
        <P>Base URL: <code style={{ color: '#a78bfa' }}>https://api.agentshield.one/v1</code></P>
      </div>

      <H2 id="authentication">Authentication</H2>
      <P>All API requests require an API key in the Authorization header:</P>
      <Code>{`curl -H "Authorization: Bearer ags_live_..." https://api.agentshield.one/v1/events`}</Code>
      <P>API keys are prefixed with <code style={{ color: '#a78bfa' }}>ags_live_</code> and can be created in Settings → API Keys.</P>

      <H2 id="events">Events</H2>
      <Endpoint method="POST" path="/v1/events" desc="Track a single LLM event" auth="API Key" />
      <Code>{`curl -X POST https://api.agentshield.one/v1/events \\
  -H "Authorization: Bearer ags_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": "my-agent",
    "model": "gpt-4o",
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "latency_ms": 1200,
    "session_id": "optional-uuid"
  }'`}</Code>

      <Endpoint method="GET" path="/v1/events" desc="List recent events" auth="JWT" />

      <H2 id="agents">Agents</H2>
      <Endpoint method="GET" path="/v1/agents" desc="List all agents with stats" auth="JWT" />
      <Endpoint method="GET" path="/v1/agents/{name}" desc="Get a specific agent" auth="JWT" />

      <H2 id="sessions">Sessions</H2>
      <Endpoint method="GET" path="/v1/sessions" desc="List sessions" auth="JWT" />
      <Endpoint method="GET" path="/v1/sessions/{id}" desc="Get session with step timeline" auth="JWT" />
      <Endpoint method="GET" path="/v1/sessions/{id}/share" desc="Get or create a shareable link" auth="JWT" />

      <H2 id="analytics">Analytics</H2>
      <Endpoint method="GET" path="/v1/analytics/daily" desc="Daily cost aggregations" auth="JWT" />
      <Endpoint method="GET" path="/v1/analytics/hourly" desc="Hourly cost aggregations" auth="JWT" />

      <H2 id="alerts">Alerts</H2>
      <Endpoint method="GET" path="/v1/alerts" desc="List alert rules" auth="JWT" />
      <Endpoint method="POST" path="/v1/alerts" desc="Create an alert rule" auth="JWT" />
      <Endpoint method="DELETE" path="/v1/alerts/{id}" desc="Delete an alert rule" auth="JWT" />

      <H2 id="reports">Reports</H2>
      <Endpoint method="GET" path="/v1/reports" desc="List generated PDF reports" auth="JWT" />
      <Endpoint method="POST" path="/v1/reports/generate" desc="Generate a new PDF report" auth="JWT" />
      <Endpoint method="GET" path="/v1/reports/{id}/download" desc="Download a report PDF" auth="JWT" />

      <H2 id="rate-limits">Rate limits</H2>
      <P>Rate limits vary by plan. The response includes standard headers:</P>
      <Code>{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1711234567`}</Code>
    </div>
  )
}
