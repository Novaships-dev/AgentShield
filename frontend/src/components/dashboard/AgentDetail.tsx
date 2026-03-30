'use client'

import { useState } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown, Zap, DollarSign, Activity, Clock, Film, Snowflake, Power } from 'lucide-react'
import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import RecommendationCard from '@/components/dashboard/RecommendationCard'
import CostOverTime from '@/components/charts/CostOverTime'
import type { Agent } from '@/types/agent'
import type { AnalyticsResponse } from '@/types/analytics'

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function formatCost(usd: number) {
  if (usd >= 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(6)}`
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

type AgentStatus = 'active' | 'warning' | 'frozen' | 'inactive'

function StatusBadge({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { label: string; color: string; bg: string }> = {
    active:   { label: 'Active',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    warning:  { label: 'Warning',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    frozen:   { label: 'Frozen',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    inactive: { label: 'Inactive', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  }
  const { label, color, bg } = config[status] ?? config.inactive
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium"
      style={{ color, background: bg }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

interface MetricCardProps {
  label: string
  value: string
  icon: React.ElementType
  color?: string
}

function MetricCard({ label, value, icon: Icon, color = 'var(--accent)' }: MetricCardProps) {
  return (
    <GlassCard className="flex items-center gap-4" style={{ padding: '16px 20px' }}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}
      >
        <Icon className="w-4 h-4" strokeWidth={1.5} style={{ color }} />
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
    </GlassCard>
  )
}

interface AgentDetailProps {
  agent: Agent
  analytics: AnalyticsResponse | null
}

function KillSwitchButton({ agentId, initialFrozen }: { agentId: string; initialFrozen: boolean }) {
  const [frozen, setFrozen] = useState(initialFrozen)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function toggle() {
    setLoading(true)
    setShowConfirm(false)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/v1/agents/${agentId}/kill-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ enabled: !frozen }),
      })
      if (res.ok) setFrozen(f => !f)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {showConfirm && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl p-4 z-50 space-y-3"
          style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {frozen ? 'Unfreeze this agent?' : 'Freeze this agent?'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {frozen
              ? 'The agent will resume accepting tracking events.'
              : 'All tracking events for this agent will be rejected with a 429 error.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={toggle}
              disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: frozen ? '#22c55e' : '#ef4444', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '...' : frozen ? 'Unfreeze' : 'Freeze'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setShowConfirm(s => !s)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        style={frozen
          ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
          : { background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
        }
        title={frozen ? 'Agent is frozen — click to unfreeze' : 'Activate kill switch to freeze this agent'}
      >
        {frozen ? <Snowflake className="w-4 h-4" /> : <Power className="w-4 h-4" />}
        {frozen ? 'Frozen' : 'Kill Switch'}
      </button>
    </div>
  )
}

export default function AgentDetail({ agent, analytics }: AgentDetailProps) {
  const summary = analytics?.summary
  const timeseries = analytics?.timeseries ?? []

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Back to Agents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {agent.name}
            </h1>
            <StatusBadge status={agent.status as AgentStatus} />
          </div>
          {agent.description && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {agent.description}
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Last event: {timeAgo(agent.last_event_at)}
          </p>
        </div>
        <KillSwitchButton agentId={agent.id} initialFrozen={agent.is_frozen ?? false} />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Cost Today" value={formatCost(agent.cost_today_usd)} icon={DollarSign} color="var(--accent)" />
        <MetricCard label="Cost Month" value={formatCost(agent.cost_month_usd)} icon={DollarSign} color="var(--accent2)" />
        <MetricCard label="Requests Today" value={agent.requests_today.toLocaleString()} icon={Activity} color="#10b981" />
        <MetricCard
          label="Trend"
          value={agent.cost_trend_pct === 0 ? '—' : `${agent.cost_trend_pct > 0 ? '+' : ''}${agent.cost_trend_pct.toFixed(1)}%`}
          icon={agent.cost_trend_pct >= 0 ? TrendingUp : TrendingDown}
          color={agent.cost_trend_pct > 0 ? '#ef4444' : '#10b981'}
        />
      </div>

      {/* More metrics from analytics */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Total Requests" value={summary.total_requests.toLocaleString()} icon={Activity} color="var(--accent)" />
          <MetricCard label="Avg Cost / Request" value={formatCost(summary.avg_cost_per_request)} icon={Zap} color="var(--accent3)" />
          <MetricCard label="Error Rate" value={`${summary.error_rate_pct.toFixed(1)}%`} icon={Clock} color={summary.error_rate_pct > 5 ? '#ef4444' : '#10b981'} />
        </div>
      )}

      {/* Cost over time chart */}
      <CostOverTime data={timeseries} isLoading={false} />

      {/* Cost Autopilot recommendations for this agent */}
      <RecommendationCard agentFilter={agent.name} limit={3} />

      {/* Sessions section — locked if not on right plan */}
      <GlassCard className="flex items-center gap-4" style={{ padding: '16px 20px' }}>
        <Film className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} style={{ color: 'var(--accent2)' }} />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Session Replay</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            View step-by-step replay of this agent&apos;s sessions.
          </p>
        </div>
        <Link
          href={`/dashboard/sessions?agent_id=${agent.id}`}
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
          style={{
            background: 'rgba(6,182,212,0.1)',
            color: 'var(--accent2)',
            border: '1px solid rgba(6,182,212,0.2)',
          }}
        >
          View Sessions →
        </Link>
      </GlassCard>
    </div>
  )
}
