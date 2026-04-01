export default function ProviderLimits() {
  return (
    <section className="py-20 px-8">
      <div className="max-w-[1100px] mx-auto">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: '#fff', marginBottom: 12 }}>
            &ldquo;But I already have spending limits on OpenAI&rdquo;
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
            Provider limits cap your total. AgentShield shows you exactly where.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="grid-cols-1 sm:grid-cols-2">
          {/* Left — Provider */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            padding: '28px 32px',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
              What provider limits show you
            </p>
            <pre style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
{`Total spend: $340 this month.
Rate limit: 10,000 req/min.
Credit cap: $500/month.

That's it.`}
            </pre>
          </div>

          {/* Right — AgentShield */}
          <div style={{
            background: 'rgba(124,58,237,0.06)',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 14,
            padding: '28px 32px',
          }}>
            <p style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
              What AgentShield shows you
            </p>
            <pre style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
{`support-agent:   $12/month `}<span style={{ color: '#4ade80' }}>(normal)</span>{`
research-agent:  $280/month `}<span style={{ color: '#f59e0b' }}>(⚠ 3x baseline)</span>{`
  → session #4847 looped 97 times
  → cost: $40 in one session
  → anomaly detected → Slack alert
  → budget cap hit → agent frozen

`}<span style={{ color: '#e2d9f3' }}>Know WHERE, not just how much.</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
