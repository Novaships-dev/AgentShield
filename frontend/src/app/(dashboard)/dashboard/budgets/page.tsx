'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Plus, Trash2, AlertTriangle, Snowflake } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'

type Budget = {
  id: string
  agent_id: string | null
  agent_name: string | null
  max_usd: number
  period: string
  action: string
  current_usd: number
  percentage: number
  is_frozen: boolean
  created_at: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), ...(options.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function gaugeColor(pct: number): string {
  if (pct >= 100) return '#ef4444'
  if (pct >= 80) return '#f97316'
  return '#22c55e'
}

function BudgetGauge({ percentage, isFrozen }: { percentage: number; isFrozen: boolean }) {
  const pct = Math.min(percentage, 100)
  const color = isFrozen ? '#ef4444' : gaugeColor(pct)

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

function BudgetForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    max_usd: '',
    period: 'monthly',
    action: 'freeze',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiFetch('/v1/budgets', {
        method: 'POST',
        body: JSON.stringify({
          max_usd: parseFloat(form.max_usd),
          period: form.period,
          action: form.action,
        }),
      })
      setOpen(false)
      setForm({ max_usd: '', period: 'monthly', action: 'freeze' })
      onCreated()
    } catch { /* silent */ } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <Plus className="w-4 h-4" />
        Add Budget Cap
      </button>
    )
  }

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>New Budget Cap</h3>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max USD</label>
            <input
              required type="number" step="0.01" min="0.01"
              value={form.max_usd}
              onChange={e => setForm(f => ({ ...f, max_usd: e.target.value }))}
              placeholder="50.00"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Period</label>
            <select
              value={form.period}
              onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Action</label>
            <select
              value={form.action}
              onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="freeze">Freeze agent</option>
              <option value="alert_only">Alert only</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Creating...' : 'Create Budget Cap'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function BudgetCard({ budget, onDelete }: { budget: Budget; onDelete: (id: string) => void }) {
  const pct = budget.percentage
  const color = budget.is_frozen ? '#ef4444' : gaugeColor(pct)

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${budget.is_frozen ? 'rgba(239,68,68,0.3)' : pct >= 80 ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {budget.agent_name ?? 'All agents (org-wide)'}
            </span>
            {budget.is_frozen && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                <Snowflake className="w-3 h-3" />
                Frozen
              </span>
            )}
            {!budget.is_frozen && pct >= 80 && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                <AlertTriangle className="w-3 h-3" />
                Warning
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)} cap · {budget.action === 'freeze' ? 'Auto-freeze' : 'Alert only'}
          </p>
        </div>
        <button
          onClick={() => onDelete(budget.id)}
          className="p-1.5 rounded-lg hover:text-red-400 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Delete budget cap"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Usage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--text-secondary)' }}>Usage</span>
          <span className="font-mono" style={{ color }}>
            ${budget.current_usd.toFixed(2)} / ${budget.max_usd.toFixed(2)}
          </span>
        </div>
        <BudgetGauge percentage={pct} isFrozen={budget.is_frozen} />
      </div>
    </div>
  )
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const { lastMessage } = useWebSocket()

  const loadBudgets = useCallback(async () => {
    try {
      const data = await apiFetch('/v1/budgets')
      setBudgets(data.data ?? [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadBudgets().finally(() => setLoading(false))
  }, [loadBudgets])

  // WebSocket live updates
  useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'budget_warning' || lastMessage.type === 'budget_frozen') {
      loadBudgets()
    }
  }, [lastMessage, loadBudgets])

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/v1/budgets/${id}`, { method: 'DELETE' })
      setBudgets(prev => prev.filter(b => b.id !== id))
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Budgets</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Set spend limits per agent. Agents are automatically frozen when limits are exceeded.
          </p>
        </div>
        <BudgetForm onCreated={loadBudgets} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Wallet className="w-10 h-10 mx-auto" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No budget caps configured</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add a budget cap to automatically freeze agents when costs exceed your limits.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(budget => (
            <BudgetCard key={budget.id} budget={budget} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
