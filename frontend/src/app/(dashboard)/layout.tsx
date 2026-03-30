'use client'

import { useState, useEffect } from 'react'
import TopNav from '@/components/dashboard/TopNav'
import Sidebar from '@/components/dashboard/Sidebar'
import { WebSocketProvider } from '@/components/providers/WebSocketProvider'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    async function loadPlan() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        if (data?.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('plan')
            .eq('id', data.organization_id)
            .single()

          if (org?.plan) setPlan(org.plan)
        }
      } catch {}
    }
    loadPlan()
  }, [])

  return (
    <WebSocketProvider>
      <div className="min-h-screen" style={{ background: 'var(--dark)' }}>
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.08) 0%, transparent 60%)',
          }}
        />
        <TopNav />
        <Sidebar plan={plan} />
        <main className="relative z-10 pt-14 lg:pl-60 md:pl-16 pb-20 md:pb-6 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </WebSocketProvider>
  )
}
