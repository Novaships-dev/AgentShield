'use client'

import { useState } from 'react'
import type { StepData } from '@/types/session'
import StepDetail from './StepDetail'

interface SessionTimelineProps {
  steps: StepData[]
  sessionStatus: string
}

function dotColor(step: StepData, selected: boolean): string {
  if (step.status === 'error') return '#ef4444'
  if (step.guardrail_violations.length > 0) return '#f97316'
  if (selected) return 'var(--accent)'
  return 'rgba(255,255,255,0.5)'
}

function dotBorder(step: StepData, selected: boolean): string {
  if (step.guardrail_violations.length > 0) return '2px solid #f97316'
  if (selected) return '2px solid var(--accent)'
  return '1px solid rgba(255,255,255,0.15)'
}

export default function SessionTimeline({ steps, sessionStatus }: SessionTimelineProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const isRunning = sessionStatus === 'running'
  const lastIndex = steps.length - 1

  if (steps.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center text-sm"
        style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      >
        No steps recorded for this session yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Horizontal scrollable timeline */}
      <div
        className="rounded-xl p-6 overflow-x-auto"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center min-w-max gap-0">
          {steps.map((step, i) => {
            const isSelected = selected === i
            const isLast = i === lastIndex
            const isActive = isRunning && isLast

            return (
              <div key={step.event_id} className="flex items-center">
                {/* Step dot */}
                <div className="flex flex-col items-center gap-2 relative group">
                  <button
                    onClick={() => setSelected(isSelected ? null : i)}
                    className="relative transition-all duration-200 rounded-full flex items-center justify-center focus:outline-none"
                    style={{
                      width: isSelected ? 20 : 16,
                      height: isSelected ? 20 : 16,
                      background: dotColor(step, isSelected),
                      border: dotBorder(step, isSelected),
                      boxShadow: isSelected ? `0 0 12px var(--accent)` : undefined,
                    }}
                    title={step.step_name ?? `Step ${i + 1}`}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: 'var(--accent)' }} />
                    )}
                  </button>

                  {/* Label */}
                  <span
                    className="text-xs text-center max-w-[64px] truncate"
                    style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    title={step.step_name ?? step.agent}
                  >
                    {step.step_name ?? step.agent}
                  </span>

                  {/* Tooltip */}
                  <div
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-0.5 z-10 pointer-events-none"
                  >
                    <div
                      className="px-2 py-1.5 rounded text-xs whitespace-nowrap"
                      style={{ background: 'rgba(15,15,25,0.95)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    >
                      <div>{step.model ?? 'unknown model'}</div>
                      {step.cost_usd != null && <div style={{ color: '#a78bfa' }}>${step.cost_usd.toFixed(4)}</div>}
                      {step.duration_ms != null && <div style={{ color: 'var(--text-muted)' }}>{step.duration_ms}ms</div>}
                    </div>
                  </div>
                </div>

                {/* Connector line (between dots) */}
                {!isLast && (
                  <div
                    className="flex-shrink-0"
                    style={{
                      width: 48,
                      height: 2,
                      background: 'rgba(255,255,255,0.08)',
                      margin: '0 4px',
                      marginBottom: 24, // offset for label below
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step detail panel */}
      {selected !== null && steps[selected] && (
        <StepDetail
          step={steps[selected]}
          index={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
