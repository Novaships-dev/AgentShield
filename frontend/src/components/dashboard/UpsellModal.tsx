'use client'

import { useState } from 'react'
import { Lock, X, Zap } from 'lucide-react'
import { PLAN_CONFIGS } from '@/types/subscription'
import { getAccessToken } from '@/lib/auth-header'

interface UpsellModalProps {
  feature: string
  requiredPlan: 'starter' | 'pro' | 'team'
  description?: string
  onClose: () => void
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'Alerts, Anomaly detection, Forecast, Replay sessions, and 5-agent support.',
  pro: 'Guardrails, PII protection, Budget caps, Smart Alerts, Cost Autopilot, Webhooks, and unlimited agents.',
  team: 'Multi-user teams, Team cost attribution, Audit log, PDF reports, and Slack bot.',
}

export default function UpsellModal({ feature, requiredPlan, description, onClose }: UpsellModalProps) {
  const [loading, setLoading] = useState(false)
  const plan = PLAN_CONFIGS[requiredPlan]

  const handleUpgrade = async () => {
    setLoading(true)
    const token = await getAccessToken()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/v1/billing/checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          plan: requiredPlan,
          success_url: `${window.location.origin}/dashboard/settings?billing=success`,
          cancel_url: window.location.href,
        }),
      }
    )
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.checkout_url
    } else {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl p-8 max-w-md w-full"
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 0 60px rgba(124,58,237,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.15)' }}
          >
            <Lock className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              {feature} requires the {plan.name} plan
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {description ?? PLAN_DESCRIPTIONS[requiredPlan]}
            </p>
          </div>

          <div className="w-full rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              €{plan.price}<span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>/month</span>
            </div>
            <ul className="text-xs text-left space-y-1 mt-3">
              {plan.features.slice(0, 5).map(f => (
                <li key={f} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.6 : 1 }}
            >
              <Zap className="w-4 h-4" />
              Upgrade to {plan.name} — €{plan.price}/mo
            </button>
            <a
              href="/dashboard/settings"
              className="text-xs text-center transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              Compare plans →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
