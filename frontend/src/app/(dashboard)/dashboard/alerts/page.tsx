'use client'

import { useState, useEffect } from 'react'
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Clock, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

type AlertRule = {
  id: string
  name: string
  agent_id: string | null
  agent_name: string | null
  metric: string
  threshold: number
  channel: string
  is_active: boolean
  last_triggered: string | null
  cooldown_minutes: number
  created_at: string
}

type AlertHistory = {
  id: string
  alert_rule_id: string
  alert_name: string
  agent_name: string | null
  metric: string
  triggered_value: number
  threshold: number
  channel: string
  smart_diagnosis: string | null
  suggested_fix: string | null
  sent_at: string
}

const METRIC_LABELS: Record<string, string> = {
  cost_daily: 'Daily Cost',
  cost_weekly: 'Weekly Cost',
  cost_monthly: 'Monthly Cost',
  requests_daily: 'Daily Requests',
  requests_hourly: 'Hourly Requests',
  error_rate: 'Error Rate (%)',
}

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function apiFetch(path: string, options: RequestInit = {}) {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...(options.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function AlertRuleForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    metric: 'cost_daily',
    threshold: '',
    channel: 'email',
    slack_webhook: '',
    cooldown_minutes: '60',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiFetch('/v1/alerts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          metric: form.metric,
          threshold: parseFloat(form.threshold),
          channel: form.channel,
          slack_webhook: form.slack_webhook || undefined,
          cooldown_minutes: parseInt(form.cooldown_minutes),
        }),
      })
      setOpen(false)
      setForm({ name: '', metric: 'cost_daily', threshold: '', channel: 'email', slack_webhook: '', cooldown_minutes: '60' })
      onCreated()
    } catch {
      // error handled silently
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <Plus className="w-4 h-4" />
        Create Rule
      </button>
    )
  }

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>New Alert Rule</h3>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Daily cost alert"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Metric</label>
            <select
              value={form.metric}
              onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {Object.entries(METRIC_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Threshold</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.threshold}
              onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
              placeholder="20.00"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Channel</label>
            <select
              value={form.channel}
              onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="both">Both</option>
            </select>
          </div>
          {(form.channel === 'slack' || form.channel === 'both') && (
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Slack Webhook URL</label>
              <input
                value={form.slack_webhook}
                onChange={e => setForm(f => ({ ...f, slack_webhook: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cooldown (minutes)</label>
            <input
              type="number"
              min="5"
              max="1440"
              value={form.cooldown_minutes}
              onChange={e => setForm(f => ({ ...f, cooldown_minutes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Creating...' : 'Create Rule'}
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

function AlertRuleList({ rules, onToggle, onDelete }: {
  rules: AlertRule[]
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
}) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <Bell className="w-10 h-10 mx-auto" style={{ color: 'var(--text-muted)' }} />
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No alert rules yet</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Set up alerts to get notified when costs exceed your thresholds.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rules.map(rule => (
        <div
          key={rule.id}
          className="rounded-xl p-4 flex items-center justify-between gap-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{rule.name}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: rule.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                  color: rule.is_active ? '#22c55e' : 'var(--text-muted)',
                }}
              >
                {rule.is_active ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {METRIC_LABELS[rule.metric] ?? rule.metric} &gt; {rule.threshold}
              {' · '}{rule.channel}
              {' · '}<Clock className="w-3 h-3 inline mr-0.5" />{rule.cooldown_minutes}m cooldown
            </p>
            {rule.last_triggered && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Last triggered: {new Date(rule.last_triggered).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggle(rule.id, !rule.is_active)}
              className="p-1.5 rounded-lg transition-colors"
              title={rule.is_active ? 'Pause rule' : 'Activate rule'}
              style={{ color: rule.is_active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {rule.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            </button>
            <button
              onClick={() => onDelete(rule.id)}
              className="p-1.5 rounded-lg transition-colors hover:text-red-400"
              title="Delete rule"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AlertHistoryList({ history }: { history: AlertHistory[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto" style={{ color: 'var(--text-muted)' }} />
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No alerts triggered yet</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Alert history will appear here when thresholds are exceeded.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map(h => (
        <div
          key={h.id}
          className="rounded-xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{h.alert_name}</span>
                {h.agent_name && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    {h.agent_name}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {METRIC_LABELS[h.metric] ?? h.metric}: <strong style={{ color: 'var(--text-primary)' }}>{h.triggered_value.toFixed(4)}</strong> &gt; threshold {h.threshold}
                {' · '}{h.channel}
              </p>
              {h.smart_diagnosis && (
                <div className="mt-2 text-xs p-2 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--accent)' }}>💡 AI Diagnosis:</strong> {h.smart_diagnosis}
                  {h.suggested_fix && <><br /><strong style={{ color: 'var(--accent)' }}>Fix:</strong> {h.suggested_fix}</>}
                </div>
              )}
            </div>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {new Date(h.sent_at).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AlertsPage() {
  const [tab, setTab] = useState<'rules' | 'history'>('rules')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [history, setHistory] = useState<AlertHistory[]>([])
  const [loading, setLoading] = useState(true)

  async function loadRules() {
    try {
      const data = await apiFetch('/v1/alerts')
      setRules(data.data ?? [])
    } catch { /* silent */ }
  }

  async function loadHistory() {
    try {
      const data = await apiFetch('/v1/alerts/history')
      setHistory(data.data ?? [])
    } catch { /* silent */ }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadRules(), loadHistory()]).finally(() => setLoading(false))
  }, [])

  async function handleToggle(id: string, active: boolean) {
    try {
      await apiFetch(`/v1/alerts/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: active }),
      })
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: active } : r))
    } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/v1/alerts/${id}`, { method: 'DELETE' })
      setRules(prev => prev.filter(r => r.id !== id))
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Alerts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Get notified when costs or requests exceed your thresholds.
          </p>
        </div>
        {tab === 'rules' && <AlertRuleForm onCreated={loadRules} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--surface)' }}>
        {(['rules', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize', tab === t ? 'text-white' : '')}
            style={
              tab === t
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {t === 'rules' ? `Rules (${rules.length})` : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : tab === 'rules' ? (
        <AlertRuleList rules={rules} onToggle={handleToggle} onDelete={handleDelete} />
      ) : (
        <AlertHistoryList history={history} />
      )}
    </div>
  )
}
