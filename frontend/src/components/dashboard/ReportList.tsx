'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Download, Loader, CheckCircle, XCircle } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { getAuthHeaders, getAccessToken } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type Report = {
  id: string
  period_start: string
  period_end: string
  status: string
  download_url: string | null
  file_size_kb: number | null
  created_at: string
}

interface Props {
  refreshKey: number
  monthlyUsage: number
}

export default function ReportList({ refreshKey, monthlyUsage }: Props) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const loadRef = useRef<() => void>(() => {})

  const load = useCallback(async () => {
    setLoading(true)
    const headers = await getAuthHeaders()
    fetch(`${API_BASE}/v1/reports`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(d => setReports(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  loadRef.current = load
  useEffect(() => { load() }, [load, refreshKey])

  // WebSocket: listen for report_ready
  useWebSocket('report_ready', useCallback(() => {
    loadRef.current()
  }, []))

  const download = async (reportId: string) => {
    const url = `${API_BASE}/v1/reports/${reportId}/download`
    const token = await getAccessToken()
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `agentshield-report-${reportId.slice(0, 8)}.pdf`
        a.click()
      })
  }

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ready') return <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
    if (status === 'failed') return <XCircle className="w-4 h-4" style={{ color: '#f87171' }} />
    return <Loader className="w-4 h-4 animate-spin" style={{ color: '#f59e0b' }} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Generated Reports</h3>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
          {monthlyUsage}/10 reports this month
        </span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No reports generated yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Generated', 'Period', 'Status', 'Size', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < reports.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {r.period_start} → {r.period_end}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={r.status} />
                      <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{r.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.file_size_kb ? `${r.file_size_kb}KB` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'ready' && (
                      <button
                        onClick={() => download(r.id)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-colors"
                        style={{ background: 'rgba(124,58,237,0.15)', color: 'var(--accent)' }}
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
