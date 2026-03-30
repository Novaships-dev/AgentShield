'use client'

import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const ALL_EVENTS = [
  { value: 'alert.fired', label: 'Alert fired' },
  { value: 'anomaly.detected', label: 'Anomaly detected' },
  { value: 'budget.exceeded', label: 'Budget exceeded' },
  { value: 'budget.warning', label: 'Budget warning' },
  { value: 'event.tracked', label: 'Event tracked (batched)' },
  { value: 'session.completed', label: 'Session completed' },
  { value: 'guardrail.violated', label: 'Guardrail violated' },
  { value: 'agent.frozen', label: 'Agent frozen' },
  { value: 'smart_alert.diagnosed', label: 'Smart alert diagnosed' },
  { value: 'pii.detected', label: 'PII detected' },
]

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function WebhookForm({ onClose, onCreated }: Props) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['alert.fired', 'anomaly.detected', 'budget.exceeded'])
  const [saving, setSaving] = useState(false)
  const [secret, setSecret] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const toggle = (event: string) => {
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event])
  }

  const submit = async () => {
    if (!url.startsWith('https://')) {
      setError('URL must start with https://')
      return
    }
    if (events.length === 0) {
      setError('Select at least one event type.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/v1/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ url, events }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail ?? 'Failed to create webhook')
      setSecret(d.secret ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create webhook')
    } finally {
      setSaving(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const finish = () => {
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="relative rounded-2xl p-6 max-w-lg w-full space-y-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded hover:bg-white/10">
          <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        {secret ? (
          /* Secret reveal screen */
          <div className="space-y-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Webhook Created</h2>
            <div className="rounded-xl p-4" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: '#fbbf24' }}>
                ⚠️ Copy this secret — you won&apos;t see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono p-2 rounded break-all"
                  style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)' }}>
                  {secret}
                </code>
                <button onClick={copySecret} className="p-2 rounded flex-shrink-0 transition-colors"
                  style={{ color: copied ? '#4ade80' : 'var(--text-muted)' }}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Use this secret to verify incoming webhooks using HMAC SHA-256.
            </p>
            <button onClick={finish} className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              Done
            </button>
          </div>
        ) : (
          /* Create form */
          <>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>New Webhook Endpoint</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  Endpoint URL <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-app.com/webhooks"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs mb-2 block" style={{ color: 'var(--text-muted)' }}>Events to receive</label>
                <div className="space-y-2">
                  {ALL_EVENTS.map(ev => (
                    <label key={ev.value} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={events.includes(ev.value)}
                        onChange={() => toggle(ev.value)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ev.label}</span>
                      <code className="text-xs font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>{ev.value}</code>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button onClick={submit} disabled={saving || !url}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity"
                  style={{ background: 'var(--accent)', color: '#fff', opacity: saving || !url ? 0.6 : 1 }}>
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
