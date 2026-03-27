import Link from 'next/link'

function Code({ children, lang = '' }: { children: string; lang?: string }) {
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
  title: 'Quickstart — AgentShield Docs',
  description: 'Get started with AgentShield in 2 minutes.',
}

export default function QuickstartPage() {
  return (
    <div>
      <div className="mb-8">
        <span
          className="text-xs font-bold tracking-widest px-2 py-1 rounded-md"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
        >
          QUICKSTART
        </span>
        <h1 className="text-3xl font-bold mt-4 mb-2" style={{ color: '#fff' }}>
          Get started in 2 minutes
        </h1>
        <P>One SDK. One decorator. Full observability for your AI agents.</P>
      </div>

      <H2 id="install">1. Install the SDK</H2>
      <Code>pip install agentshield</Code>

      <H2 id="api-key">2. Get your API key</H2>
      <P>
        Sign up at{' '}
        <a href="https://app.agentshield.one" style={{ color: '#a78bfa' }}>
          app.agentshield.one
        </a>{' '}
        and copy your API key from Settings → API Keys.
      </P>
      <Code>{`export AGENTSHIELD_API_KEY="ags_live_..."`}</Code>
      <P>Or configure it in code:</P>
      <Code>{`import agentshield as shield

shield.configure(api_key="ags_live_...")`}</Code>

      <H2 id="decorator">3. Add the decorator</H2>
      <P>Wrap your agent function with <code style={{ color: '#a78bfa' }}>@shield()</code>. That's it.</P>
      <Code>{`import agentshield as shield

@shield(agent="my-research-agent")
async def run_agent(query: str) -> str:
    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": query}]
    )
    return response.choices[0].message.content`}</Code>

      <H2 id="session">4. Track sessions (optional)</H2>
      <P>Group events into a session for replay:</P>
      <Code>{`from agentshield import session

@shield(agent="my-agent")
async def run_agent(query: str) -> str:
    with session(name="user-research") as s:
        # All calls inside this block are grouped
        result = await fetch_data(query)
        answer = await generate_answer(result)
    return answer`}</Code>

      <H2 id="verify">5. Verify it's working</H2>
      <P>Open your dashboard and you should see your first event:</P>
      <Code>{`# Check the dashboard
open https://app.agentshield.one/dashboard`}</Code>

      <div
        className="mt-8 p-4 rounded-xl"
        style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: '#4ade80' }}>Next steps</p>
        <ul className="space-y-1 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <li>→ <Link href="/docs/sdk" style={{ color: '#a78bfa' }}>Full SDK Reference</Link></li>
          <li>→ <Link href="/docs/frameworks" style={{ color: '#a78bfa' }}>Framework Integrations</Link> (LangChain, CrewAI, AutoGen)</li>
          <li>→ <Link href="/docs/api" style={{ color: '#a78bfa' }}>API Reference</Link></li>
        </ul>
      </div>
    </div>
  )
}
