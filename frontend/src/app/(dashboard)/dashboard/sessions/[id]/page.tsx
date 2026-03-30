'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import SessionTimeline from '@/components/replay/SessionTimeline'
import SessionStats from '@/components/replay/SessionStats'
import type { SessionTimeline as SessionTimelineType } from '@/types/session'

import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function SessionDetailPage() {
  const params = useParams()
  const sessionId = params.id as string
  const [session, setSession] = useState<SessionTimelineType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    getAuthHeaders().then(headers =>
    fetch(`${API_BASE}/v1/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { 'Content-Type': 'application/json', ...headers },
    }))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(setSession)
      .catch(() => setError('Session not found or inaccessible.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/sessions"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sessions
      </Link>

      {loading && (
        <div className="space-y-4">
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        </div>
      )}

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {session && !loading && (
        <>
          <SessionStats
            session={session}
            shareEnabled
            onShare={() => setShowShareModal(true)}
          />
          <div>
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
              Timeline — {session.total_steps} step{session.total_steps !== 1 ? 's' : ''}
            </h2>
            <SessionTimeline steps={session.steps} sessionStatus={session.status} />
          </div>
        </>
      )}

      {/* Share modal */}
      {showShareModal && session && (
        <ShareModal sessionId={session.session_id} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  )
}

function ShareModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [expiry, setExpiry] = useState('24h')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_BASE}/v1/sessions/${encodeURIComponent(sessionId)}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ expires_in: expiry }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setShareUrl(data.share_url)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Share Session</h3>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Link expires in</label>
          <select
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="never">Never</option>
          </select>
        </div>

        {shareUrl ? (
          <div className="space-y-2">
            <input
              readOnly
              value={shareUrl}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            />
            <button
              onClick={copy}
              className="w-full py-2 rounded-lg text-sm font-medium"
              style={{ background: copied ? '#22c55e' : 'var(--accent)', color: '#fff' }}
            >
              {copied ? 'Link copied!' : 'Copy link'}
            </button>
          </div>
        ) : (
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Generating...' : 'Generate Link'}
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
