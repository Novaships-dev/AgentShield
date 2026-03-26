'use client'

import { use } from 'react'
import { useAgent } from '@/hooks/useAgents'
import { useAnalytics } from '@/hooks/useAnalytics'
import AgentDetail from '@/components/dashboard/AgentDetail'
import GlassCard from '@/components/ui/GlassCard'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AgentDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { agent, isLoading: agentLoading, error } = useAgent(id)
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics({ agentId: id })

  if (agentLoading || analyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <GlassCard key={i}>
              <div className="h-16 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
            </GlassCard>
          ))}
        </div>
        <GlassCard>
          <div className="h-64 animate-pulse rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </GlassCard>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
          Agent not found
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {error ?? `No agent found with ID ${id}`}
        </p>
      </div>
    )
  }

  return <AgentDetail agent={agent} analytics={analytics} />
}
