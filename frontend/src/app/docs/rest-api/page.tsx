import Link from 'next/link'

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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold mt-6 mb-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
      {children}
    </h3>
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
  title: 'REST API — AgentShield Docs',
  description: 'Use AgentShield without an SDK. Track AI agent costs from any language or no-code tool with a simple HTTP POST.',
}

export default function RestApiPage() {
  return (
    <div>
      <div className="mb-8">
        <span
          className="text-xs font-bold tracking-widest px-2 py-1 rounded-md"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
        >
          REST API
        </span>
        <h1 className="text-3xl font-bold mt-4 mb-2" style={{ color: '#fff' }}>
          Use AgentShield Without an SDK
        </h1>
        <P>
          AgentShield has a REST API that works with any tool that can send an HTTP POST request —
          Python, JavaScript, cURL, n8n, Make, Zapier, or any other language or no-code platform.
          The Python SDK is optional.
        </P>
      </div>

      <H2 id="endpoint">Endpoint</H2>
      <Code>{`POST https://api.agentshield.one/v1/track`}</Code>

      <H2 id="auth">Authentication</H2>
      <P>
        All requests require a Bearer token. Get your API key from{' '}
        <a href="https://app.agentshield.one/dashboard/settings" style={{ color: '#a78bfa' }}>
          Settings → API Keys
        </a>
        .
      </P>
      <Code>{`Authorization: Bearer ags_live_xxxxx`}</Code>

      <H2 id="fields">Request Body</H2>
      <H3>Required fields</H3>
      <div
        className="rounded-xl overflow-hidden my-4"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Field</th>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Type</th>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['agent', 'string', 'Unique name for your agent or workflow. Used for grouping in the dashboard.'],
            ].map(([field, type, desc]) => (
              <tr key={field} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="px-4 py-3" style={{ color: '#a78bfa' }}>{field}</td>
                <td className="px-4 py-3" style={{ color: '#67e8f9' }}>{type}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H3>Optional fields</H3>
      <div
        className="rounded-xl overflow-hidden my-4"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Field</th>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Type</th>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['model', 'string', 'Model name (e.g. gpt-4o, claude-opus-4-5). Used for cost calculation.'],
              ['provider', 'string', 'Provider name (openai, anthropic, google, cohere). Auto-detected from model if omitted.'],
              ['input_tokens', 'integer', 'Number of prompt/input tokens. Used to calculate cost.'],
              ['output_tokens', 'integer', 'Number of completion/output tokens. Used to calculate cost.'],
              ['cost_usd', 'float', 'Override the calculated cost. Use if you already know the exact cost.'],
              ['session_id', 'string', 'Group multiple calls into one session for Replay. Generate a UUID per user conversation.'],
              ['latency_ms', 'integer', 'Response latency in milliseconds. Used for latency tracking and anomaly detection.'],
              ['metadata', 'object', 'Any key-value pairs you want to attach. Visible in session detail.'],
            ].map(([field, type, desc]) => (
              <tr key={field} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="px-4 py-3" style={{ color: '#a78bfa' }}>{field}</td>
                <td className="px-4 py-3" style={{ color: '#67e8f9' }}>{type}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="response">Response</H2>
      <Code>{`{
  "tracked": true,
  "cost_usd": 0.0185,
  "session_id": "ses_01jbk...",
  "event_id": "evt_01jbk..."
}`}</Code>

      <H2 id="examples">Examples</H2>

      <H3>cURL</H3>
      <Code>{`curl -X POST https://api.agentshield.one/v1/track \\
  -H "Authorization: Bearer ags_live_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": "my-agent",
    "model": "gpt-4o",
    "input_tokens": 1250,
    "output_tokens": 340,
    "session_id": "ses_user_abc123"
  }'`}</Code>

      <H3>JavaScript / Node.js</H3>
      <Code>{`await fetch("https://api.agentshield.one/v1/track", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ags_live_xxxxx",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    agent: "my-agent",
    model: "gpt-4o",
    input_tokens: completion.usage.prompt_tokens,
    output_tokens: completion.usage.completion_tokens,
    session_id: sessionId
  })
})`}</Code>

      <H3>n8n HTTP Request Node</H3>
      <Code>{`Method: POST
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
}`}</Code>

      <H3>Make (Integromat) HTTP Module</H3>
      <Code>{`Module: HTTP > Make a request
URL: https://api.agentshield.one/v1/track
Method: POST
Body type: Raw / JSON

{
  "agent": "my-make-scenario",
  "model": "gpt-4o",
  "input_tokens": {{ai_module.usage.prompt_tokens}},
  "output_tokens": {{ai_module.usage.completion_tokens}}
}`}</Code>

      <H3>Zapier Webhooks</H3>
      <Code>{`Action: Webhooks by Zapier > POST
URL: https://api.agentshield.one/v1/track

Headers:
  Authorization: Bearer ags_live_xxxxx

Data:
  agent: my-zapier-zap
  model: gpt-4o
  input_tokens: (from previous AI step)
  output_tokens: (from previous AI step)`}</Code>

      <H2 id="errors">Error Codes</H2>
      <div
        className="rounded-xl overflow-hidden my-4"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Status</th>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Error</th>
              <th className="text-left px-4 py-3" style={{ color: 'rgba(255,255,255,0.5)' }}>Fix</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['401', 'Unauthorized', 'Check your API key. Must be a valid ags_live_ key.'],
              ['422', 'Validation error', 'agent field is required. Check the request body.'],
              ['429', 'Rate limited', 'You are sending too many requests. Back off and retry.'],
              ['402', 'Budget cap exceeded', 'This agent has hit its budget cap. Increase or reset it in the dashboard.'],
              ['500', 'Server error', 'Retry with exponential backoff. Contact support if it persists.'],
            ].map(([status, error, fix]) => (
              <tr key={status} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td className="px-4 py-3" style={{ color: '#f87171' }}>{status}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.7)' }}>{error}</td>
                <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="rounded-xl p-5 mt-8"
        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: '#e2d9f3' }}>
          Need the Python SDK instead?
        </p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          The SDK wraps this API with automatic session management and framework integrations.{' '}
          <Link href="/docs/sdk" style={{ color: '#a78bfa' }}>
            View SDK docs →
          </Link>
        </p>
      </div>
    </div>
  )
}
