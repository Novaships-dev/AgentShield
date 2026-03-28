'use client'

import GlassCard from '@/components/ui/GlassCard'

const MODULES = [
  {
    icon: '📊',
    title: 'Monitor',
    tagline: 'Track every dollar, in real-time',
    desc: 'Cost tracking per agent, smart alerts with AI diagnosis, forecast your end-of-month bill, and get automatic model recommendations.',
    accent: '#7C3AED',
    glow: 'rgba(124,58,237,0.15)',
  },
  {
    icon: '🔄',
    title: 'Replay',
    tagline: 'Debug in seconds, not hours',
    desc: 'Step-by-step visual timeline of every agent session. See inputs, outputs, costs, and errors — then share with your team in one click.',
    accent: '#06B6D4',
    glow: 'rgba(6,182,212,0.15)',
  },
  {
    icon: '🛡️',
    title: 'Protect',
    tagline: 'Guardrails that actually guard',
    desc: 'Configurable content rules, automatic PII redaction, budget caps with kill switch, and compliance-ready audit logs.',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.15)',
  },
]

export default function ModuleCards() {
  return (
    <section className="py-20 px-8" id="modules">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MODULES.map(mod => (
            <div
              key={mod.title}
              className="reveal rounded-2xl p-6 relative overflow-hidden transition-transform duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(24px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.border = `1px solid ${mod.accent}40`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'
              }}
            >
              {/* Glow bg */}
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${mod.glow}, transparent)` }}
              />

              <div className="relative">
                <div className="text-4xl mb-4">{mod.icon}</div>
                <div className="flex items-baseline gap-3 mb-2">
                  <h3 className="text-xl font-bold" style={{ color: '#fff' }}>{mod.title}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: `${mod.accent}20`, color: mod.accent }}>
                    module
                  </span>
                </div>
                <p className="text-sm font-medium mb-3" style={{ color: mod.accent }}>{mod.tagline}</p>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{mod.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
