'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type PayingOrg = { name: string; plan: string; stripe_customer_id: string | null; created_at: string; monthly_price: number }
type Revenue = { mrr: number; arr: number; plan_breakdown: Record<string, number>; paying_organizations: PayingOrg[] }

const planColors: Record<string, string> = { free: '#6b7280', starter: '#3b82f6', pro: '#7c3aed', team: '#06b6d4' }

export default function AdminRevenuePage() {
  const { session } = useAuth()
  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token) return
    fetch(`${API_BASE}/v1/admin/revenue`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { setRevenue(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session?.access_token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const planChartData = Object.entries(revenue?.plan_breakdown ?? {}).map(([plan, count]) => ({
    plan,
    count,
    color: planColors[plan] ?? '#6b7280',
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>Revenue</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>MRR, ARR, and plan breakdown.</p>
      </div>

      {/* MRR / ARR cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Monthly Recurring Revenue</p>
          <p className="text-3xl font-bold" style={{ color: '#fff' }}>${revenue?.mrr ?? 0}</p>
        </div>
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Annual Run Rate</p>
          <p className="text-3xl font-bold" style={{ color: '#fff' }}>${((revenue?.arr ?? 0)).toLocaleString()}</p>
        </div>
      </div>

      {/* Plan breakdown chart */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Organizations by Plan</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planChartData}>
              <XAxis dataKey="plan" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Organizations">
                {planChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Paying organizations table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>Paying Organizations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Organization', 'Plan', 'Monthly', 'Subscribed'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(revenue?.paying_organizations ?? []).map((org, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: '#fff' }}>{org.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: `${planColors[org.plan] ?? '#6b7280'}20`, color: planColors[org.plan] ?? '#6b7280' }}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>${org.monthly_price}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(revenue?.paying_organizations ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No paying organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
