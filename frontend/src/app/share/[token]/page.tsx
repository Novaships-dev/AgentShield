import { notFound } from 'next/navigation'
import SessionTimeline from '@/components/replay/SessionTimeline'
import SessionStats from '@/components/replay/SessionStats'
import type { SessionTimeline as SessionTimelineType } from '@/types/session'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getSharedSession(token: string): Promise<SessionTimelineType | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/share/${token}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const session = await getSharedSession(params.token)

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>404</div>
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>This share link is invalid or expired</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            The link may have been revoked or has passed its expiration time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Minimal header */}
      <header
        className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between"
        style={{ background: 'rgba(10,10,18,0.9)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>AgentShield</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
            Shared Session
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Read-only · PII redacted</span>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <SessionStats session={session} shareEnabled={false} />
        <div>
          <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
            Timeline — {session.total_steps} steps
          </h2>
          <SessionTimeline steps={session.steps} sessionStatus={session.status} />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        Powered by AgentShield — Monitor, Replay, Protect your AI agents
      </footer>
    </div>
  )
}
