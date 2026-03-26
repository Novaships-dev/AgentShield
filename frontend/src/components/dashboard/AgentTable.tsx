'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import type { Agent, AgentStatus } from '@/types/agent'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { LiveEvent } from '@/types/analytics'

type SortKey = 'name' | 'cost_today_usd' | 'cost_month_usd' | 'requests_today' | 'last_event_at'
type SortDir = 'asc' | 'desc'

function StatusBadge({ status }: { status: AgentStatus }) {
  const config: Record<AgentStatus, { label: string; color: string; bg: string }> = {
    active:   { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    warning:  { label: 'Warning',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    frozen:   { label: 'Frozen',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    inactive: { label: 'Inactive',  color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  }
  const { label, color, bg } = config[status] ?? config.inactive
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color, background: bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {label}
    </span>
  )
}

function formatCost(usd: number) {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd > 0) return `$${usd.toFixed(4)}`
  return '$0'
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

interface AgentTableProps {
  agents: Agent[]
  isLoading?: boolean
}

export default function AgentTable({ agents: initialAgents, isLoading }: AgentTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('cost_today_usd')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [agents, setAgents] = useState<Agent[]>(initialAgents)

  // Sync with parent data
  useMemo(() => { setAgents(initialAgents) }, [initialAgents])

  // Update cost_today when WebSocket fires
  const handleNewEvent = useCallback((rawData: unknown) => {
    const event = rawData as LiveEvent
    setAgents(prev =>
      prev.map(a =>
        a.name === event.agent
          ? {
              ...a,
              cost_today_usd: a.cost_today_usd + event.cost_usd,
              requests_today: a.requests_today + 1,
              last_event_at: event.tracked_at,
              status: 'active' as AgentStatus,
            }
          : a
      )
    )
  }, [])

  useWebSocket('new_event', handleNewEvent)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...agents].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [agents, sortKey, sortDir])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <Minus className="w-3 h-3 opacity-20" strokeWidth={2} />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3" strokeWidth={2} />
      : <ChevronDown className="w-3 h-3" strokeWidth={2} />
  }

  function ColHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-4 py-3 text-left cursor-pointer select-none group"
        onClick={() => toggleSort(col)}
      >
        <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
          <SortIcon col={col} />
        </div>
      </th>
    )
  }

  if (isLoading) {
    return (
      <GlassCard>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      </GlassCard>
    )
  }

  if (agents.length === 0) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>No agents yet</p>
          <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
            Agents are created automatically when you track your first event via{' '}
            <code className="font-mono text-xs" style={{ color: 'var(--accent2)' }}>POST /v1/track</code>.
          </p>
        </div>
      </GlassCard>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <thead style={{ borderBottom: '1px solid var(--border)' }}>
          <tr>
            <ColHeader col="name" label="Name" />
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
            <ColHeader col="cost_today_usd" label="Cost Today" />
            <ColHeader col="cost_month_usd" label="Cost Month" />
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Trend</th>
            <ColHeader col="requests_today" label="Req Today" />
            <ColHeader col="last_event_at" label="Last Event" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((agent, i) => (
            <tr
              key={agent.id}
              className="cursor-pointer transition-colors"
              style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : undefined }}
              onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="px-4 py-3">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {agent.name}
                </span>
                {agent.description && (
                  <p className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                    {agent.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={agent.status as AgentStatus} />
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                  {formatCost(agent.cost_today_usd)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {formatCost(agent.cost_month_usd)}
                </span>
              </td>
              <td className="px-4 py-3">
                {agent.cost_trend_pct === 0 ? (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                ) : agent.cost_trend_pct > 0 ? (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#ef4444' }}>
                    <TrendingUp className="w-3 h-3" strokeWidth={2} />
                    +{agent.cost_trend_pct.toFixed(1)}%
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#10b981' }}>
                    <TrendingDown className="w-3 h-3" strokeWidth={2} />
                    {agent.cost_trend_pct.toFixed(1)}%
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {agent.requests_today.toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {timeAgo(agent.last_event_at)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
