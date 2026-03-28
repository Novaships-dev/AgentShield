'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Delivery = {
  id: string
  event_type: string
  status: string
  status_code: number | null
  attempt: number
  error_message: string | null
  created_at: string
  delivered_at: string | null
}

export default function WebhookDeliveries({ endpointId }: { endpointId: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(`${API_BASE}/v1/webhooks/${endpointId}/deliveries`, { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setDeliveries(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [endpointId])

  useEffect(load, [load])

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'delivered') return <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
    if (status === 'failed') return <XCircle className="w-4 h-4" style={{ color: '#f87171' }} />
    return <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#f59e0b' }} />
  }

  if (loading) return <div className="h-20 animate-pulse rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />

  if (deliveries.length === 0) {
    return <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No deliveries yet.</p>
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            {['Time', 'Event', 'Status', 'Code', 'Attempt'].map(h => (
              <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d, i) => (
            <tr key={d.id} style={{ borderBottom: i < deliveries.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-muted)' }}>
                {new Date(d.created_at).toLocaleTimeString()}
              </td>
              <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{d.event_type}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={d.status} />
                  <span style={{ color: 'var(--text-secondary)' }}>{d.status}</span>
                </div>
              </td>
              <td className="px-3 py-2" style={{ color: d.status_code && d.status_code < 300 ? '#4ade80' : '#f87171' }}>
                {d.status_code ?? '—'}
              </td>
              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                {d.attempt}/5
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
