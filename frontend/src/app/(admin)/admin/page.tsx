'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type Overview = {
  total_organizations: number
  total_users: number
  total_agents: number
  total_events: number
  total_sessions: number
  total_cost_usd: number
  events_today: number
  events_this_week: number
  events_this_month: number
  active_organizations_7d: number
}

type TimelineDay = { date: string; count: number; total_cost_usd: number }
type Revenue = { mrr: number; arr: number; plan_breakdown: Record<string, number> }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#fff' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
    </div>
  )
}

export default function AdminOverviewPage() {
  const { session } = useAuth()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [timeline, setTimeline] = useState<TimelineDay[]>([])
  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token) return
    const headers = { Authorization: `Bearer ${session.access_token}` }

    Promise.all([
      fetch(`${API_BASE}/v1/admin/overview`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/v1/admin/events/timeline`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/v1/admin/revenue`, { headers }).then(r => r.json()),
    ]).then(([ov, tl, rev]) => {
      setOverview(ov)
      setTimeline(tl)
      setRevenue(rev)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [session?.access_token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const planColors: Record<string, string> = { free: '#6b7280', starter: '#3b82f6', pro: '#7c3aed', team: '#06b6d4' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>Platform Overview</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>All metrics across all organizations.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Orgs" value={overview?.total_organizations ?? 0} />
        <StatCard label="Total Users" value={overview?.total_users ?? 0} />
        <StatCard label="Total Agents" value={overview?.total_agents ?? 0} />
        <StatCard label="Total Events" value={(overview?.total_events ?? 0).toLocaleString()} />
        <StatCard label="Total Cost" value={`$${(overview?.total_cost_usd ?? 0).toFixed(2)}`} />
        <StatCard label="Active Orgs (7d)" value={overview?.active_organizations_7d ?? 0} />
      </div>

      {/* Event volume chart */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Events (30 days)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="count" stroke="#7c3aed" fill="url(#eventGrad)" strokeWidth={2} name="Events" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity + Revenue row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity stats */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Activity</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Events today</span>
              <span className="text-sm font-medium" style={{ color: '#fff' }}>{(overview?.events_today ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Events this week</span>
              <span className="text-sm font-medium" style={{ color: '#fff' }}>{(overview?.events_this_week ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Events this month</span>
              <span className="text-sm font-medium" style={{ color: '#fff' }}>{(overview?.events_this_month ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Total sessions</span>
              <span className="text-sm font-medium" style={{ color: '#fff' }}>{(overview?.total_sessions ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* MRR card */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Revenue</h2>
          <p className="text-3xl font-bold mb-1" style={{ color: '#fff' }}>${revenue?.mrr ?? 0}<span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>/mo</span></p>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>ARR: ${((revenue?.arr ?? 0)).toLocaleString()}</p>
          <div className="space-y-2">
            {Object.entries(revenue?.plan_breakdown ?? {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ background: `${planColors[plan] ?? '#6b7280'}20`, color: planColors[plan] ?? '#6b7280' }}
                >
                  {plan}
                </span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{count} org{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
