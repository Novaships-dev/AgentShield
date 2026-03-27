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

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold mt-6 mb-2 scroll-mt-20" style={{ color: 'rgba(255,255,255,0.8)' }}>
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
  title: 'SDK Reference — AgentShield Docs',
  description: 'Complete reference for the AgentShield Python SDK.',
}

export default function SDKPage() {
  return (
    <div>
      <div className="mb-8">
        <span
          className="text-xs font-bold tracking-widest px-2 py-1 rounded-md"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
        >
          SDK REFERENCE
        </span>
        <h1 className="text-3xl font-bold mt-4 mb-2" style={{ color: '#fff' }}>SDK Reference</h1>
        <P>Complete reference for the AgentShield Python SDK.</P>
      </div>

      <H2 id="install">Installation</H2>
      <Code>pip install agentshield</Code>

      <H2 id="configure">configure()</H2>
      <P>Configure the SDK globally. All parameters are optional if set via environment variables.</P>
      <Code>{`import agentshield as shield

shield.configure(
    api_key="ags_live_...",   # or AGENTSHIELD_API_KEY env var
    debug=False,               # enable debug logging
    timeout=5.0,               # HTTP timeout in seconds
)`}</Code>

      <H2 id="monitor">@shield() — Monitor</H2>
      <P>Decorator that tracks every LLM call made inside the wrapped function.</P>
      <Code>{`from agentshield import shield

@shield(
    agent="my-agent",          # required — unique agent identifier
    model=None,                # override model name (auto-detected)
    session_id=None,           # link to a session for replay
    metadata={},               # arbitrary key-value tags
)
def my_agent_function():
    ...`}</Code>

      <H3 id="replay">session() — Replay</H3>
      <P>Context manager that groups events into a named session for visual replay.</P>
      <Code>{`from agentshield import session

with session(name="optional-name", session_id="optional-custom-id") as s:
    print(s.session_id)  # UUID auto-generated if not provided
    # All @shield calls inside are linked to this session`}</Code>

      <H2 id="protect">Protect — Exceptions</H2>
      <P>AgentShield raises typed exceptions when guardrails trigger:</P>
      <Code>{`from agentshield.exceptions import (
    BudgetExceededError,    # agent exceeded its budget cap
    AgentFrozenError,       # kill switch is active
    GuardrailBlockedError,  # content rule blocked the request
    AuthenticationError,    # invalid API key
)

try:
    result = await my_agent(query)
except BudgetExceededError as e:
    print(f"Budget exceeded: {e.current}/{e.limit}")
except GuardrailBlockedError as e:
    print(f"Blocked by rule: {e.rule_name}")`}</Code>

      <H2 id="errors">Error handling</H2>
      <P>Non-blocking: AgentShield never breaks your agent for tracking errors.</P>
      <P>Blocking: Budget, frozen, guardrail, and auth errors are always raised.</P>

      <H2 id="env">Environment variables</H2>
      <Code>{`AGENTSHIELD_API_KEY=ags_live_...   # required
AGENTSHIELD_API_URL=...             # override API endpoint (default: api.agentshield.one)
AGENTSHIELD_DEBUG=true              # enable debug logging`}</Code>
    </div>
  )
}
