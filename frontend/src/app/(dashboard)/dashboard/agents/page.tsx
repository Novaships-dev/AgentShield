'use client'

import AgentTable from '@/components/dashboard/AgentTable'
import { useAgents } from '@/hooks/useAgents'

export default function AgentsPage() {
  const { agents, total, isLoading, error } = useAgents()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Agents
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isLoading ? 'Loading...' : `${total} agent${total !== 1 ? 's' : ''} tracked`}
          </p>
        </div>
      </div>

      {error && (
        <div
          className="text-sm px-4 py-3 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {error}
        </div>
      )}

      <AgentTable agents={agents} isLoading={isLoading} />
    </div>
  )
}
