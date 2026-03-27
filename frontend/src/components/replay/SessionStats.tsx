'use client'

import { Clock, DollarSign, Hash, Users } from 'lucide-react'
import type { SessionTimeline } from '@/types/session'

interface SessionStatsProps {
  session: SessionTimeline
  onShare?: () => void
  onCompare?: (sessionId: string) => void
  shareEnabled?: boolean
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  success: { bg: 'rgba(34,197,94,0.12)', color: '#86efac', label: 'Success' },
  error: { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5', label: 'Error' },
  partial: { bg: 'rgba(249,115,22,0.12)', color: '#fdba74', label: 'Partial' },
  running: { bg: 'rgba(6,182,212,0.12)', color: '#67e8f9', label: 'Running' },
}

export default function SessionStats({ session, onShare, shareEnabled }: SessionStatsProps) {
  const st = STATUS_STYLES[session.status] ?? STATUS_STYLES.running

  return (
    <div
      className="rounded-xl px-5 py-4 flex flex-wrap items-center gap-4 justify-between"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Left: ID + status */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
          {session.session_id}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
          {st.label}
        </span>
        {session.agents_involved.length > 0 && (
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Users className="w-3.5 h-3.5" />
            {session.agents_involved.join(', ')}
          </div>
        )}
      </div>

      {/* Middle: metrics */}
      <div className="flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <DollarSign className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
            {session.total_cost_usd != null ? `$${session.total_cost_usd.toFixed(4)}` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-primary)' }}>{formatDuration(session.duration_ms)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Hash className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-primary)' }}>{session.total_steps} steps</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {session.total_tokens.toLocaleString()} tokens
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {shareEnabled && onShare && (
          <button
            onClick={onShare}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Share
          </button>
        )}
      </div>
    </div>
  )
}
