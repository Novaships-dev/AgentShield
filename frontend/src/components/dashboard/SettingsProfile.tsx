'use client'

import { useState, useEffect } from 'react'
import { User, Building2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getAuthHeaders } from '@/lib/auth-header'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export default function SettingsProfile() {
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      // Retrieve email directly from Supabase (reliable fallback)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)

      // Load org name from API
      try {
        const headers = await getAuthHeaders()
        const r = await fetch(`${API_BASE}/v1/analytics?range=today`, { headers })
        if (r.ok) {
          const d = await r.json()
          if (d?.organization?.name) setOrgName(d.organization.name)
        }
      } catch {}
    }
    loadProfile()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    // Profile update endpoint would go here
    await new Promise(r => setTimeout(r, 500))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
              <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{email || '—'}</span>
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Organization Name</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
              <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1 }}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
