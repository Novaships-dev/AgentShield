const FEATURES = [
  {
    icon: '⚡',
    tag: 'CORE',
    tagColor: '#7C3AED',
    title: 'Real-time Cost Tracking',
    desc: 'See every API call, every token, every dollar — the moment it happens. Not at the end of the month.',
    large: true,
  },
  {
    icon: '🧠',
    tag: 'AI',
    tagColor: '#06B6D4',
    title: 'Smart Alerts',
    desc: "When something goes wrong, AI diagnoses why and suggests a fix. Not just 'threshold exceeded'.",
    large: false,
  },
  {
    icon: '📉',
    tag: 'SAVINGS',
    tagColor: '#10B981',
    title: 'Cost Autopilot',
    desc: "Automatic model recommendations with estimated savings. 'Switch to gpt-4o-mini here — save $85/month.'",
    large: false,
  },
  {
    icon: '🔄',
    tag: 'DEBUG',
    tagColor: '#F59E0B',
    title: 'Session Replay',
    desc: 'Visual step-by-step timeline of every agent run. Inputs, outputs, costs — all in one view.',
    large: false,
  },
  {
    icon: '🛡️',
    tag: 'SECURITY',
    tagColor: '#EF4444',
    title: 'Guardrails & PII',
    desc: 'Block unwanted content, redact personal data automatically, kill switch when things go wrong.',
    large: false,
  },
  {
    icon: '📊',
    tag: 'FORECAST',
    tagColor: '#8B5CF6',
    title: 'Cost Forecast',
    desc: 'Know your end-of-month bill before it arrives. Per agent, per team, with confidence intervals.',
    large: true,
  },
]

export default function BentoFeatures() {
  return (
    <section className="py-20 px-8" id="features">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14 reveal">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Everything your agents need to behave.
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            One SDK. Three modules. Complete observability for AI agents in production.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-auto">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`reveal rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 ${f.large ? 'lg:col-span-1' : ''}`}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(24px)',
                animationDelay: `${i * 80}ms`,
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                style={{ background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${f.tagColor}12, transparent)` }}
              />

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{f.icon}</span>
                  <span
                    className="text-[10px] font-bold tracking-widest px-2 py-1 rounded-md"
                    style={{ background: `${f.tagColor}20`, color: f.tagColor }}
                  >
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: '#fff' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
