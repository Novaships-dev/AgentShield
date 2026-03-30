'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Clock, DollarSign, Hash } from 'lucide-react'
import Link from 'next/link'
import type { SessionTimeline, StepData } from '@/types/session'
import DivergenceList, { computeDivergences } from '@/components/replay/DivergenceList'

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchSession(id: string): Promise<SessionTimeline | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/v1/sessions/${encodeURIComponent(id)}`, {
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  if (!res.ok) return null
  return res.json()
}

function formatDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function stepBg(stepA: StepData | undefined, stepB: StepData | undefined) {
  if (!stepA || !stepB) return 'rgba(239,68,68,0.06)'
  if (stepA.model !== stepB.model) return 'rgba(249,115,22,0.06)'
  if (stepA.cost_usd != null && stepB.cost_usd != null && Math.abs(stepA.cost_usd - stepB.cost_usd) > 0.001)
    return 'rgba(234,179,8,0.06)'
  return 'transparent'
}

function SessionSide({ session }: { session: SessionTimeline }) {
  return (
    <div className="space-y-1">
      <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{session.session_id}</span>
        <div className="flex gap-3 mt-1">
          <span><DollarSign className="w-3 h-3 inline" />${(session.total_cost_usd ?? 0).toFixed(4)}</span>
          <span><Hash className="w-3 h-3 inline" />{session.total_steps} steps</span>
          <span><Clock className="w-3 h-3 inline" />{formatDuration(session.duration_ms)}</span>
        </div>
      </div>
    </div>
  )
}

function StepRow({ stepA, stepB, maxLen }: { stepA: StepData | undefined; stepB: StepData | undefined; maxLen: number }) {
  const bg = stepBg(stepA, stepB)
  return (
    <div className="grid grid-cols-2 border-b text-xs" style={{ borderColor: 'var(--border)', background: bg }}>
      {/* A */}
      <div className="px-4 py-2.5 border-r" style={{ borderColor: 'var(--border)' }}>
        {stepA ? (
          <>
            <span style={{ color: 'var(--text-primary)' }}>{stepA.step_name ?? stepA.agent}</span>
            <span className="ml-2 font-mono" style={{ color: '#a78bfa' }}>
              {stepA.cost_usd != null ? `$${stepA.cost_usd.toFixed(4)}` : ''}
            </span>
            {stepA.status === 'error' && <span className="ml-1" style={{ color: '#fca5a5' }}>⚠</span>}
            {stepA.guardrail_violations.length > 0 && <span className="ml-1" style={{ color: '#f97316' }}>🛡</span>}
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>(absent)</span>
        )}
      </div>
      {/* B */}
      <div className="px-4 py-2.5">
        {stepB ? (
          <>
            <span style={{ color: 'var(--text-primary)' }}>{stepB.step_name ?? stepB.agent}</span>
            <span className="ml-2 font-mono" style={{ color: '#a78bfa' }}>
              {stepB.cost_usd != null ? `$${stepB.cost_usd.toFixed(4)}` : ''}
            </span>
            {stepB.status === 'error' && <span className="ml-1" style={{ color: '#fca5a5' }}>⚠</span>}
            {stepB.guardrail_violations.length > 0 && <span className="ml-1" style={{ color: '#f97316' }}>🛡</span>}
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>(absent)</span>
        )}
      </div>
    </div>
  )
}

function CompareContent() {
  const searchParams = useSearchParams()
  const idA = searchParams.get('a') ?? ''
  const idB = searchParams.get('b') ?? ''
  const [sessionA, setSessionA] = useState<SessionTimeline | null>(null)
  const [sessionB, setSessionB] = useState<SessionTimeline | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!idA || !idB) return
    setLoading(true)
    Promise.all([fetchSession(idA), fetchSession(idB)])
      .then(([a, b]) => { setSessionA(a); setSessionB(b) })
      .finally(() => setLoading(false))
  }, [idA, idB])

  const maxLen = Math.max(sessionA?.steps.length ?? 0, sessionB?.steps.length ?? 0)
  const divergences = sessionA && sessionB ? computeDivergences(sessionA.steps, sessionB.steps) : []

  return (
    <div className="space-y-6">
      <Link href="/dashboard/sessions" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft className="w-4 h-4" />
        Back to Sessions
      </Link>
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Compare Sessions</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Side-by-side step comparison with divergence detection.</p>
      </div>

      {loading && (
        <div className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
      )}

      {!loading && (!sessionA || !sessionB) && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          Could not load one or both sessions.
        </div>
      )}

      {!loading && sessionA && sessionB && (
        <>
          {/* Split header */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="border-r" style={{ borderColor: 'var(--border)' }}>
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', background: 'rgba(124,58,237,0.06)' }}>Session A</div>
                <SessionSide session={sessionA} />
              </div>
              <div>
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', background: 'rgba(6,182,212,0.06)' }}>Session B</div>
                <SessionSide session={sessionB} />
              </div>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="px-4 py-1.5 text-xs uppercase tracking-wide font-medium border-r" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Steps (A)</div>
              <div className="px-4 py-1.5 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Steps (B)</div>
            </div>
            {Array.from({ length: maxLen }, (_, i) => (
              <StepRow key={i} stepA={sessionA.steps[i]} stepB={sessionB.steps[i]} maxLen={maxLen} />
            ))}
          </div>

          <DivergenceList
            divergences={divergences}
            costA={sessionA.total_cost_usd}
            costB={sessionB.total_cost_usd}
          />
        </>
      )}
    </div>
  )
}

export default function CompareSessionsPage() {
  return (
    <Suspense fallback={<div className="h-48 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />}>
      <CompareContent />
    </Suspense>
  )
}
