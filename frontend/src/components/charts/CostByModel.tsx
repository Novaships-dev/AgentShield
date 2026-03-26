'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import GlassCard from '@/components/ui/GlassCard'
import type { ModelBreakdown } from '@/types/analytics'

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#7C3AED',
  anthropic: '#06B6D4',
  google: '#F59E0B',
  mistral: '#EC4899',
}

function getColor(provider: string): string {
  return PROVIDER_COLORS[provider?.toLowerCase()] ?? '#8B5CF6'
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: ModelBreakdown }[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div
      className="px-3 py-2 rounded-lg text-sm"
      style={{
        background: 'rgba(18,18,30,0.95)',
        border: '1px solid var(--border-2)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.payload.model}</p>
      <p className="text-xs capitalize mb-1" style={{ color: 'var(--text-muted)' }}>{item.payload.provider}</p>
      <p className="font-mono" style={{ color: 'var(--accent2)' }}>${item.value?.toFixed(4)}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.payload.pct}% of total</p>
    </div>
  )
}

interface CostByModelProps {
  data: ModelBreakdown[]
  isLoading?: boolean
}

export default function CostByModel({ data, isLoading }: CostByModelProps) {
  const top5 = data.slice(0, 5).map(m => ({
    ...m,
    name: m.model?.length > 20 ? m.model.slice(0, 18) + '…' : m.model,
  }))

  return (
    <GlassCard style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Cost by Model
        </span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent2)', borderTopColor: 'transparent' }} />
          </div>
        ) : top5.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No model data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={top5} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6,182,212,0.06)' }} />
              <Bar dataKey="cost_usd" radius={[0, 4, 4, 0]}>
                {top5.map((entry, i) => (
                  <Cell key={i} fill={getColor(entry.provider)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  )
}
