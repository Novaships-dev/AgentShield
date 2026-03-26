export type AgentStatus = 'active' | 'warning' | 'frozen' | 'inactive'

export interface Agent {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  is_frozen: boolean
  status: AgentStatus
  cost_today_usd: number
  cost_month_usd: number
  cost_trend_pct: number
  requests_today: number
  last_event_at: string | null
  created_at: string
}

export interface AgentsListResponse {
  data: Agent[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}
