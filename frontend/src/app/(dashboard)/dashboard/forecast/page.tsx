'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

type AgentForecast = {
  agent_id: string
  agent_name: string
  projected_eom_usd: number
  pct_of_total: number
}

type OrgForecast = {
  projected_eom_usd: number | null
  confidence_low: number | null
  confidence_high: number | null
  current_month_usd: number
  days_elapsed: number
  days_remaining: number
  insufficient_data: boolean
  calculated_at: string
}

type ForecastData = {
  organization: OrgForecast
  by_agent: AgentForecast[]
}

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function ForecastBanner({ org }: { org: OrgForecast }) {
  if (org.insufficient_data || !org.projected_eom_usd) {
    return (
      <div
        className="rounded-xl p-5 flex items-center gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <AlertCircle className="w-8 h-8 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        <div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Not enough data yet</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            We need at least 3 days of data to generate a forecast. Check back soon.
          </p>
        </div>
      </div>
    )
  }

  const spread = ((org.confidence_high! - org.confidence_low!) / 2)
  const confidence = spread.toFixed(2)

  return (
    <div
      className="rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Projected EOM</p>
        <p className="text-2xl font-semibold mt-1 font-mono" style={{ color: 'var(--text-primary)' }}>
          ${org.projected_eom_usd.toFixed(2)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>±${confidence}</p>
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This Month So Far</p>
        <p className="text-2xl font-semibold mt-1 font-mono" style={{ color: 'var(--text-primary)' }}>
          ${org.current_month_usd.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Days Elapsed</p>
        <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
          {org.days_elapsed}
        </p>
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Days Remaining</p>
        <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
          {org.days_remaining}
        </p>
      </div>
    </div>
  )
}

function ForecastChart({ org }: { org: OrgForecast }) {
  if (org.insufficient_data || !org.projected_eom_usd) return null

  const daysInMonth = org.days_elapsed + org.days_remaining
  const dailyRate = org.current_month_usd / org.days_elapsed
  const projectedDailyRate = org.projected_eom_usd / daysInMonth

  // Build chart: actual days + projected days
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const isActual = day <= org.days_elapsed
    return {
      day: `Day ${day}`,
      actual: isActual ? parseFloat((dailyRate * day).toFixed(4)) : null,
      projected: parseFloat((projectedDailyRate * day).toFixed(4)),
      low: parseFloat(((org.confidence_low! / daysInMonth) * day).toFixed(4)),
      high: parseFloat(((org.confidence_high! / daysInMonth) * day).toFixed(4)),
    }
  })

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
        Cost Trajectory — Month to Date + Projection
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}`}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(18,18,30,0.95)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
            formatter={(val: number, name: string) => [`$${val?.toFixed(4)}`, name]}
          />
          <ReferenceLine x={`Day ${org.days_elapsed}`} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 2" label={{ value: 'Today', fill: 'var(--text-muted)', fontSize: 11 }} />
          {/* Confidence band */}
          <Area type="monotone" dataKey="high" stroke="none" fill="url(#confGrad)" name="Confidence High" dot={false} />
          <Area type="monotone" dataKey="low" stroke="none" fill="rgba(0,0,0,0)" name="Confidence Low" dot={false} />
          {/* Projected */}
          <Area type="monotone" dataKey="projected" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="5 3" fill="url(#projGrad)" name="Projected" dot={false} />
          {/* Actual */}
          <Area type="monotone" dataKey="actual" stroke="#7C3AED" strokeWidth={2} fill="url(#actualGrad)" name="Actual" dot={false} connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-6 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ background: '#7C3AED' }} /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 border-t border-dashed" style={{ borderColor: '#06b6d4' }} /> Projected</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-2 opacity-30" style={{ background: '#06b6d4' }} /> ±15% confidence</span>
      </div>
    </div>
  )
}

function AgentBreakdown({ agents }: { agents: AgentForecast[] }) {
  if (agents.length === 0) return null

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
        Projected by Agent
      </h2>
      <div className="space-y-3">
        {agents.map(agent => (
          <div key={agent.agent_id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span style={{ color: 'var(--text-primary)' }}>{agent.agent_name}</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                ${agent.projected_eom_usd.toFixed(2)} — {agent.pct_of_total.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${agent.pct_of_total}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getAuthHeaders().then(headers =>
    fetch(`${API_BASE}/v1/forecasts`, { headers: { 'Content-Type': 'application/json', ...headers } }))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setData)
      .catch(() => setError('Failed to load forecast data.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Forecast</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          End-of-month cost projection based on current spend trends.
        </p>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          <ForecastBanner org={data.organization} />
          <ForecastChart org={data.organization} />
          <AgentBreakdown agents={data.by_agent} />
        </>
      )}
    </div>
  )
}
