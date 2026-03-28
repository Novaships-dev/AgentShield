'use client'

import { Zap, Brain, TrendingDown, RefreshCcw, ShieldCheck, BarChart3 } from 'lucide-react'
import { type ComponentType } from 'react'

/* ─── data ─── */
interface Feature {
  Icon: ComponentType<{ size: number; strokeWidth: number; color: string }>
  tag: string
  tagColor: string
  rgb: string
  title: string
  desc: string
  span: string          // Tailwind grid span
  visual?: 'dashboard' | 'timeline'
}

const FEATURES: Feature[] = [
  {
    Icon: Zap, tag: 'CORE', tagColor: '#7C3AED', rgb: '124,58,237',
    title: 'Real-time Cost Tracking',
    desc: 'See every API call, every token, every dollar — the moment it happens. Not at the end of the month.',
    span: 'sm:col-span-2', visual: 'dashboard',
  },
  {
    Icon: Brain, tag: 'AI', tagColor: '#06B6D4', rgb: '6,182,212',
    title: 'Smart Alerts',
    desc: "When something goes wrong, AI diagnoses why and suggests a fix. Not just 'threshold exceeded'.",
    span: 'sm:col-span-1',
  },
  {
    Icon: TrendingDown, tag: 'SAVINGS', tagColor: '#10B981', rgb: '16,185,129',
    title: 'Cost Autopilot',
    desc: "Automatic model recommendations with estimated savings. 'Switch to gpt-4o-mini here — save $85/month.'",
    span: 'sm:col-span-1',
  },
  {
    Icon: RefreshCcw, tag: 'DEBUG', tagColor: '#F59E0B', rgb: '245,158,11',
    title: 'Session Replay',
    desc: 'Visual step-by-step timeline of every agent run. Inputs, outputs, costs — all in one view.',
    span: 'sm:col-span-2', visual: 'timeline',
  },
  {
    Icon: ShieldCheck, tag: 'SECURITY', tagColor: '#EF4444', rgb: '239,68,68',
    title: 'Guardrails & PII',
    desc: 'Block unwanted content, redact personal data automatically, kill switch when things go wrong.',
    span: 'sm:col-span-1 lg:col-span-1',
  },
  {
    Icon: BarChart3, tag: 'FORECAST', tagColor: '#8B5CF6', rgb: '139,92,246',
    title: 'Cost Forecast',
    desc: 'Know your end-of-month bill before it arrives. Per agent, per team, with confidence intervals.',
    span: 'sm:col-span-1 lg:col-span-2',
  },
]

/* ─── Mini dashboard visual ─── */
function MiniDashboard() {
  return (
    <div className="mt-5 flex items-end gap-2 h-16 overflow-hidden">
      {[65, 45, 80, 55, 70, 90, 60, 75].map((h, i) => (
        <div key={i} className="flex-1 rounded-t-sm" style={{
          background: `linear-gradient(180deg, rgba(124,58,237,0.6), rgba(124,58,237,0.15))`,
          height: `${h}%`,
          animation: `barBounce 2.4s ${i * 0.2}s ease-in-out infinite alternate`,
        }} />
      ))}
    </div>
  )
}

/* ─── Mini timeline visual ─── */
function MiniTimeline() {
  return (
    <div className="mt-5 flex items-center gap-0">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center">
          <div className="relative">
            <div className="w-3 h-3 rounded-full" style={{
              background: '#F59E0B',
              boxShadow: '0 0 8px rgba(245,158,11,0.4)',
              animation: `timelineDot 3s ${i * 0.6}s ease-in-out infinite`,
            }} />
          </div>
          {i < 4 && (
            <div className="w-8 sm:w-12 h-px" style={{
              background: 'linear-gradient(90deg, rgba(245,158,11,0.4), rgba(245,158,11,0.1))',
              animation: `timelineLine 3s ${i * 0.6 + 0.3}s ease-in-out infinite`,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Component ─── */
export default function BentoFeatures() {
  return (
    <section className="py-24 px-8" id="features">
      <style jsx>{`
        @keyframes barBounce {
          0%   { height: var(--h, 60%); }
          50%  { height: calc(var(--h, 60%) + 15%); }
          100% { height: var(--h, 60%); }
        }
        @keyframes timelineDot {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50%      { transform: scale(1.4); opacity: 1; }
        }
        @keyframes timelineLine {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 0.8; }
        }
        @keyframes bgIconFloat {
          0%, 100% { transform: translate(-50%,-50%) scale(1) rotate(0deg); }
          50%      { transform: translate(-50%,-50%) scale(1.05) rotate(3deg); }
        }
        .bento-card {
          position: relative;
          transition: all 500ms cubic-bezier(.4,0,.2,1);
          will-change: transform;
        }
        .bento-card:hover {
          transform: translateY(-4px);
          border-color: var(--card-accent) !important;
          box-shadow: 0 0 30px var(--card-glow), 0 8px 32px rgba(0,0,0,0.3);
        }
        .bento-card .hover-gradient {
          position: absolute; inset: 0; border-radius: 1rem; pointer-events: none;
          opacity: 0; transition: opacity 400ms;
        }
        .bento-card:hover .hover-gradient { opacity: 1; }
      `}</style>

      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-16" data-reveal>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Everything your agents need to behave.
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            One SDK. Three modules. Complete observability for AI agents in production.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              className={`bento-card rounded-2xl p-6 overflow-hidden ${f.span}`}
              style={{
                ['--card-accent' as string]: `${f.tagColor}50`,
                ['--card-glow' as string]: `rgba(${f.rgb},0.12)`,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              {/* Hover gradient overlay */}
              <div className="hover-gradient" style={{
                background: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(${f.rgb},0.08), transparent)`,
              }} />

              {/* Background icon watermark */}
              <div className="absolute pointer-events-none" style={{
                top: '50%', right: '-5%',
                transform: 'translate(0,-50%)',
                opacity: 0.03,
                animation: 'bgIconFloat 6s ease-in-out infinite',
              }}>
                <f.Icon size={120} strokeWidth={0.8} color={f.tagColor} />
              </div>

              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: `rgba(${f.rgb},0.1)`,
                      border: `1px solid rgba(${f.rgb},0.2)`,
                      boxShadow: `0 0 16px rgba(${f.rgb},0.12)`,
                    }}
                  >
                    <f.Icon size={24} strokeWidth={1.5} color={f.tagColor} />
                  </div>
                  <span
                    className="text-[10px] font-bold tracking-widest px-2 py-1 rounded-md"
                    style={{ background: `rgba(${f.rgb},0.15)`, color: f.tagColor }}
                  >
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: '#fff' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{f.desc}</p>

                {f.visual === 'dashboard' && <MiniDashboard />}
                {f.visual === 'timeline' && <MiniTimeline />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
