import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '€0',
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
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '€49',
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
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '€99',
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
  },
  {
    key: 'team',
    name: 'Team',
    price: '€199',
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
  },
]

export default function Pricing() {
  return (
    <section className="py-20 px-8" id="pricing">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-14 reveal">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#fff' }}>
            Start free. Scale with confidence.
          </h2>
          <p className="text-base max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No credit card required. Upgrade or downgrade any time.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan, i) => (
            <div
              key={plan.key}
              className="reveal relative rounded-2xl p-6 flex flex-col transition-transform duration-300"
              style={{
                background: plan.popular
                  ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.05))'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: plan.popular ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(24px)',
                animationDelay: `${i * 80}ms`,
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full tracking-widest"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', color: '#fff' }}
                >
                  POPULAR
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-base font-bold mb-1" style={{ color: '#fff' }}>{plan.name}</h3>
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.tagline}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black" style={{ color: '#fff' }}>{plan.price}</span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{plan.period}</span>
                </div>
                <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{plan.desc}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5" style={{ color: '#4ade80', flexShrink: 0 }}>✓</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.href} className="block">
                {plan.popular ? (
                  <GlowButton size="sm" className="w-full">{plan.cta}</GlowButton>
                ) : (
                  <button
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {plan.cta}
                  </button>
                )}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
