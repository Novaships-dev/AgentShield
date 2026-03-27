export type SessionStatus = 'success' | 'error' | 'partial' | 'running'

export interface StepData {
  event_id: string
  step: number | null
  step_name: string | null
  agent: string
  model: string | null
  provider: string | null
  input_redacted: string | null
  output_redacted: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
  duration_ms: number | null
  status: string
  pii_detected: string[]
  guardrail_violations: string[]
  tracked_at: string | null
}

export interface SessionTimeline {
  session_id: string
  status: SessionStatus
  total_cost_usd: number | null
  total_tokens: number
  total_steps: number
  duration_ms: number | null
  started_at: string | null
  ended_at: string | null
  agents_involved: string[]
  steps: StepData[]
}

export interface SessionSummary {
  id: string | null
  session_id: string
  agents: string[]
  total_steps: number
  total_cost_usd: number | null
  total_tokens: number
  status: SessionStatus
  duration_ms: number | null
  started_at: string | null
  ended_at: string | null
}
