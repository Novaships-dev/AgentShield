'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type AdminUser = {
  id: string
  email: string
  role: string
  organization_name: string
  plan: string
  created_at: string
  is_platform_admin: boolean
}

const planColors: Record<string, string> = { free: '#6b7280', starter: '#3b82f6', pro: '#7c3aed', team: '#06b6d4' }

export default function AdminUsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!session?.access_token) return
    fetch(`${API_BASE}/v1/admin/users?per_page=100`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { setUsers(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session?.access_token])

  const filtered = search
    ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>Users</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{users.length} total users</p>
      </div>

      <input
        type="text"
        placeholder="Search by email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', minWidth: 250 }}
      />

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Email', 'Role', 'Organization', 'Plan', 'Created', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: '#fff' }}>{u.email}</td>
                  <td className="px-4 py-3 text-sm capitalize" style={{ color: 'rgba(255,255,255,0.6)' }}>{u.role}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{u.organization_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: `${planColors[u.plan] ?? '#6b7280'}20`, color: planColors[u.plan] ?? '#6b7280' }}
                    >
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_platform_admin && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
                      >
                        Platform Admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
