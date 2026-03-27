'use client'

import { useState } from 'react'
import { User, CreditCard, Key, Users, Webhook } from 'lucide-react'
import SettingsProfile from '@/components/dashboard/SettingsProfile'
import SettingsBilling from '@/components/dashboard/SettingsBilling'
import SettingsApiKeys from '@/components/dashboard/SettingsApiKeys'
import SettingsTeam from '@/components/dashboard/SettingsTeam'
import SettingsWebhooks from '@/components/dashboard/SettingsWebhooks'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
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
      {active === 'team' && <SettingsTeam />}
      {active === 'webhooks' && <SettingsWebhooks />}
    </div>
  )
}
