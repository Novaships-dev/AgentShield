'use client'

import { useState, useCallback } from 'react'
import GlassCard from '@/components/ui/GlassCard'
import { TrendingUp, TrendingDown, Bot, DollarSign, Activity, Zap } from 'lucide-react'
import type { AnalyticsSummary } from '@/types/analytics'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { LiveEvent } from '@/types/analytics'

function formatCost(usd: number) {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`
  if (usd >= 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4)}`
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

interface StatCardProps {
  label: string
  value: string
  trend?: { value: number; isPositive: boolean } | null
  icon: React.ElementType
  accentColor?: string
  skeleton?: boolean
}

function StatCard({ label, value, trend, icon: Icon, accentColor = 'var(--accent)', skeleton }: StatCardProps) {
  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}18` }}
        >
          <Icon className="w-4 h-4" strokeWidth={1.5} style={{ color: accentColor }} />
        </div>
      </div>
      {skeleton ? (
        <div className="h-8 w-24 rounded-md animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      ) : (
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>
            {value}
          </span>
          {trend && (
            <div
              className="flex items-center gap-0.5 text-xs font-medium mb-0.5"
              style={{ color: trend.isPositive ? '#10b981' : '#ef4444' }}
            >
              {trend.isPositive ? <TrendingUp className="w-3 h-3" strokeWidth={2} /> : <TrendingDown className="w-3 h-3" strokeWidth={2} />}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

interface StatsCardsProps {
  summary: AnalyticsSummary | null
  isLoading?: boolean
}

export default function StatsCards({ summary, isLoading }: StatsCardsProps) {
  const [costDelta, setCostDelta] = useState(0)
  const [requestsDelta, setRequestsDelta] = useState(0)

  const handleNewEvent = useCallback((rawData: unknown) => {
    const event = rawData as LiveEvent
    setCostDelta(prev => prev + (event?.cost_usd ?? 0))
    setRequestsDelta(prev => prev + 1)
  }, [])

  useWebSocket('new_event', handleNewEvent)

  const totalCost = (summary?.total_cost_usd ?? 0) + costDelta
  const totalRequests = (summary?.total_requests ?? 0) + requestsDelta
  const totalTokens = summary?.total_tokens ?? 0
  const activeAgents = summary?.active_agents ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Cost"
        value={formatCost(totalCost)}
        icon={DollarSign}
        accentColor="var(--accent)"
        skeleton={isLoading}
      />
      <StatCard
        label="Requests"
        value={formatNumber(totalRequests)}
        icon={Activity}
        accentColor="var(--accent2)"
        skeleton={isLoading}
      />
      <StatCard
        label="Tokens Used"
        value={formatNumber(totalTokens)}
        icon={Zap}
        accentColor="var(--accent3)"
        skeleton={isLoading}
      />
      <StatCard
        label="Active Agents"
        value={String(activeAgents)}
        icon={Bot}
        accentColor="#10b981"
        skeleton={isLoading}
      />
    </div>
  )
}
