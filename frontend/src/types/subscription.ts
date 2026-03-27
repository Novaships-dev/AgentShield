export interface PlanConfig {
  name: string
  price: number
  maxAgents: number | 'unlimited'
  maxRequests: string
  historyDays: number
  modules: string[]
  features: string[]
}

export const PLAN_CONFIGS: Record<string, PlanConfig> = {
  free: {
    name: 'Free',
    price: 0,
    maxAgents: 1,
    maxRequests: '10K',
    historyDays: 7,
    modules: ['monitor'],
    features: ['Monitor (basic)', '1 agent', '10K requests/mo', '7-day history'],
  },
  starter: {
    name: 'Starter',
    price: 49,
    maxAgents: 5,
    maxRequests: '100K',
    historyDays: 30,
    modules: ['monitor', 'replay'],
    features: ['Monitor', 'Replay', 'Alerts & Anomaly', 'Forecast', '5 agents', '100K requests/mo'],
  },
  pro: {
    name: 'Pro',
    price: 99,
    maxAgents: 'unlimited',
    maxRequests: '500K',
    historyDays: 90,
    modules: ['monitor', 'replay', 'protect'],
    features: ['Monitor', 'Replay', 'Protect', 'Smart Alerts', 'Cost Autopilot', 'Webhooks', 'Session sharing', 'Unlimited agents'],
  },
  team: {
    name: 'Team',
    price: 199,
    maxAgents: 'unlimited',
    maxRequests: 'Unlimited',
    historyDays: 365,
    modules: ['monitor', 'replay', 'protect'],
    features: ['All Pro features', 'Multi-user & Teams', 'Team attribution', 'Audit log', 'PDF reports', 'Slack bot', '1-year history'],
  },
}
