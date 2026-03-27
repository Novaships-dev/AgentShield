'use client'

import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
function getAuthHeader() {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type ApiKey = {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
}

export default function SettingsApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newSecret, setNewSecret] = useState('')
  const [copied, setCopied] = useState(false)

  const load = () => {
    fetch(`${API_BASE}/v1/api-keys`, { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setKeys(d.data ?? []))
  }
  useEffect(load, [])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const d = await res.json()
      if (d.key) setNewSecret(d.key)
      setNewName('')
      load()
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    await fetch(`${API_BASE}/v1/api-keys/${id}`, { method: 'DELETE', headers: getAuthHeader() })
    load()
  }

  const copy = () => {
    navigator.clipboard.writeText(newSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {newSecret && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: '#4ade80' }}>
            ⚠️ Copy this key — you won&apos;t see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)' }}>
              {newSecret}
            </code>
            <button onClick={copy} className="p-2 rounded transition-colors" style={{ color: copied ? '#4ade80' : 'var(--text-muted)' }}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>API Keys</h3>

        <div className="flex gap-2 mb-6">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Key name (e.g. production)"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            onKeyDown={e => e.key === 'Enter' && create()}
          />
          <button
            onClick={create}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff', opacity: creating ? 0.6 : 1 }}
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>

        {keys.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Key className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{k.name}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {k.prefix}••• · Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button onClick={() => revoke(k.id)} className="p-1.5 rounded hover:bg-white/10 transition-colors">
                  <Trash2 className="w-4 h-4" style={{ color: '#f87171' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
