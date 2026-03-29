'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type Org = {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
  user_count: number
  agent_count: number
  event_count: number
  total_cost_usd: number
  last_event_at: string | null
}

const planColors: Record<string, string> = { free: '#6b7280', starter: '#3b82f6', pro: '#7c3aed', team: '#06b6d4' }

export default function AdminOrganizationsPage() {
  const { session } = useAuth()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')

  useEffect(() => {
    if (!session?.access_token) return
    fetch(`${API_BASE}/v1/admin/organizations?per_page=100&sort_by=${sortBy}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { setOrgs(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session?.access_token, sortBy])

  const filtered = search
    ? orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    : orgs

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
        <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>Organizations</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{orgs.length} total organizations</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', minWidth: 200 }}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
        >
          <option value="created_at">Sort: Created</option>
          <option value="event_count">Sort: Events</option>
          <option value="total_cost_usd">Sort: Cost</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Name', 'Plan', 'Users', 'Agents', 'Events', 'Cost', 'Last Active'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(org => (
                <tr key={org.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium" style={{ color: '#fff' }}>{org.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{org.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: `${planColors[org.plan] ?? '#6b7280'}20`, color: planColors[org.plan] ?? '#6b7280' }}
                    >
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{org.user_count}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{org.agent_count}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{org.event_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>${org.total_cost_usd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {org.last_event_at ? new Date(org.last_event_at).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No organizations found.
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
