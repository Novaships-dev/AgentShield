'use client'

import StatsCards from '@/components/dashboard/StatsCards'
import LiveFeed from '@/components/dashboard/LiveFeed'
import CostOverTime from '@/components/charts/CostOverTime'
import CostByAgent from '@/components/charts/CostByAgent'
import CostByProvider from '@/components/charts/CostByProvider'
import CostByModel from '@/components/charts/CostByModel'
import { useAnalytics } from '@/hooks/useAnalytics'

export default function DashboardPage() {
  const { data, summary, isLoading } = useAnalytics({ range: '30d' })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Real-time overview of your AI agent costs and activity.
        </p>
      </div>

      {/* KPI Cards */}
      <StatsCards summary={summary} isLoading={isLoading} />

      {/* Cost Over Time — full width */}
      <CostOverTime data={data?.timeseries ?? []} isLoading={isLoading} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostByAgent data={data?.by_agent ?? []} isLoading={isLoading} />
        <CostByProvider data={data?.by_provider ?? []} isLoading={isLoading} />
      </div>

      {/* Charts + Live feed row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostByModel data={data?.by_model ?? []} isLoading={isLoading} />
        <LiveFeed />
      </div>
    </div>
  )
}
