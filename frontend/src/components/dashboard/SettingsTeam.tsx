'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Trash2, Shield, Crown, User } from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Member = {
  id: string
  email: string
  role: string
  team_label: string | null
  created_at: string
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />,
  admin: <Shield className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />,
  member: <User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />,
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'rgba(245,158,11,0.12)',
  admin: 'rgba(124,58,237,0.12)',
  member: 'rgba(255,255,255,0.06)',
}

export default function SettingsTeam() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [error, setError] = useState('')

  const loadMembers = useCallback(() => {
    fetch(`${API_BASE}/v1/teams/members`, { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(loadMembers, [loadMembers])

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/v1/teams/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.detail ?? 'Failed to send invitation')
      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInvite(false)
      setTimeout(() => setInviteSuccess(''), 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (id: string) => {
    await fetch(`${API_BASE}/v1/teams/members/${id}`, { method: 'DELETE', headers: getAuthHeader() })
    loadMembers()
  }

  const changeRole = async (id: string, role: string) => {
    await fetch(`${API_BASE}/v1/teams/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ role }),
    })
    loadMembers()
  }

  if (loading) {
    return <div className="animate-pulse h-48 rounded-xl" style={{ background: 'var(--surface)' }} />
  }

  return (
    <div className="space-y-6">
      {inviteSuccess && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
          {inviteSuccess}
        </div>
      )}

      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Members ({members.length})
          </h3>
          <button
            onClick={() => setShowInvite(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        </div>

        {showInvite && (
          <div className="mb-5 p-4 rounded-xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{ background: 'var(--accent)', color: '#fff', opacity: inviting ? 0.6 : 1 }}
              >
                {inviting ? 'Sending…' : 'Send'}
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
          </div>
        )}

        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                style={{ background: ROLE_COLORS[m.role] ?? 'rgba(255,255,255,0.06)' }}
              >
                {m.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.email}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {m.team_label ? `Team: ${m.team_label} · ` : ''}
                  Joined {new Date(m.created_at).toLocaleDateString()}
                </p>
              </div>
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                style={{ background: ROLE_COLORS[m.role] ?? 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
              >
                {ROLE_ICONS[m.role]}
                {m.role}
              </div>
              {m.role !== 'owner' && (
                <div className="flex items-center gap-1">
                  <select
                    value={m.role}
                    onChange={e => changeRole(m.id, e.target.value)}
                    className="text-xs px-2 py-1 rounded outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => removeMember(m.id)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#f87171' }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
