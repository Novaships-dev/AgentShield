'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react'

type GuardrailType = 'keyword' | 'regex' | 'topic' | 'category'
type GuardrailAction = 'log' | 'redact' | 'block'

interface GuardrailRule {
  id: string
  name: string
  agent_id: string | null
  type: GuardrailType
  config: Record<string, unknown>
  action: GuardrailAction
  is_active: boolean
  violation_count: number
  created_at: string
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
  if (res.status === 204) return null
  return res.json()
}

const ACTION_STYLES: Record<GuardrailAction, { bg: string; color: string }> = {
  log: { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
  redact: { bg: 'rgba(249,115,22,0.12)', color: '#fdba74' },
  block: { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5' },
}

const TYPE_LABELS: Record<GuardrailType, string> = {
  keyword: 'Keyword',
  regex: 'Regex',
  topic: 'Topic',
  category: 'Category',
}

function GuardrailForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'keyword' as GuardrailType,
    action: 'log' as GuardrailAction,
    keywords: '',
    caseSensitive: false,
    pattern: '',
    flags: 'i',
    topics: [] as string[],
    categories: [] as string[],
  })

  function buildConfig(): Record<string, unknown> {
    switch (form.type) {
      case 'keyword':
        return { keywords: form.keywords.split('\n').map(k => k.trim()).filter(Boolean), case_sensitive: form.caseSensitive }
      case 'regex':
        return { pattern: form.pattern, flags: form.flags }
      case 'topic':
        return { topics: form.topics }
      case 'category':
        return { categories: form.categories }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiFetch('/v1/guardrails', {
        method: 'POST',
        body: JSON.stringify({ name: form.name, type: form.type, action: form.action, config: buildConfig() }),
      })
      setOpen(false)
      setForm({ name: '', type: 'keyword', action: 'log', keywords: '', caseSensitive: false, pattern: '', flags: 'i', topics: [], categories: [] })
      onCreated()
    } catch { /* silent */ } finally { setSubmitting(false) }
  }

  function toggleCheck(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
        <Plus className="w-4 h-4" /> Create Rule
      </button>
    )
  }

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>New Guardrail Rule</h3>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Block profanity"
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as GuardrailType }))}
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="keyword">Keyword</option>
              <option value="regex">Regex</option>
              <option value="topic">Topic</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Action</label>
            <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value as GuardrailAction }))}
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="log">Log only</option>
              <option value="redact">Redact</option>
              <option value="block">Block (403)</option>
            </select>
          </div>
        </div>

        {/* Type-specific config */}
        {form.type === 'keyword' && (
          <div className="space-y-2">
            <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Keywords (one per line)</label>
            <textarea rows={3} value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder={"badword\nanother phrase"}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono resize-none" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={form.caseSensitive} onChange={e => setForm(f => ({ ...f, caseSensitive: e.target.checked }))} />
              Case sensitive
            </label>
          </div>
        )}
        {form.type === 'regex' && (
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Pattern</label>
              <input value={form.pattern} onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))} placeholder="\b(word1|word2)\b"
                className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Flags</label>
              <input value={form.flags} onChange={e => setForm(f => ({ ...f, flags: e.target.value }))} placeholder="i"
                className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        )}
        {form.type === 'topic' && (
          <div className="space-y-2">
            <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Topics to detect</label>
            <div className="flex flex-wrap gap-2">
              {['politics', 'religion', 'adult_content', 'gambling'].map(t => (
                <label key={t} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={form.topics.includes(t)} onChange={() => toggleCheck(form.topics, ts => setForm(f => ({ ...f, topics: ts })), t)} />
                  {t.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
        )}
        {form.type === 'category' && (
          <div className="space-y-2">
            <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Categories to detect</label>
            <div className="flex flex-wrap gap-2">
              {['hate_speech', 'self_harm', 'illegal_activity', 'violence'].map(c => (
                <label key={c} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={form.categories.includes(c)} onChange={() => toggleCheck(form.categories, cs => setForm(f => ({ ...f, categories: cs })), c)} />
                  {c.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Creating...' : 'Create Rule'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function GuardrailsPage() {
  const [rules, setRules] = useState<GuardrailRule[]>([])
  const [loading, setLoading] = useState(true)

  const loadRules = useCallback(async () => {
    try { const d = await apiFetch('/v1/guardrails'); setRules(d.data ?? []) } catch { /* silent */ }
  }, [])

  useEffect(() => { setLoading(true); loadRules().finally(() => setLoading(false)) }, [loadRules])

  async function handleToggle(id: string, active: boolean) {
    try { await apiFetch(`/v1/guardrails/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: active }) }); setRules(p => p.map(r => r.id === id ? { ...r, is_active: active } : r)) } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    try { await apiFetch(`/v1/guardrails/${id}`, { method: 'DELETE' }); setRules(p => p.filter(r => r.id !== id)) } catch { /* silent */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Guardrails</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Block, redact, or log content that violates your policies.</p>
        </div>
        <GuardrailForm onCreated={loadRules} />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />)}</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Shield className="w-10 h-10 mx-auto" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>No guardrail rules yet</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Create a rule to block or flag content that violates your policies.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-[1fr_80px_80px_80px_60px_60px] gap-4 px-5 py-2.5 text-xs uppercase tracking-wide font-medium" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <span>Rule</span><span>Type</span><span>Action</span><span>Violations</span><span>Active</span><span />
          </div>
          {rules.map(rule => {
            const as = ACTION_STYLES[rule.action]
            return (
              <div key={rule.id} className="grid grid-cols-[1fr_80px_80px_80px_60px_60px] gap-4 px-5 py-3 items-center" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rule.name}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded text-center" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{TYPE_LABELS[rule.type]}</span>
                <span className="text-xs px-2 py-0.5 rounded text-center" style={{ background: as.bg, color: as.color }}>{rule.action}</span>
                <div className="flex items-center gap-1 text-xs" style={{ color: rule.violation_count > 0 ? '#fdba74' : 'var(--text-muted)' }}>
                  {rule.violation_count > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
                  {rule.violation_count}
                </div>
                <button onClick={() => handleToggle(rule.id, !rule.is_active)} style={{ color: rule.is_active ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {rule.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => handleDelete(rule.id)} className="hover:text-red-400 transition-colors" style={{ color: 'var(--text-muted)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
