'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api'
import type { Agent, AgentsListResponse } from '@/types/agent'

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    try {
      const result = await apiFetch<AgentsListResponse>(
        '/v1/agents?limit=100',
        { token: session.access_token }
      )
      setAgents(result.data)
      setTotal(result.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { agents, total, isLoading, error, refetch: fetch }
}

export function useAgent(id: string) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    try {
      const result = await apiFetch<Agent>(
        `/v1/agents/${id}`,
        { token: session.access_token }
      )
      setAgent(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { agent, isLoading, error, refetch: fetch }
}
