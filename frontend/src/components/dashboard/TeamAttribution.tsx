'use client'

import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Download } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const COLORS = ['#7c3aed', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#f87171']

type TeamData = {
  team_label: string
  members: number
  agents: number
  cost_usd: number
  pct: number
}

type AttributionData = {
  period: string
  total_cost_usd: number
  teams: TeamData[]
}

export default function TeamAttribution() {
  const [data, setData] = useState<AttributionData | null>(null)
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const headers = await getAuthHeaders()
    fetch(`${API_BASE}/v1/teams/attribution?period=${period}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { load() }, [load])

  const exportCsv = () => {
    if (!data) return
    const rows = [
      ['Team', 'Members', 'Agents', 'Cost (USD)', '%'],
      ...(data.teams ?? []).map(t => [t.team_label, t.members, t.agents, t.cost_usd.toFixed(4), t.pct]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-attribution-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pieData = (data?.teams ?? []).map((t, i) => ({
    name: t.team_label,
    value: t.cost_usd,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Team Cost Attribution — {period}
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-64 rounded-xl" style={{ background: 'var(--surface)' }} />
      ) : !data || data.teams.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No attribution data for this period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie */}
          <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              Total: ${data.total_cost_usd.toFixed(2)}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {pieData.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Team', 'Members', 'Agents', 'Cost', '%'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.teams.map((t, i) => (
                  <tr key={t.team_label} style={{ borderBottom: i < data.teams.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span style={{ color: 'var(--text-primary)' }}>{t.team_label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{t.members}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{t.agents}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                      ${t.cost_usd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs w-8 text-right" style={{ color: 'var(--text-muted)' }}>{t.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
