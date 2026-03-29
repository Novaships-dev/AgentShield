'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type TimelineDay = { date: string; count: number; total_cost_usd: number }
type Overview = { events_today: number; events_this_week: number; events_this_month: number }
type Org = { name: string; event_count: number }

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: '#fff' }}>{value}</p>
    </div>
  )
}

export default function AdminEventsPage() {
  const { session } = useAuth()
  const [timeline, setTimeline] = useState<TimelineDay[]>([])
  const [overview, setOverview] = useState<Overview | null>(null)
  const [topOrgs, setTopOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.access_token) return
    const headers = { Authorization: `Bearer ${session.access_token}` }

    Promise.all([
      fetch(`${API_BASE}/v1/admin/events/timeline`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/v1/admin/overview`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/v1/admin/organizations?sort_by=event_count&per_page=5`, { headers }).then(r => r.json()),
    ]).then(([tl, ov, orgs]) => {
      setTimeline(tl)
      setOverview(ov)
      setTopOrgs((orgs.data || []).filter((o: Org) => o.event_count > 0))
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>Events Timeline</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Event volume across all organizations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Events Today" value={(overview?.events_today ?? 0).toLocaleString()} />
        <StatCard label="This Week" value={(overview?.events_this_week ?? 0).toLocaleString()} />
        <StatCard label="This Month" value={(overview?.events_this_month ?? 0).toLocaleString()} />
      </div>

      {/* Full-width chart */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Daily Events (30 days)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="count" stroke="#06b6d4" fill="url(#evGrad)" strokeWidth={2} name="Events" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 orgs */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>Top Organizations by Volume</h2>
        {topOrgs.length === 0 ? (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No events yet.</p>
        ) : (
          <div className="space-y-3">
            {topOrgs.map((org, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{org.name}</span>
                <span className="text-sm font-medium" style={{ color: '#fff' }}>{org.event_count.toLocaleString()} events</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
