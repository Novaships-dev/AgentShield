'use client'

import { useState } from 'react'
import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    period: 'forever',
    tagline: 'For side projects',
    desc: 'Get started with basic monitoring.',
    features: [
      '1 agent',
      '10K requests/month',
      '7-day history',
      'Monitor (basic)',
      'Community support',
    ],
    cta: 'Start Free →',
    href: '/setup',
    popular: false,
    accent: 'rgba(255,255,255,0.08)',
    rgb: '255,255,255',
  },
  {
    key: 'starter',
    name: 'Starter',
    monthly: 49,
    yearly: 39,
    period: '/month',
    tagline: 'For growing teams',
    desc: 'Add replay and smart alerts.',
    features: [
      '5 agents',
      '100K requests/month',
      '30-day history',
      'Monitor + Replay',
      'Alerts & Anomaly detection',
      'Forecast',
      'Email support',
    ],
    cta: 'Get Starter →',
    href: '/setup',
    popular: false,
    accent: 'rgba(6,182,212,0.2)',
    rgb: '6,182,212',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 99,
    yearly: 79,
    period: '/month',
    tagline: 'For production agents',
    desc: 'Full suite: Monitor + Replay + Protect.',
    features: [
      'Unlimited agents',
      '500K requests/month',
      '90-day history',
      'Monitor + Replay + Protect',
      'Smart Alerts (AI diagnosis)',
      'Cost Autopilot',
      'Webhooks & Session sharing',
      'Budget caps & kill switch',
      'Priority support',
    ],
    cta: 'Get Pro →',
    href: '/setup',
    popular: true,
    accent: 'rgba(124,58,237,0.3)',
    rgb: '124,58,237',
  },
  {
    key: 'team',
    name: 'Team',
    monthly: 199,
    yearly: 159,
    period: '/month',
    tagline: 'For agencies & enterprises',
    desc: 'Multi-user, compliance, and everything else.',
    features: [
      'Everything in Pro',
      'Multi-user & Teams',
      'Team cost attribution',
      'Audit log (immutable)',
      'PDF reports',
      'Slack bot',
      '1-year history',
      'Dedicated support',
    ],
    cta: 'Get Team →',
    href: '/setup',
    popular: false,
    accent: 'rgba(245,158,11,0.2)',
    rgb: '245,158,11',
  },
]

export default function Pricing() {
  const [yearly, setYearly] = useState(false)

  return (
    <section className="py-24 px-8" id="pricing">
      {/* Divider */}
      <div className="max-w-[1100px] mx-auto mb-20">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.2) 30%, rgba(6,182,212,0.2) 70%, transparent)' }} />
      </div>

      <style jsx>{`
        @keyframes gradientBorder {
          0%   { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
        @keyframes checkPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .pricing-card {
          position: relative;
          transition: all 500ms cubic-bezier(.4,0,.2,1);
          will-change: transform;
        }
        .pricing-card:hover {
          transform: translateY(-6px);
        }
        .pricing-card:hover .card-border {
          opacity: 1 !important;
        }
        .check-mark {
          animation: checkPop 0.3s ease-out forwards;
        }
        .pro-border {
          background: conic-gradient(from var(--border-angle, 0deg), #7C3AED, #06B6D4, #F59E0B, #7C3AED);
          animation: spinBorder 4s linear infinite;
        }
        @keyframes spinBorder {
          to { --border-angle: 360deg; }
        }
        @property --border-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10" data-reveal>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Start free. Scale with confidence.
          </h2>
          <p className="text-base max-w-md mx-auto mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No credit card required. Upgrade or downgrade any time.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 rounded-full p-1" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <button
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: !yearly ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: !yearly ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              }}
              onClick={() => setYearly(false)}
            >
              Monthly
            </button>
            <button
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2"
              style={{
                background: yearly ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: yearly ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              }}
              onClick={() => setYearly(true)}
            >
              Yearly
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{
                background: 'rgba(74,222,128,0.15)',
                color: '#4ade80',
              }}>-20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {PLANS.map((plan, i) => {
            const price = yearly ? plan.yearly : plan.monthly
            return (
              <div
                key={plan.key}
                data-reveal
                className={`pricing-card rounded-2xl flex flex-col ${plan.popular ? 'sm:-mt-2 sm:mb-2 lg:scale-[1.03] z-10' : ''}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Gradient border wrapper */}
                <div
                  className={`rounded-2xl p-[1px] h-full ${plan.popular ? 'pro-border' : ''}`}
                  style={{
                    background: plan.popular
                      ? undefined
                      : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {/* Hover border (non-pro) */}
                  {!plan.popular && (
                    <div className="card-border absolute inset-0 rounded-2xl pointer-events-none opacity-0 transition-opacity duration-500" style={{
                      background: `linear-gradient(135deg, rgba(${plan.rgb},0.3), rgba(${plan.rgb},0.1))`,
                    }} />
                  )}

                  <div
                    className="rounded-2xl p-6 h-full flex flex-col relative overflow-hidden"
                    style={{
                      background: plan.popular
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(3,0,20,0.95))'
                        : 'rgba(3,0,20,0.9)',
                      backdropFilter: 'blur(24px)',
                      WebkitBackdropFilter: 'blur(24px)',
                    }}
                  >
                    {/* Glow */}
                    {plan.popular && (
                      <div className="absolute inset-0 pointer-events-none" style={{
                        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.15), transparent)',
                      }} />
                    )}

                    {plan.popular && (
                      <div className="absolute -top-px left-1/2 -translate-x-1/2">
                        <span
                          className="text-[10px] font-bold px-4 py-1 rounded-b-lg tracking-widest"
                          style={{
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2))',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(124,58,237,0.3)',
                            borderTop: 'none',
                            color: '#a78bfa',
                          }}
                        >
                          POPULAR
                        </span>
                      </div>
                    )}

                    <div className="relative mb-5">
                      <h3 className="text-base font-bold mb-1" style={{ color: '#fff' }}>{plan.name}</h3>
                      <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.tagline}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black tabular-nums" style={{ color: '#fff' }}>
                          €{price}
                        </span>
                        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {plan.key === 'free' ? plan.period : '/month'}
                        </span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{plan.desc}</p>
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-6 relative">
                      {plan.features.map((f, fi) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <span
                            className="check-mark text-xs mt-0.5 flex-shrink-0"
                            style={{ color: '#4ade80', animationDelay: `${fi * 60}ms` }}
                          >
                            ✓
                          </span>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href={plan.href} className="block relative">
                      {plan.popular ? (
                        <GlowButton size="sm" className="w-full">{plan.cta}</GlowButton>
                      ) : (
                        <button
                          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-300"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.7)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                            e.currentTarget.style.borderColor = `rgba(${plan.rgb},0.3)`
                            e.currentTarget.style.boxShadow = `0 0 20px rgba(${plan.rgb},0.15)`
                            e.currentTarget.style.color = '#fff'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                            e.currentTarget.style.boxShadow = 'none'
                            e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                          }}
                        >
                          {plan.cta}
                        </button>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
