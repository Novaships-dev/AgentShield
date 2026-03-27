'use client'

import { X, AlertTriangle, ShieldAlert } from 'lucide-react'
import type { StepData } from '@/types/session'
import StepCostBadge from './StepCostBadge'

interface StepDetailProps {
  step: StepData
  index: number
  onClose: () => void
}

function RedactedText({ text }: { text: string | null }) {
  if (!text) return <span style={{ color: 'var(--text-muted)' }}>(no content)</span>

  // Highlight [REDACTED:type] and [BLOCKED:rule] patterns
  const parts = text.split(/(\[(?:REDACTED|BLOCKED):[^\]]+\])/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.match(/^\[(?:REDACTED|BLOCKED):[^\]]+\]$/)) {
          const isBlocked = part.startsWith('[BLOCKED')
          return (
            <mark
              key={i}
              style={{
                background: isBlocked ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.2)',
                color: isBlocked ? '#fca5a5' : '#fdba74',
                borderRadius: '3px',
                padding: '0 2px',
              }}
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function StepDetail({ step, index, onClose }: StepDetailProps) {
  const totalTokens = step.input_tokens + step.output_tokens

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Step {index + 1}{step.step_name ? ` — ${step.step_name}` : ''}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {step.agent}
          </span>
          {step.model && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
            >
              {step.model}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: step.status === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)',
              color: step.status === 'error' ? '#fca5a5' : '#86efac',
            }}
          >
            {step.status}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Cost badges */}
      <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <StepCostBadge cost={step.cost_usd} duration_ms={step.duration_ms} tokens={totalTokens} />
      </div>

      {/* Input / Output */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Input */}
        <div className="p-4" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Input</span>
            {step.input_tokens > 0 && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{step.input_tokens.toLocaleString()} tok</span>
            )}
          </div>
          <pre
            className="text-xs font-mono overflow-auto max-h-56 whitespace-pre-wrap break-words leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            <RedactedText text={step.input_redacted} />
          </pre>
        </div>
        {/* Output */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Output</span>
            {step.output_tokens > 0 && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{step.output_tokens.toLocaleString()} tok</span>
            )}
          </div>
          <pre
            className="text-xs font-mono overflow-auto max-h-56 whitespace-pre-wrap break-words leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            <RedactedText text={step.output_redacted} />
          </pre>
        </div>
      </div>

      {/* Badges footer */}
      <div className="px-5 py-2.5 flex items-center gap-4 flex-wrap">
        {step.pii_detected.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#fdba74' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            PII: {step.pii_detected.join(', ')}
          </div>
        )}
        {step.guardrail_violations.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#fca5a5' }}>
            <ShieldAlert className="w-3.5 h-3.5" />
            Violations: {step.guardrail_violations.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
