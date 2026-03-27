'use client'

import { useState } from 'react'
import { CreditCard, CheckCircle, XCircle, Zap } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { PLAN_CONFIGS } from '@/types/subscription'

const PLAN_ORDER = ['free', 'starter', 'pro', 'team']
const PLAN_RANK: Record<string, number> = { free: 1, starter: 2, pro: 3, team: 4 }

export default function SettingsBilling() {
  const { subscription, loading, startCheckout, openPortal } = useSubscription()
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const currentPlan = subscription?.plan ?? 'free'
  const config = PLAN_CONFIGS[currentPlan]
  const hasStripe = !!subscription?.stripe_customer_id

  const allFeatures = [
    'Monitor', 'Replay', 'Protect (guardrails + PII)',
    'Smart Alerts', 'Cost Autopilot', 'Budget caps + Kill switch',
    'Webhooks sortants', 'Session sharing',
    'Multi-user & Teams', 'Team attribution',
    'Audit log', 'PDF reports', 'Slack bot',
  ]

  const moduleFeatures: Record<string, string[]> = {
    monitor: ['Monitor'],
    replay: ['Replay', 'Session sharing'],
    protect: ['Protect (guardrails + PII)', 'Smart Alerts', 'Cost Autopilot', 'Budget caps + Kill switch', 'Webhooks sortants'],
    team: ['Multi-user & Teams', 'Team attribution', 'Audit log', 'PDF reports', 'Slack bot'],
  }

  const enabledFeatures = new Set<string>()
  const modules = subscription?.modules_enabled ?? []
  modules.forEach(m => (moduleFeatures[m] ?? []).forEach(f => enabledFeatures.add(f)))
  if (currentPlan === 'team') {
    moduleFeatures.team.forEach(f => enabledFeatures.add(f))
  }

  const handleUpgrade = async (plan: string) => {
    setError('')
    setActionLoading(true)
    try {
      await startCheckout(plan)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePortal = async () => {
    setError('')
    setActionLoading(true)
    try {
      await openPortal()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open portal')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-48 rounded-xl" style={{ background: 'var(--surface)' }} />
  }

  const nextPlan = PLAN_ORDER[PLAN_ORDER.indexOf(currentPlan) + 1]

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Current Plan: <span style={{ color: 'var(--accent)' }}>{config?.name ?? currentPlan}</span>
              {config?.price > 0 && (
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  €{config.price}/month
                </span>
              )}
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {currentPlan === 'free' ? 'Free forever — no credit card required' : 'Billed monthly via Stripe'}
            </p>
          </div>
          <CreditCard className="w-8 h-8" style={{ color: 'var(--accent)' }} />
        </div>

        <div className="flex gap-3 flex-wrap">
          {hasStripe && (
            <button
              onClick={handlePortal}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}
            >
              Manage Subscription
            </button>
          )}
          {nextPlan && (
            <button
              onClick={() => handleUpgrade(nextPlan)}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff', opacity: actionLoading ? 0.6 : 1 }}
            >
              <Zap className="w-4 h-4" />
              Upgrade to {PLAN_CONFIGS[nextPlan]?.name} — €{PLAN_CONFIGS[nextPlan]?.price}/mo
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm" style={{ color: '#f87171' }}>{error}</p>
        )}
      </div>

      {/* Features included */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Features included in your plan</h4>
        <div className="grid grid-cols-1 gap-2">
          {allFeatures.map(feature => {
            const included = enabledFeatures.has(feature)
            return (
              <div key={feature} className="flex items-center gap-2 text-sm">
                {included
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} />
                  : <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                }
                <span style={{ color: included ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {feature}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plan comparison */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Plan comparison</h4>
        <div className="grid grid-cols-4 gap-3">
          {PLAN_ORDER.map(plan => {
            const pc = PLAN_CONFIGS[plan]
            const isCurrent = plan === currentPlan
            const isUpgrade = PLAN_RANK[plan] > PLAN_RANK[currentPlan]
            return (
              <div
                key={plan}
                className="rounded-lg p-4 text-center"
                style={{
                  background: isCurrent ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                  border: isCurrent ? '1px solid rgba(124,58,237,0.5)' : '1px solid var(--border)',
                }}
              >
                <div className="font-semibold text-sm mb-1" style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {pc.name}
                  {isCurrent && <span className="ml-1 text-xs">✓</span>}
                </div>
                <div className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {pc.price === 0 ? 'Free' : `€${pc.price}`}
                  {pc.price > 0 && <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>}
                </div>
                {isUpgrade && plan !== 'free' && (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={actionLoading}
                    className="w-full py-1.5 rounded text-xs font-medium transition-opacity"
                    style={{ background: 'var(--accent)', color: '#fff', opacity: actionLoading ? 0.6 : 1 }}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
