'use client'

import { useState, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface OrgSubscription {
  plan: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  max_agents: number
  max_requests: number
  modules_enabled: string[]
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const headers = await getAuthHeaders()
      fetch(`${API_BASE}/v1/analytics/summary`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.organization) setSubscription(d.organization)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
    load()
  }, [])

  const startCheckout = async (plan: string) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/v1/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        plan,
        success_url: `${window.location.origin}/dashboard/settings?billing=success`,
        cancel_url: `${window.location.origin}/dashboard/settings`,
      }),
    })
    if (!res.ok) throw new Error('Failed to create checkout session')
    const data = await res.json()
    window.location.href = data.checkout_url
  }

  const openPortal = async () => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/v1/billing/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
    })
    if (!res.ok) throw new Error('Failed to create portal session')
    const data = await res.json()
    window.location.href = data.portal_url
  }

  return { subscription, loading, startCheckout, openPortal }
}
