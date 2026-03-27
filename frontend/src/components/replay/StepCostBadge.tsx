'use client'

interface StepCostBadgeProps {
  cost: number | null
  duration_ms: number | null
  tokens: number
}

export default function StepCostBadge({ cost, duration_ms, tokens }: StepCostBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {cost != null && (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}
        >
          ${cost.toFixed(4)}
        </span>
      )}
      {tokens > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'rgba(6,182,212,0.1)', color: '#67e8f9' }}
        >
          {tokens.toLocaleString()} tok
        </span>
      )}
      {duration_ms != null && (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-mono"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
        >
          {duration_ms >= 1000 ? `${(duration_ms / 1000).toFixed(1)}s` : `${duration_ms}ms`}
        </span>
      )}
    </div>
  )
}
