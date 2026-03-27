'use client'

import { useState } from 'react'
import { User, CreditCard, Key, Users } from 'lucide-react'
import SettingsProfile from '@/components/dashboard/SettingsProfile'
import SettingsBilling from '@/components/dashboard/SettingsBilling'
import SettingsApiKeys from '@/components/dashboard/SettingsApiKeys'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'team', label: 'Team', icon: Users },
] as const

type Tab = (typeof TABS)[number]['id']

export default function SettingsPage() {
  const [active, setActive] = useState<Tab>('profile')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--surface)' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {active === 'profile' && <SettingsProfile />}
      {active === 'billing' && <SettingsBilling />}
      {active === 'api-keys' && <SettingsApiKeys />}
      {active === 'team' && (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Team management will be available here once implemented.
          </p>
        </div>
      )}
    </div>
  )
}
