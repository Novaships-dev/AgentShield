'use client'

import { BarChart3, RefreshCcw, ShieldCheck, type LucideIcon } from 'lucide-react'

const MODULES: {
  Icon: LucideIcon
  title: string
  tagline: string
  desc: string
  accent: string
  rgb: string
  rotateInit: string
}[] = [
  {
    Icon: BarChart3,
    title: 'Monitor',
    tagline: 'Track every dollar, in real-time',
    desc: 'Cost tracking per agent, smart alerts with AI diagnosis, forecast costs that accumulate without per-agent visibility, and get automatic model recommendations.',
    accent: '#7C3AED',
    rgb: '124,58,237',
    rotateInit: 'perspective(1000px) rotateY(-5deg)',
  },
  {
    Icon: RefreshCcw,
    title: 'Replay',
    tagline: 'Debug in seconds, not hours',
    desc: 'Step-by-step visual timeline of every agent session. See inputs, outputs, costs, and errors — then share with your team in one click.',
    accent: '#06B6D4',
    rgb: '6,182,212',
    rotateInit: 'perspective(1000px) rotateY(0deg)',
  },
  {
    Icon: ShieldCheck,
    title: 'Protect',
    tagline: 'Guardrails that actually guard',
    desc: 'Configurable content rules, automatic PII redaction, budget caps with kill switch, and compliance-ready audit logs.',
    accent: '#F59E0B',
    rgb: '245,158,11',
    rotateInit: 'perspective(1000px) rotateY(5deg)',
  },
]

export default function ModuleCards() {
  return (
    <section className="py-24 px-8" id="modules">
      {/* Section divider */}
      <div className="max-w-[1100px] mx-auto mb-20">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2) 30%, rgba(6,182,212,0.2) 70%, transparent)' }} />
      </div>

      <style jsx>{`
        @keyframes borderRotate {
          0%   { --border-angle: 0deg; }
          100% { --border-angle: 360deg; }
        }
        @keyframes cardShine {
          0%   { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%)  rotate(25deg); }
        }
        .module-card {
          position: relative;
          transition: transform 500ms cubic-bezier(.4,0,.2,1), box-shadow 500ms cubic-bezier(.4,0,.2,1);
          will-change: transform, box-shadow;
        }
        .module-card:hover {
          transform: perspective(1000px) rotateY(0deg) scale(1.05) !important;
        }
        .module-card .card-shine {
          position: absolute; inset: 0; overflow: hidden; border-radius: 1rem; pointer-events: none;
        }
        .module-card .card-shine::after {
          content: ''; position: absolute; top: -20%; left: -40%; width: 40%; height: 140%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          transform: translateX(-100%) rotate(25deg);
        }
        .module-card:hover .card-shine::after {
          animation: cardShine 1.2s ease forwards;
        }
        @media (max-width: 767px) {
          .module-card, .module-card:hover {
            transform: none !important;
          }
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MODULES.map((mod, i) => (
            <div
              key={mod.title}
              data-reveal
              className="module-card rounded-2xl p-[1px] sr-card"
              style={{
                transform: mod.rotateInit,
                background: `linear-gradient(135deg, ${mod.accent}50, rgba(255,255,255,0.06), ${mod.accent}30)`,
                transitionDelay: `${i * 100}ms`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 0 40px rgba(${mod.rgb},0.25), 0 0 80px rgba(${mod.rgb},0.1)`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = mod.rotateInit
              }}
            >
              {/* Inner card */}
              <div
                className="rounded-2xl p-7 h-full relative overflow-hidden"
                style={{
                  background: 'rgba(3,0,20,0.85)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                {/* Glow radial */}
                <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
                  background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(${mod.rgb},0.12), transparent)`,
                }} />

                {/* Shine on hover */}
                <div className="card-shine" />

                <div className="relative">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: `rgba(${mod.rgb},0.1)`,
                      border: `1px solid rgba(${mod.rgb},0.25)`,
                      boxShadow: `0 0 20px rgba(${mod.rgb},0.15)`,
                    }}
                  >
                    <mod.Icon size={26} strokeWidth={1.5} color={mod.accent} />
                  </div>

                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-xl font-bold" style={{ color: '#fff' }}>{mod.title}</h3>
                    <span
                      className="text-[10px] font-bold tracking-widest px-2.5 py-0.5 rounded-full"
                      style={{ background: `rgba(${mod.rgb},0.15)`, color: mod.accent }}
                    >
                      MODULE
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-3" style={{ color: mod.accent }}>{mod.tagline}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{mod.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
