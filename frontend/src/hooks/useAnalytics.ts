'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getAccessToken } from '@/lib/auth-header'
import { apiFetch } from '@/lib/api'
import type { AnalyticsResponse, LiveEvent } from '@/types/analytics'
import { useWebSocket } from './useWebSocket'

interface UseAnalyticsOptions {
  range?: string
  agentId?: string
  provider?: string
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { range = '30d', agentId, provider } = options
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Live increments (from WebSocket)
  const [costDelta, setCostDelta] = useState(0)
  const [requestsDelta, setRequestsDelta] = useState(0)

  const fetchAnalytics = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const params = new URLSearchParams({ range })
      if (agentId) params.set('agent_id', agentId)
      if (provider) params.set('provider', provider)
      const result = await apiFetch<AnalyticsResponse>(
        `/v1/analytics?${params}`,
        { token }
      )
      setData(result)
      // Reset deltas after a fresh fetch
      setCostDelta(0)
      setRequestsDelta(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }, [range, agentId, provider])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // WebSocket: increment KPIs on new_event
  const handleNewEvent = useCallback((rawData: unknown) => {
    const event = rawData as LiveEvent
    if (!event?.cost_usd) return
    setCostDelta(prev => prev + event.cost_usd)
    setRequestsDelta(prev => prev + 1)
  }, [])

  // Fallback polling
  const handlePoll = useCallback(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  useWebSocket('new_event', handleNewEvent)
  useWebSocket('_poll', handlePoll)

  // Computed totals include live deltas
  const summary = data?.summary
    ? {
        ...data.summary,
        total_cost_usd: data.summary.total_cost_usd + costDelta,
        total_requests: data.summary.total_requests + requestsDelta,
      }
    : null

  return {
    data,
    summary,
    isLoading,
    error,
    refetch: fetchAnalytics,
  }
}
