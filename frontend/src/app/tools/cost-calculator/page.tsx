'use client'

import { useState } from 'react'
import Link from 'next/link'

const MODELS = [
  { id: 'gpt4', name: 'GPT-4 Turbo', inputPer1k: 0.01, outputPer1k: 0.03 },
  { id: 'gpt35', name: 'GPT-3.5 Turbo', inputPer1k: 0.0005, outputPer1k: 0.0015 },
  { id: 'claude3opus', name: 'Claude Opus', inputPer1k: 0.015, outputPer1k: 0.075 },
  { id: 'claude3sonnet', name: 'Claude Sonnet', inputPer1k: 0.003, outputPer1k: 0.015 },
  { id: 'claude3haiku', name: 'Claude Haiku', inputPer1k: 0.00025, outputPer1k: 0.00125 },
]

export default function CostCalculatorPage() {
  const [model, setModel] = useState('gpt4')
  const [callsPerDay, setCallsPerDay] = useState(100)
  const [inputTokens, setInputTokens] = useState(500)
  const [outputTokens, setOutputTokens] = useState(200)

  const selected = MODELS.find(m => m.id === model) ?? MODELS[0]
  const costPerCall = (inputTokens / 1000) * selected.inputPer1k + (outputTokens / 1000) * selected.outputPer1k
  const dailyCost = costPerCall * callsPerDay
  const monthlyCost = dailyCost * 30
  const yearlyCost = dailyCost * 365

  const formatCost = (n: number) =>
    n < 0.01 ? `$${n.toFixed(5)}` : n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`

  return (
    <main style={{ background: '#030014', minHeight: '100vh', padding: '96px 20px 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#4a3d6b', fontSize: 14, textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
          ← AgentShield
        </Link>

        <p style={{ color: '#7c3aed', fontWeight: 600, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Free Tool
        </p>
        <h1 style={{ color: '#e2d9f3', fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-1px' }}>
          AI Agent Cost Calculator
        </h1>
        <p style={{ color: '#9d8ec4', fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>
          Estimate your monthly LLM API costs before they surprise you on your bill.
        </p>

        {/* Inputs */}
        <div style={{ background: '#0f0a1e', border: '1px solid #2a1f4e', borderRadius: 14, padding: '28px 32px', marginBottom: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Model
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ width: '100%', background: '#1a1030', border: '1px solid #2a1f4e', borderRadius: 8, padding: '10px 14px', color: '#e2d9f3', fontSize: 14 }}
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {[
            { label: 'API calls per day', value: callsPerDay, setter: setCallsPerDay, min: 1, max: 100000 },
            { label: 'Input tokens per call', value: inputTokens, setter: setInputTokens, min: 10, max: 32000 },
            { label: 'Output tokens per call', value: outputTokens, setter: setOutputTokens, min: 10, max: 8000 },
          ].map(({ label, value, setter, min, max }) => (
            <div key={label} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 600 }}>{label}</label>
                <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 700 }}>{value.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={e => setter(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
            </div>
          ))}
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Per day', value: formatCost(dailyCost), highlight: false },
            { label: 'Per month', value: formatCost(monthlyCost), highlight: true },
            { label: 'Per year', value: formatCost(yearlyCost), highlight: false },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={{
              background: highlight ? 'rgba(124,58,237,0.12)' : '#0f0a1e',
              border: `1px solid ${highlight ? 'rgba(124,58,237,0.3)' : '#2a1f4e'}`,
              borderRadius: 12,
              padding: '20px 16px',
              textAlign: 'center',
            }}>
              <div style={{ color: highlight ? '#a78bfa' : '#e2d9f3', fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>
                {value}
              </div>
              <div style={{ color: '#6b5c8a', fontSize: 12, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {monthlyCost > 50 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 32 }}>
            <p style={{ color: '#fca5a5', fontSize: 14, margin: 0 }}>
              ⚠️ At {formatCost(monthlyCost)}/month, a single agent loop or runaway session could cost you{' '}
              <strong>{formatCost(monthlyCost * 0.3)}</strong> in minutes. AgentShield budget caps prevent exactly this.
            </p>
          </div>
        )}

        <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: '24px 28px', textAlign: 'center' }}>
          <p style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 17, margin: '0 0 6px' }}>
            Set automatic budget caps on your agents
          </p>
          <p style={{ color: '#9d8ec4', fontSize: 14, margin: '0 0 18px' }}>
            AgentShield freezes agents before they exceed your budget. Free to start.
          </p>
          <a href="https://app.agentshield.one/setup" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', textDecoration: 'none', padding: '11px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
            Start Monitoring Free →
          </a>
        </div>
      </div>
    </main>
  )
}
