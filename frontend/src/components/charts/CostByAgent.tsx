'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import GlassCard from '@/components/ui/GlassCard'
import type { AgentBreakdown } from '@/types/analytics'

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: AgentBreakdown }[] }) {
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
      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.payload.agent_name}</p>
      <p className="font-mono" style={{ color: 'var(--accent)' }}>${item.value?.toFixed(4)}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.payload.pct}% of total</p>
    </div>
  )
}

interface CostByAgentProps {
  data: AgentBreakdown[]
  isLoading?: boolean
}

export default function CostByAgent({ data, isLoading }: CostByAgentProps) {
  const top5 = data.slice(0, 5).map(a => ({ ...a, name: a.agent_name }))

  return (
    <GlassCard style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Cost by Agent
        </span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : top5.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No agent data yet</p>
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
                width={90}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
              <Bar dataKey="cost_usd" radius={[0, 4, 4, 0]}>
                {top5.map((_, i) => (
                  <Cell
                    key={i}
                    fill={`rgba(124,58,237,${1 - i * 0.15})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  )
}
