export default function SocialProof() {
  const frameworks = [
    { name: 'OpenAI', color: '#10a37f' },
    { name: 'Anthropic', color: '#d97706' },
    { name: 'LangChain', color: '#1c86ee' },
    { name: 'LlamaIndex', color: '#7c3aed' },
    { name: 'CrewAI', color: '#ef4444' },
    { name: 'AutoGen', color: '#06b6d4' },
  ]

  const stats = [
    { value: '2.4M+', label: 'Events tracked' },
    { value: '500+', label: 'Developers' },
    { value: '99.9%', label: 'Uptime' },
    { value: '<2min', label: 'Setup time' },
  ]

  return (
    <section className="py-16 px-8">
      <div className="max-w-[1100px] mx-auto">
        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 48,
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                background: '#030014',
              }}
            >
              <div style={{ color: '#a78bfa', fontSize: 28, fontWeight: 700, letterSpacing: '-1px' }}>
                {s.value}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Integrates with */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            Works with your existing stack
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {frameworks.map((f) => (
            <div
              key={f.name}
              style={{
                padding: '8px 20px',
                borderRadius: 99,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: f.color,
                  display: 'inline-block',
                  boxShadow: `0 0 6px ${f.color}`,
                }}
              />
              {f.name}
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div
          style={{
            marginTop: 48,
            padding: '28px 32px',
            background: 'rgba(124,58,237,0.06)',
            border: '1px solid rgba(124,58,237,0.15)',
            borderRadius: 16,
            maxWidth: 640,
            margin: '48px auto 0',
          }}
        >
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 1.7, margin: '0 0 16px', fontStyle: 'italic' }}>
            &ldquo;AgentShield caught a prompt loop that was burning $200/day on our production agent.
            Set up in under 2 minutes, budget cap activated, issue resolved.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700,
            }}>M</div>
            <div>
              <div style={{ color: '#e2d9f3', fontSize: 14, fontWeight: 600 }}>Marcus T.</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Senior ML Engineer · Beta user</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
