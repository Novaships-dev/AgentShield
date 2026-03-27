'use client'

import type { StepData } from '@/types/session'

interface Divergence {
  type: 'cost_diff' | 'model_diff' | 'missing_a' | 'missing_b'
  step_index: number
  step_name: string
  detail: string
}

interface DivergenceListProps {
  divergences: Divergence[]
  costA: number | null
  costB: number | null
}

export default function DivergenceList({ divergences, costA, costB }: DivergenceListProps) {
  if (divergences.length === 0) {
    return (
      <div
        className="rounded-xl p-4 text-sm text-center"
        style={{ background: 'rgba(34,197,94,0.08)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)' }}
      >
        No significant divergences detected. Sessions are similar.
      </div>
    )
  }

  const totalDiff = costA != null && costB != null ? Math.abs(costA - costB) : null
  const pctDiff = costA != null && costB != null && costB > 0 ? ((costA - costB) / costB * 100) : null

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {divergences.length} divergence{divergences.length !== 1 ? 's' : ''} detected
        </span>
        {totalDiff != null && (
          <span className="text-xs font-mono" style={{ color: pctDiff! > 0 ? '#fca5a5' : '#86efac' }}>
            Session A costs {pctDiff! > 0 ? '+' : ''}{pctDiff?.toFixed(1)}% {pctDiff! > 0 ? 'more' : 'less'} (${totalDiff.toFixed(4)})
          </span>
        )}
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {divergences.map((d, i) => (
          <li key={i} className="px-5 py-3 flex items-start gap-3">
            <span
              className="mt-0.5 text-xs px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: d.type === 'missing_a' || d.type === 'missing_b' ? 'rgba(239,68,68,0.12)' : d.type === 'model_diff' ? 'rgba(249,115,22,0.12)' : 'rgba(234,179,8,0.12)',
                color: d.type === 'missing_a' || d.type === 'missing_b' ? '#fca5a5' : d.type === 'model_diff' ? '#fdba74' : '#fde047',
              }}
            >
              {d.type.replace('_', ' ')}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Step {d.step_index + 1}: {d.step_name}</strong>
              {' — '}{d.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function computeDivergences(stepsA: StepData[], stepsB: StepData[]): {
  type: 'cost_diff' | 'model_diff' | 'missing_a' | 'missing_b'
  step_index: number
  step_name: string
  detail: string
}[] {
  const result = []
  const maxLen = Math.max(stepsA.length, stepsB.length)

  for (let i = 0; i < maxLen; i++) {
    const a = stepsA[i]
    const b = stepsB[i]
    const name = a?.step_name ?? b?.step_name ?? `Step ${i + 1}`

    if (!a) {
      result.push({ type: 'missing_a' as const, step_index: i, step_name: name, detail: 'Present in B, absent in A' })
      continue
    }
    if (!b) {
      result.push({ type: 'missing_b' as const, step_index: i, step_name: name, detail: 'Present in A, absent in B' })
      continue
    }

    if (a.model && b.model && a.model !== b.model) {
      result.push({
        type: 'model_diff' as const,
        step_index: i,
        step_name: name,
        detail: `Model changed: ${a.model} → ${b.model}`,
      })
    }

    if (a.cost_usd != null && b.cost_usd != null && Math.abs(a.cost_usd - b.cost_usd) > 0.001) {
      const ratio = b.cost_usd > 0 ? (a.cost_usd / b.cost_usd).toFixed(1) : '∞'
      result.push({
        type: 'cost_diff' as const,
        step_index: i,
        step_name: name,
        detail: `Cost ${ratio}x ($${a.cost_usd.toFixed(4)} vs $${b.cost_usd.toFixed(4)})`,
      })
    }
  }
  return result
}
