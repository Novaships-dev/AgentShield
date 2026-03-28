'use client'

import React from 'react'

/* ─── Code lines with token-level highlighting ─── */
type Token = { text: string; color: string }
type Line = Token[]

const kw = '#67e8f9'   // keyword (cyan)
const st = '#86efac'   // string  (green)
const cm = 'rgba(255,255,255,0.25)' // comment
const fn = '#a78bfa'   // decorator/function (violet)
const tx = 'rgba(255,255,255,0.7)'  // plain text
const ok = '#4ade80'   // success (green)

const LINES: Line[] = [
  [{ text: 'import', color: kw }, { text: ' agentshield ', color: tx }, { text: 'as', color: kw }, { text: ' shield', color: tx }],
  [],
  [{ text: '# Wrap your agent with one decorator', color: cm }],
  [{ text: '@shield', color: fn }, { text: '(agent=', color: tx }, { text: '"my-research-agent"', color: st }, { text: ')', color: tx }],
  [{ text: 'async def', color: kw }, { text: ' research_agent(query: str) -> str:', color: tx }],
  [{ text: '    # AgentShield automatically tracks:', color: cm }],
  [{ text: '    # ✓ Token usage & costs per call', color: cm }],
  [{ text: '    # ✓ Session timeline for replay', color: cm }],
  [{ text: '    # ✓ Guardrail violations', color: cm }],
  [{ text: '    # ✓ Anomaly detection', color: cm }],
  [],
  [{ text: '    response = ', color: tx }, { text: 'await', color: kw }, { text: ' openai.chat.completions.create(', color: tx }],
  [{ text: '        model=', color: tx }, { text: '"gpt-4o"', color: st }, { text: ',', color: tx }],
  [{ text: '        messages=[{', color: tx }, { text: '"role"', color: st }, { text: ': ', color: tx }, { text: '"user"', color: st }, { text: ', ', color: tx }, { text: '"content"', color: st }, { text: ': query}]', color: tx }],
  [{ text: '    )', color: tx }],
  [{ text: '    ', color: tx }, { text: 'return', color: kw }, { text: ' response.choices[0].message.content', color: tx }],
  [],
  [{ text: "# That's it. Open your dashboard.", color: cm }],
  [{ text: '# https://app.agentshield.one', color: cm }],
]

/* ─── Tabs ─── */
const TABS = ['Python', 'cURL', 'LangChain'] as const

export default function CodePreview() {
  return (
    <section className="py-24 px-8">
      {/* Divider */}
      <div className="max-w-[1100px] mx-auto mb-20">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2) 30%, rgba(6,182,212,0.2) 70%, transparent)' }} />
      </div>

      <style jsx>{`
        @keyframes lineReveal {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .code-line {
          opacity: 0;
          animation: lineReveal 0.4s ease-out forwards;
        }
        @keyframes resultFlash {
          0%   { opacity: 0; transform: scale(0.95); }
          60%  { opacity: 1; transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
        .result-line {
          opacity: 0;
          animation: resultFlash 0.6s ease-out forwards;
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto">
        <div data-reveal className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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

          {/* Right: premium terminal */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 0 40px rgba(124,58,237,0.1), 0 20px 60px rgba(0,0,0,0.4)',
              transform: 'perspective(1200px) rotateX(2deg)',
            }}
          >
            {/* Header with tabs */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
              </div>
              <div className="flex items-center gap-0">
                {TABS.map((tab, i) => (
                  <button
                    key={tab}
                    className="px-3 py-1 text-[11px] font-mono rounded-md transition-colors"
                    style={{
                      color: i === 0 ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                      background: i === 0 ? 'rgba(124,58,237,0.15)' : 'transparent',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Code with line-by-line reveal */}
            <pre className="p-5 text-[13px] font-mono leading-[1.75] overflow-x-auto" style={{ color: tx }}>
              {LINES.map((tokens, i) => (
                <div
                  key={i}
                  className="code-line flex gap-4"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className="select-none w-5 text-right flex-shrink-0" style={{ color: 'rgba(255,255,255,0.12)' }}>
                    {i + 1}
                  </span>
                  <span>
                    {tokens.length === 0
                      ? '\u00A0'
                      : tokens.map((t, j) => (
                          <span key={j} style={{ color: t.color }}>{t.text}</span>
                        ))}
                  </span>
                </div>
              ))}
              {/* Result line */}
              <div className="result-line flex gap-4 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', animationDelay: `${LINES.length * 80 + 200}ms` }}>
                <span className="select-none w-5 text-right flex-shrink-0" style={{ color: 'rgba(255,255,255,0.12)' }}>→</span>
                <span style={{ color: ok }}>✅ Tracked: $0.034 · 847 tokens · 1.2s</span>
              </div>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
