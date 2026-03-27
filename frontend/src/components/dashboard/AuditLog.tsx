'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
function getAuthHeader() {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Entry = {
  id: string
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string
  details: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  'plan.upgraded': '#4ade80',
  'plan.downgraded': '#f87171',
  'billing.payment_failed': '#f87171',
  'kill_switch.activated': '#f87171',
  'kill_switch.deactivated': '#4ade80',
  'member.removed': '#f87171',
  'member.invited': '#a78bfa',
}

const ACTION_TYPES = [
  'api_key.created', 'api_key.revoked',
  'alert_rule.created', 'alert_rule.deleted', 'alert_rule.toggled',
  'budget_cap.created', 'budget_cap.deleted',
  'guardrail_rule.created', 'guardrail_rule.deleted',
  'pii_config.updated', 'kill_switch.activated', 'kill_switch.deactivated',
  'session.shared', 'plan.upgraded', 'plan.downgraded', 'billing.payment_failed',
  'member.invited', 'member.role_changed', 'member.removed',
  'webhook.created', 'webhook.deleted', 'webhook.tested', 'report.generated',
]

export default function AuditLog() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterResourceType, setFilterResourceType] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: '50' })
    if (filterAction) params.set('action', filterAction)
    if (filterResourceType) params.set('resource_type', filterResourceType)

    fetch(`${API_BASE}/v1/audit?${params}`, { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : { data: [], total: 0 })
      .then(d => {
        setEntries(d.data ?? [])
        setTotal(d.total ?? 0)
      })
      .finally(() => setLoading(false))
  }, [page, filterAction, filterResourceType])

  useEffect(load, [load])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All actions</option>
          {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filterResourceType}
          onChange={e => { setFilterResourceType(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All resources</option>
          {['organization', 'user', 'agent', 'alert_rule', 'budget', 'guardrail_rule', 'session', 'webhook', 'report', 'invitation'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No audit entries found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Time', 'User', 'Action', 'Resource', 'Details', 'IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs truncate max-w-[140px]" style={{ color: 'var(--text-secondary)' }}>
                    {e.user_email ?? 'system'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{
                        background: ACTION_COLORS[e.action] ? `${ACTION_COLORS[e.action]}18` : 'rgba(255,255,255,0.06)',
                        color: ACTION_COLORS[e.action] ?? 'var(--text-secondary)',
                      }}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>{e.resource_type}</span>
                    <span className="ml-1 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {e.resource_id.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {Object.keys(e.details).length > 0 ? JSON.stringify(e.details) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {e.ip_address ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
          <span>{total} entries</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              Previous
            </button>
            <span className="px-3 py-1.5">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
