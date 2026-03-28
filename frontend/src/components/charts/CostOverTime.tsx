'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import GlassCard from '@/components/ui/GlassCard'
import type { TimeseriesPoint } from '@/types/analytics'

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffDays = (now.getTime() - d.getTime()) / 86400000
    if (diffDays < 2) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-lg text-sm"
      style={{
        background: 'rgba(18,18,30,0.95)',
        border: '1px solid var(--border-2)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-mono font-medium" style={{ color: 'var(--accent)' }}>
        ${payload[0]?.value?.toFixed(4) ?? '0'}
      </p>
    </div>
  )
}

interface CostOverTimeProps {
  data: TimeseriesPoint[]
  isLoading?: boolean
}

export default function CostOverTime({ data, isLoading }: CostOverTimeProps) {
  const chartData = data.map(p => ({
    ts: formatTimestamp(p.timestamp),
    cost: p.cost_usd,
    requests: p.requests,
  }))

  return (
    <GlassCard style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Cost Over Time
        </span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[260px] flex flex-col items-center justify-center gap-2">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Start tracking events to see cost trends.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="ts"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#7C3AED"
                strokeWidth={2}
                fill="url(#costGradient)"
                dot={false}
                activeDot={{ r: 4, fill: '#7C3AED' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  )
}
