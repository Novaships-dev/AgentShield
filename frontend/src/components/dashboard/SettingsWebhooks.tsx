'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Zap, Circle } from 'lucide-react'
import WebhookForm from './WebhookForm'
import WebhookDeliveries from './WebhookDeliveries'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Endpoint = {
  id: string
  url: string
  events: string[]
  is_active: boolean
  consecutive_failures: number
  created_at: string
}

export default function SettingsWebhooks() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; code: number | null }>>({})

  const load = useCallback(() => {
    fetch(`${API_BASE}/v1/webhooks`, { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setEndpoints(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const deleteEndpoint = async (id: string) => {
    await fetch(`${API_BASE}/v1/webhooks/${id}`, { method: 'DELETE', headers: getAuthHeader() })
    load()
  }

  const testEndpoint = async (id: string) => {
    const res = await fetch(`${API_BASE}/v1/webhooks/${id}/test`, {
      method: 'POST',
      headers: getAuthHeader(),
    })
    const d = await res.json()
    setTestResults(prev => ({ ...prev, [id]: { success: d.success, code: d.status_code } }))
  }

  if (loading) {
    return <div className="animate-pulse h-48 rounded-xl" style={{ background: 'var(--surface)' }} />
  }

  return (
    <div className="space-y-6">
      {showForm && <WebhookForm onClose={() => setShowForm(false)} onCreated={load} />}

      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Webhook Endpoints ({endpoints.length}/5)
          </h3>
          <button
            onClick={() => setShowForm(true)}
            disabled={endpoints.length >= 5}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff', opacity: endpoints.length >= 5 ? 0.5 : 1 }}
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        {endpoints.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No webhook endpoints yet. Create one to receive events.
          </p>
        ) : (
          <div className="space-y-4">
            {endpoints.map(ep => (
              <div key={ep.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {/* Endpoint header */}
                <div className="flex items-start gap-3 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Circle
                    className="w-2 h-2 mt-1.5 flex-shrink-0 fill-current"
                    style={{ color: ep.is_active ? '#4ade80' : '#f87171' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate" style={{ color: 'var(--text-primary)' }}>{ep.url}</p>
                    <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                      Events: {ep.events.join(', ')}
                    </p>
                    {ep.consecutive_failures > 0 && (
                      <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                        {ep.consecutive_failures} consecutive failure{ep.consecutive_failures > 1 ? 's' : ''}
                        {!ep.is_active && ' — endpoint disabled'}
                      </p>
                    )}
                    {testResults[ep.id] && (
                      <p className="text-xs mt-1" style={{ color: testResults[ep.id].success ? '#4ade80' : '#f87171' }}>
                        Test: {testResults[ep.id].success ? '✓' : '✗'} HTTP {testResults[ep.id].code ?? 'timeout'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testEndpoint(ep.id)}
                      className="px-3 py-1 rounded text-xs transition-colors"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}
                    >
                      <Zap className="w-3 h-3 inline mr-1" />Test
                    </button>
                    <button
                      onClick={() => setExpanded(v => v === ep.id ? null : ep.id)}
                      className="px-3 py-1 rounded text-xs transition-colors"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}
                    >
                      {expanded === ep.id ? 'Hide' : 'Deliveries'}
                    </button>
                    <button
                      onClick={() => deleteEndpoint(ep.id)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </div>

                {/* Delivery history */}
                {expanded === ep.id && (
                  <div className="px-4 pb-4 pt-2">
                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Recent Deliveries</p>
                    <WebhookDeliveries endpointId={ep.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
