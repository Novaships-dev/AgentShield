'use client'

import { useState } from 'react'
import { FileText, Loader } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
function getAuthHeader() {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface Props {
  onGenerated: () => void
}

function getDefaultPeriod() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

const QUICK_PERIODS = [
  { label: 'This month', ...getDefaultPeriod() },
]

export default function ReportGenerator({ onGenerated }: Props) {
  const defaults = getDefaultPeriod()
  const [start, setStart] = useState(defaults.start)
  const [end, setEnd] = useState(defaults.end)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setError('')
    setGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/v1/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ period_start: start, period_end: end }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail ?? 'Failed to generate report')
      onGenerated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 mb-5">
        <FileText className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Generate Report</h3>
      </div>

      <div className="space-y-4">
        {/* Quick periods */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => { setStart(p.start); setEnd(p.end) }}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{
                background: start === p.start ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: start === p.start ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Start date</label>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <span className="text-sm mt-5" style={{ color: 'var(--text-muted)' }}>—</span>
          <div className="flex-1">
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>End date</label>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

        <button
          onClick={generate}
          disabled={generating || !start || !end}
          className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-opacity"
          style={{ background: 'var(--accent)', color: '#fff', opacity: generating || !start || !end ? 0.6 : 1 }}
        >
          {generating ? (
            <><Loader className="w-4 h-4 animate-spin" /> Generating…</>
          ) : (
            <><FileText className="w-4 h-4" /> Generate PDF</>
          )}
        </button>
      </div>
    </div>
  )
}
