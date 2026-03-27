const CODE = `import agentshield as shield

# Wrap your agent with one decorator
@shield(agent="my-research-agent")
async def research_agent(query: str) -> str:
    # AgentShield automatically tracks:
    # ✓ Token usage & costs per call
    # ✓ Session timeline for replay
    # ✓ Guardrail violations
    # ✓ Anomaly detection

    response = await openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": query}]
    )
    return response.choices[0].message.content

# That's it. Open your dashboard.
# https://app.agentshield.one`

function highlight(line: string): React.ReactNode {
  if (line.startsWith('#')) {
    return <span style={{ color: 'rgba(255,255,255,0.3)' }}>{line}</span>
  }
  if (line.startsWith('@shield')) {
    return (
      <span>
        <span style={{ color: '#a78bfa' }}>@shield</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{line.slice(6)}</span>
      </span>
    )
  }
  if (line.includes('import') || line.includes('async def') || line.includes('return') || line.includes('await')) {
    const parts = line.split(/(import|async def|return|await)/)
    return (
      <span>
        {parts.map((p, i) =>
          ['import', 'async def', 'return', 'await'].includes(p)
            ? <span key={i} style={{ color: '#67e8f9' }}>{p}</span>
            : <span key={i} style={{ color: 'rgba(255,255,255,0.7)' }}>{p}</span>
        )}
      </span>
    )
  }
  if (line.includes('"') || line.includes("'")) {
    return (
      <span>
        {line.split(/(["'][^"']*["'])/).map((p, i) =>
          (p.startsWith('"') || p.startsWith("'"))
            ? <span key={i} style={{ color: '#86efac' }}>{p}</span>
            : <span key={i} style={{ color: 'rgba(255,255,255,0.7)' }}>{p}</span>
        )}
      </span>
    )
  }
  if (line.startsWith('https://')) {
    return <span style={{ color: '#67e8f9', textDecoration: 'underline' }}>{line}</span>
  }
  return <span style={{ color: 'rgba(255,255,255,0.7)' }}>{line}</span>
}

import React from 'react'

export default function CodePreview() {
  return (
    <section className="py-20 px-8">
      <div className="max-w-[1100px] mx-auto">
        <div className="reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
              One decorator.
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Full observability.
              </span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
              No agent refactoring. No proxy servers. No infrastructure changes.
              AgentShield instruments your existing code — one line at a time.
            </p>

            <div className="space-y-3">
              {[
                'Zero-latency overhead on your agent calls',
                'Works with any LLM provider or framework',
                'Sessions, costs, and guardrails out of the box',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <span style={{ color: '#4ade80', marginTop: '1px', flexShrink: 0 }}>✓</span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: code block */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Window bar */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
              <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
              <span className="ml-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>agent.py</span>
            </div>

            {/* Code */}
            <pre
              className="p-5 text-xs font-mono leading-relaxed overflow-x-auto"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {CODE.split('\n').map((line, i) => (
                <div key={i} className="flex gap-4">
                  <span className="select-none w-5 text-right flex-shrink-0" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    {i + 1}
                  </span>
                  <span>{highlight(line)}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
