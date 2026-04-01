'use client'

const ROWS = [
  { feature: 'Real-time cost tracking',             shield: true,  langsmith: false, helicone: true,  langfuse: true,  provider: '✅ total only' },
  { feature: 'Per-agent cost breakdown',             shield: true,  langsmith: false, helicone: false, langfuse: true,  provider: false },
  { feature: 'Per-session cost breakdown',           shield: true,  langsmith: true,  helicone: false, langfuse: true,  provider: false },
  { feature: 'Session Replay',                       shield: true,  langsmith: true,  helicone: false, langfuse: true,  provider: false },
  { feature: 'Guardrails & PII redaction',           shield: true,  langsmith: false, helicone: false, langfuse: false, provider: false },
  { feature: 'Budget caps per agent',                shield: true,  langsmith: false, helicone: false, langfuse: false, provider: '✅ total only' },
  { feature: 'Kill switch per agent',                shield: true,  langsmith: false, helicone: false, langfuse: false, provider: false },
  { feature: 'Anomaly detection',                    shield: true,  langsmith: false, helicone: false, langfuse: false, provider: false },
  { feature: 'No-code support (n8n, Make, Zapier)', shield: true,  langsmith: false, helicone: false, langfuse: false, provider: false },
  { feature: 'REST API (no SDK required)',           shield: true,  langsmith: false, helicone: true,  langfuse: true,  provider: false },
  { feature: 'Free tier',                            shield: true,  langsmith: true,  helicone: true,  langfuse: true,  provider: true  },
]

const COLS = [
  { key: 'shield',    label: 'AgentShield',     highlight: true  },
  { key: 'langsmith', label: 'LangSmith',       highlight: false },
  { key: 'helicone',  label: 'Helicone',        highlight: false },
  { key: 'langfuse',  label: 'Langfuse',        highlight: false },
  { key: 'provider',  label: 'Provider Limits', highlight: false },
]

type RowData = typeof ROWS[number]

export default function Comparison() {
  return (
    <section className="py-24 px-8">
      <style jsx>{`
        @keyframes popIn {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        .check-pop {
          animation: popIn 0.4s ease-out forwards;
        }
        .comp-row {
          transition: background 200ms;
        }
        .comp-row:hover {
          background: rgba(255,255,255,0.02) !important;
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14" data-reveal>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Why AgentShield?
          </h2>
          <p className="text-base max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Built specifically for AI agents — not retrofitted from generic APM tools.
          </p>
        </div>

        <div
          data-reveal
          className="rounded-2xl overflow-hidden overflow-x-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th
                  className="text-left px-6 py-4 text-xs font-medium sticky top-0"
                  style={{ color: 'rgba(255,255,255,0.4)', width: '35%', background: 'rgba(3,0,20,0.9)' }}
                >
                  Feature
                </th>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className="text-center px-4 py-4 text-xs font-semibold sticky top-0"
                    style={{
                      color: col.highlight ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                      background: col.highlight ? 'rgba(124,58,237,0.08)' : 'rgba(3,0,20,0.9)',
                      borderTop: col.highlight ? '2px solid #7C3AED' : '2px solid transparent',
                    }}
                  >
                    {col.highlight && (
                      <span
                        className="block text-[9px] font-bold tracking-widest mb-1 px-2 py-0.5 rounded-full mx-auto w-fit"
                        style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
                      >
                        YOU ARE HERE
                      </span>
                    )}
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row: RowData, i) => (
                <tr
                  key={row.feature}
                  className="comp-row"
                  style={{ borderBottom: i < ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  <td className="px-6 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{row.feature}</td>
                  {COLS.map(col => {
                    const val = row[col.key as keyof RowData]
                    const isString = typeof val === 'string'
                    return (
                      <td
                        key={col.key}
                        className="text-center px-4 py-3.5"
                        style={{
                          background: col.highlight ? 'rgba(124,58,237,0.05)' : 'transparent',
                        }}
                      >
                        {isString ? (
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{val}</span>
                        ) : val === true ? (
                          col.highlight ? (
                            <span
                              className="check-pop inline-block text-base"
                              style={{ color: '#4ade80', animationDelay: `${i * 80}ms` }}
                            >
                              ✓
                            </span>
                          ) : (
                            <span className="text-base" style={{ color: '#4ade80' }}>✓</span>
                          )
                        ) : (
                          <span className="text-base" style={{ color: 'rgba(255,255,255,0.15)' }}>✗</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 24, maxWidth: 640, margin: '24px auto 0', lineHeight: 1.7 }}>
          OpenAI and Anthropic give you total spending limits.{' '}
          <span style={{ color: '#e2d9f3' }}>AgentShield gives you per-agent, per-session cost attribution.</span>{' '}
          Your support-agent has a $5/day budget. Your research-agent has $50/day.{' '}
          Provider dashboards can&apos;t do that.
        </p>
      </div>
    </section>
  )
}
