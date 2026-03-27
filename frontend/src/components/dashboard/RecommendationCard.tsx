'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, X, ArrowRight } from 'lucide-react'

interface Recommendation {
  agent: string
  current_model: string
  suggested_model: string
  reasoning: string
  estimated_savings_pct: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface RecommendationCardProps {
  agentFilter?: string
  limit?: number
}

export default function RecommendationCard({ agentFilter, limit = 3 }: RecommendationCardProps) {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/v1/recommendations`, { headers: { ...getAuthHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.data) {
          let items: Recommendation[] = d.data
          if (agentFilter) items = items.filter(r => r.agent === agentFilter)
          setRecs(items.slice(0, limit))
        }
      })
      .finally(() => setLoaded(true))
  }, [agentFilter, limit])

  const visible = recs.filter((_, i) => !dismissed.has(i))

  if (!loaded || visible.length === 0) return null

  return (
    <div className="space-y-3">
      {visible.map((rec, idx) => {
        const originalIdx = recs.indexOf(rec)
        return (
          <div
            key={idx}
            className="rounded-xl p-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(124,58,237,0.25)',
              boxShadow: '0 0 24px rgba(124,58,237,0.06)',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                  <Lightbulb className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>Cost Autopilot</span>
              </div>
              <button
                onClick={() => setDismissed(d => new Set([...d, originalIdx]))}
                className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{rec.agent}</strong>
              </p>

              {/* Model switch */}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="px-2 py-1 rounded font-mono"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                >
                  {rec.current_model}
                </span>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span
                  className="px-2 py-1 rounded font-mono"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac' }}
                >
                  {rec.suggested_model}
                </span>
                <span
                  className="ml-auto px-2 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#86efac' }}
                >
                  Save ~{rec.estimated_savings_pct.toFixed(0)}%
                </span>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {rec.reasoning}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
