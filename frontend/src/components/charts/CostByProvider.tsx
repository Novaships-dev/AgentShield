'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import GlassCard from '@/components/ui/GlassCard'
import type { ProviderBreakdown } from '@/types/analytics'

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#7C3AED',
  anthropic: '#06B6D4',
  google: '#F59E0B',
  mistral: '#EC4899',
  cohere: '#3B82F6',
}

function getColor(provider: string, index: number): string {
  const lower = provider.toLowerCase()
  if (PROVIDER_COLORS[lower]) return PROVIDER_COLORS[lower]
  const fallbacks = ['#8B5CF6', '#14B8A6', '#F97316', '#EF4444', '#84CC16']
  return fallbacks[index % fallbacks.length]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: ProviderBreakdown }[] }) {
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
      <p className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{item.payload.provider}</p>
      <p className="font-mono" style={{ color: 'var(--accent)' }}>${item.value?.toFixed(4)}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.payload.pct}% of total</p>
    </div>
  )
}

interface CostByProviderProps {
  data: ProviderBreakdown[]
  isLoading?: boolean
}

export default function CostByProvider({ data, isLoading }: CostByProviderProps) {
  const chartData = data.map((p, i) => ({ ...p, color: getColor(p.provider, i) }))
  const total = data.reduce((s, p) => s + p.cost_usd, 0)

  return (
    <GlassCard style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Cost by Provider
        </span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No provider data yet</p>
          </div>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="cost_usd"
                  nameKey="provider"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              style={{ top: '-8px' }}
            >
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total</span>
              <span className="text-base font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
