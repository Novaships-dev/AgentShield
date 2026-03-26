export interface AnalyticsSummary {
  total_cost_usd: number
  total_requests: number
  total_tokens: number
  active_agents: number
  avg_cost_per_request: number
  error_rate_pct: number
}

export interface TimeseriesPoint {
  timestamp: string
  cost_usd: number
  requests: number
}

export interface AgentBreakdown {
  agent_id: string
  agent_name: string
  cost_usd: number
  pct: number
}

export interface ProviderBreakdown {
  provider: string
  cost_usd: number
  pct: number
}

export interface ModelBreakdown {
  model: string
  provider: string
  cost_usd: number
  pct: number
}

export interface TeamBreakdown {
  team_label: string
  cost_usd: number
  pct: number
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary
  timeseries: TimeseriesPoint[]
  by_agent: AgentBreakdown[]
  by_provider: ProviderBreakdown[]
  by_model: ModelBreakdown[]
  by_team: TeamBreakdown[]
}

// Live event from WebSocket
export interface LiveEvent {
  event_id: string
  agent: string
  model: string
  cost_usd: number
  status: string
  tracked_at: string
}
