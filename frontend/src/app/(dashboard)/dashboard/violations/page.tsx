'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ShieldCheck, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useWebSocket } from '@/hooks/useWebSocket'

interface Violation {
  id: string
  rule_id: string | null
  guardrail_name: string | null
  agent_id: string | null
  agent_name: string | null
  session_id: string | null
  matched_content: string | null
  action_taken: string
  created_at: string
}

const ACTION_STYLES: Record<string, { bg: string; color: string }> = {
  log: { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
  redact: { bg: 'rgba(249,115,22,0.12)', color: '#fdba74' },
  block: { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5' },
}

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const loadViolations = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/v1/violations?page=${page}&per_page=50`, {
        headers,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setViolations(data.data ?? [])
      setTotalPages(data.pagination?.total_pages ?? 1)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [page])

  useEffect(() => { loadViolations() }, [loadViolations])

  // WebSocket live: slide-in new violations
  useWebSocket('violation', useCallback((data: unknown) => {
    const d = data as { rule_name: string; agent: string; action: string }
    // Add a placeholder at the top and reload
    const tempId = `ws-${Date.now()}`
    const newViolation: Violation = {
      id: tempId,
      rule_id: null,
      guardrail_name: d.rule_name,
      agent_id: null,
      agent_name: d.agent,
      session_id: null,
      matched_content: null,
      action_taken: d.action,
      created_at: new Date().toISOString(),
    }
    setViolations(prev => [newViolation, ...prev.slice(0, 49)])
    setNewIds(prev => new Set([...prev, tempId]))
    setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(tempId); return n }), 3000)
  }, []))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Violations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          All guardrail violations — click a session ID to replay.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="space-y-0">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 animate-pulse" style={{ borderBottom: '1px solid var(--border)' }} />)}
          </div>
        ) : violations.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ShieldCheck className="w-10 h-10 mx-auto" style={{ color: '#22c55e' }} />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No violations detected. All clear! ✅</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Guardrail violations will appear here when rules are triggered.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[140px_1fr_1fr_80px_120px_60px] gap-3 px-5 py-2.5 text-xs uppercase tracking-wide font-medium" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>Time</span><span>Rule</span><span>Agent</span><span>Action</span><span>Session</span><span />
            </div>
            {violations.map(v => {
              const as = ACTION_STYLES[v.action_taken] ?? ACTION_STYLES.log
              const isNew = newIds.has(v.id)
              return (
                <div
                  key={v.id}
                  className="grid grid-cols-[140px_1fr_1fr_80px_120px_60px] gap-3 px-5 py-3 items-center transition-all duration-500"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: isNew ? 'rgba(124,58,237,0.06)' : undefined,
                    transform: isNew ? 'translateX(-4px)' : 'none',
                  }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {v.guardrail_name ?? '—'}
                  </span>
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {v.agent_name ?? '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full text-center" style={{ background: as.bg, color: as.color }}>
                    {v.action_taken}
                  </span>
                  {v.session_id ? (
                    <Link
                      href={`/dashboard/sessions/${encodeURIComponent(v.session_id)}`}
                      className="flex items-center gap-1 text-xs font-mono truncate hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {v.session_id.slice(0, 16)}…
                    </Link>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                  {v.matched_content && (
                    <span className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }} title={v.matched_content}>
                      {v.matched_content.slice(0, 20)}
                    </span>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg disabled:opacity-30" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg disabled:opacity-30" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
