'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, Plus, Trash2, AlertTriangle } from 'lucide-react'

type PIIAction = 'redact' | 'hash' | 'log_only'

const BUILTIN_PATTERNS = [
  { id: 'email', label: 'Email addresses', example: 'john@example.com' },
  { id: 'phone', label: 'Phone numbers', example: '+1-555-000-1234' },
  { id: 'credit_card', label: 'Credit card numbers', example: '4242 4242 4242 4242' },
  { id: 'ssn', label: 'Social Security Numbers', example: '123-45-6789' },
  { id: 'ip_address', label: 'IP addresses', example: '192.168.1.1' },
]

interface CustomPattern {
  name: string
  pattern: string
}

interface PIIConfig {
  patterns_enabled: string[]
  custom_patterns: CustomPattern[]
  action: PIIAction
  store_original: boolean
}

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function PIIPage() {
  const [config, setConfig] = useState<PIIConfig>({
    patterns_enabled: ['email', 'phone', 'credit_card', 'ssn', 'ip_address'],
    custom_patterns: [],
    action: 'redact',
    store_original: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPattern, setNewPattern] = useState({ name: '', pattern: '' })
  const [showNewPattern, setShowNewPattern] = useState(false)

  useEffect(() => {
    async function loadConfig() {
      const headers = await getAuthHeaders()
      fetch(`${API_BASE}/v1/pii`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setConfig(d) })
        .finally(() => setLoading(false))
    }
    loadConfig()
  }, [])

  function toggleBuiltin(id: string) {
    setConfig(c => ({
      ...c,
      patterns_enabled: c.patterns_enabled.includes(id)
        ? c.patterns_enabled.filter(p => p !== id)
        : [...c.patterns_enabled, id],
    }))
  }

  function addCustomPattern() {
    if (!newPattern.name || !newPattern.pattern) return
    setConfig(c => ({ ...c, custom_patterns: [...c.custom_patterns, newPattern] }))
    setNewPattern({ name: '', pattern: '' })
    setShowNewPattern(false)
  }

  function removeCustom(idx: number) {
    setConfig(c => ({ ...c, custom_patterns: c.custom_patterns.filter((_, i) => i !== idx) }))
  }

  async function save() {
    setSaving(true)
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_BASE}/v1/pii`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(config),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* silent */ } finally { setSaving(false) }
  }

  if (loading) return <div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>PII Redaction</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Configure which personal data is redacted before storage and display.
        </p>
      </div>

      {/* Built-in patterns */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Active Patterns</h2>
        </div>
        <div className="space-y-2">
          {BUILTIN_PATTERNS.map(p => (
            <label key={p.id} className="flex items-center justify-between p-3 rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.patterns_enabled.includes(p.id)}
                  onChange={() => toggleBuiltin(p.id)}
                  className="w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.label}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{p.example}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Redaction Action</h2>
        <div className="flex gap-3">
          {(['redact', 'hash', 'log_only'] as PIIAction[]).map(a => (
            <label key={a} className="flex-1 flex items-center gap-2 p-3 rounded-lg cursor-pointer" style={{ background: config.action === a ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${config.action === a ? 'rgba(124,58,237,0.4)' : 'var(--border)'}` }}>
              <input type="radio" name="action" value={a} checked={config.action === a} onChange={() => setConfig(c => ({ ...c, action: a }))} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{a === 'log_only' ? 'Log only' : a.charAt(0).toUpperCase() + a.slice(1)}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a === 'redact' ? 'Replace with [REDACTED:type]' : a === 'hash' ? 'Replace with SHA-256 hash' : 'Keep original, flag in logs'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Store original */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Store Original Content</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Save unredacted content (visible only to owner/admin)</p>
          </div>
          <button
            onClick={() => setConfig(c => ({ ...c, store_original: !c.store_original }))}
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ background: config.store_original ? 'var(--accent)' : 'rgba(255,255,255,0.12)' }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: config.store_original ? 'translateX(20px)' : 'translateX(2px)' }} />
          </button>
        </div>
        {config.store_original && (
          <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: 'rgba(249,115,22,0.08)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.2)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Original unredacted content will be stored. Only owners and admins can view it. Ensure compliance with GDPR and other regulations.</p>
          </div>
        )}
      </div>

      {/* Custom patterns */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Custom Patterns ({config.custom_patterns.length}/10)</h2>
          {config.custom_patterns.length < 10 && (
            <button onClick={() => setShowNewPattern(s => !s)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <Plus className="w-3.5 h-3.5" /> Add Pattern
            </button>
          )}
        </div>

        {showNewPattern && (
          <div className="flex gap-2">
            <input value={newPattern.name} onChange={e => setNewPattern(p => ({ ...p, name: e.target.value }))} placeholder="Pattern name" className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <input value={newPattern.pattern} onChange={e => setNewPattern(p => ({ ...p, pattern: e.target.value }))} placeholder="Regex pattern" className="flex-1 px-3 py-1.5 rounded-lg text-sm font-mono" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <button onClick={addCustomPattern} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--accent)', color: '#fff' }}>Add</button>
          </div>
        )}

        {config.custom_patterns.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No custom patterns yet.</p>
        ) : (
          <div className="space-y-2">
            {config.custom_patterns.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div>
                  <span style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  <span className="ml-3 font-mono" style={{ color: 'var(--text-muted)' }}>{p.pattern}</span>
                </div>
                <button onClick={() => removeCustom(i)} style={{ color: 'var(--text-muted)' }} className="hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg text-sm font-medium"
        style={{ background: saved ? '#22c55e' : 'var(--accent)', color: '#fff', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}
