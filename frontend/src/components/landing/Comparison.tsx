const ROWS = [
  { feature: 'Real-time cost tracking', shield: true, datadog: true, langsmith: false, custom: false },
  { feature: 'Session Replay', shield: true, datadog: false, langsmith: true, custom: false },
  { feature: 'Guardrails & PII redaction', shield: true, datadog: false, langsmith: false, custom: false },
  { feature: 'AI-powered Smart Alerts', shield: true, datadog: false, langsmith: false, custom: false },
  { feature: 'Cost Autopilot recommendations', shield: true, datadog: false, langsmith: false, custom: false },
  { feature: 'Budget caps & kill switch', shield: true, datadog: false, langsmith: false, custom: false },
  { feature: 'One-line SDK integration', shield: true, datadog: false, langsmith: true, custom: false },
  { feature: 'AI-agent focused', shield: true, datadog: false, langsmith: true, custom: false },
  { feature: 'Free tier', shield: true, datadog: false, langsmith: true, custom: false },
]

const COLS = [
  { key: 'shield', label: 'AgentShield', highlight: true },
  { key: 'datadog', label: 'Datadog', highlight: false },
  { key: 'langsmith', label: 'LangSmith', highlight: false },
  { key: 'custom', label: 'Custom', highlight: false },
]

type RowData = {
  feature: string
  shield: boolean
  datadog: boolean
  langsmith: boolean
  custom: boolean
}

export default function Comparison() {
  return (
    <section className="py-20 px-8">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14 reveal">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Why AgentShield?
          </h2>
          <p className="text-base max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Built specifically for AI agents — not retrofitted from generic APM tools.
          </p>
        </div>

        <div
          className="reveal rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-6 py-4 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)', width: '35%' }}>
                  Feature
                </th>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    className="text-center px-4 py-4 text-xs font-semibold"
                    style={{
                      color: col.highlight ? '#a78bfa' : 'rgba(255,255,255,0.4)',
                      background: col.highlight ? 'rgba(124,58,237,0.06)' : 'transparent',
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
                  style={{ borderBottom: i < ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                >
                  <td className="px-6 py-3.5 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{row.feature}</td>
                  {COLS.map(col => (
                    <td
                      key={col.key}
                      className="text-center px-4 py-3.5"
                      style={{ background: col.highlight ? 'rgba(124,58,237,0.04)' : 'transparent' }}
                    >
                      {row[col.key as keyof RowData] ? (
                        <span className="text-base" style={{ color: '#4ade80' }}>✓</span>
                      ) : (
                        <span className="text-base" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
