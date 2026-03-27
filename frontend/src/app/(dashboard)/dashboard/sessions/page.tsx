'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Search, ChevronLeft, ChevronRight, GitCompare } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { SessionSummary } from '@/types/session'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  success: { bg: 'rgba(34,197,94,0.12)', color: '#86efac' },
  error: { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5' },
  partial: { bg: 'rgba(249,115,22,0.12)', color: '#fdba74' },
  running: { bg: 'rgba(6,182,212,0.12)', color: '#67e8f9' },
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.running
  return (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
      {status === 'running' ? '🔄 Running' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<string[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [rangeFilter, setRangeFilter] = useState('7d')
  const [statusFilter, setStatusFilter] = useState('')
  const [minCost, setMinCost] = useState('')
  const [maxCost, setMaxCost] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' })
      if (rangeFilter) params.set('range', rangeFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      if (minCost) params.set('min_cost', minCost)
      if (maxCost) params.set('max_cost', maxCost)

      const res = await fetch(`${API_BASE}/v1/sessions?${params}`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.data ?? [])
      setTotalPages(data.pagination?.total_pages ?? 1)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [page, rangeFilter, statusFilter, search, minCost, maxCost])

  useEffect(() => { loadSessions() }, [loadSessions])

  // WebSocket: update running sessions live
  useWebSocket('session_update', useCallback((data: unknown) => {
    const d = data as { session_id: string; status: string }
    setSessions(prev => prev.map(s =>
      s.session_id === d.session_id ? { ...s, status: d.status as any } : s
    ))
  }, []))

  function toggleSelect(sessionId: string) {
    setSelected(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : prev.length < 2 ? [...prev, sessionId] : prev
    )
  }

  function handleCompare() {
    if (selected.length === 2) {
      router.push(`/dashboard/sessions/compare?a=${selected[0]}&b=${selected[1]}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Sessions</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Step-by-step replay of every agent session.
          </p>
        </div>
        {selected.length === 2 && (
          <button
            onClick={handleCompare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </button>
        )}
        {selected.length > 0 && selected.length < 2 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Select one more session to compare</span>
        )}
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search session ID…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Range */}
        <select
          value={rangeFilter}
          onChange={e => { setRangeFilter(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="partial">Partial</option>
          <option value="running">Running</option>
        </select>

        {/* Min/Max cost */}
        <input
          value={minCost}
          onChange={e => { setMinCost(e.target.value); setPage(1) }}
          placeholder="Min $"
          type="number"
          step="0.001"
          min="0"
          className="w-20 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <input
          value={maxCost}
          onChange={e => { setMaxCost(e.target.value); setPage(1) }}
          placeholder="Max $"
          type="number"
          step="0.001"
          min="0"
          className="w-20 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 animate-pulse" style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Film className="w-10 h-10 mx-auto" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No sessions recorded yet</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Pass a <code>session_id</code> in your SDK calls to start recording.
            </p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div
              className="grid grid-cols-[32px_1fr_1fr_80px_80px_100px_100px] gap-3 px-4 py-2.5 text-xs uppercase tracking-wide font-medium"
              style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <span />
              <span>Session ID</span>
              <span>Agents</span>
              <span>Steps</span>
              <span>Cost</span>
              <span>Duration</span>
              <span>Status</span>
            </div>

            {sessions.map(session => {
              const isSelected = selected.includes(session.session_id)
              return (
                <div
                  key={session.session_id}
                  className="grid grid-cols-[32px_1fr_1fr_80px_80px_100px_100px] gap-3 px-4 py-3 items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(124,58,237,0.06)' : undefined,
                  }}
                  onClick={() => router.push(`/dashboard/sessions/${encodeURIComponent(session.session_id)}`)}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={e => { e.stopPropagation(); toggleSelect(session.session_id) }}
                    className="w-4 h-4 rounded cursor-pointer"
                    onClick={e => e.stopPropagation()}
                  />
                  {/* Session ID */}
                  <span className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{session.session_id}</span>
                  {/* Agents */}
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{session.agents.join(', ') || '—'}</span>
                  {/* Steps */}
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{session.total_steps}</span>
                  {/* Cost */}
                  <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                    {session.total_cost_usd != null ? `$${session.total_cost_usd.toFixed(4)}` : '—'}
                  </span>
                  {/* Duration */}
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDuration(session.duration_ms)}</span>
                  {/* Status */}
                  <StatusBadge status={session.status} />
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg disabled:opacity-30"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg disabled:opacity-30"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
