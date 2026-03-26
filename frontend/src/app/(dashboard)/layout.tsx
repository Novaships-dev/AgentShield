'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import TopNav from '@/components/dashboard/TopNav'
import Sidebar from '@/components/dashboard/Sidebar'
import { WebSocketProvider } from '@/components/providers/WebSocketProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--dark)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <WebSocketProvider>
      <div className="min-h-screen" style={{ background: 'var(--dark)' }}>
        {/* Background glow */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.08) 0%, transparent 60%)',
          }}
        />

        <TopNav />

        <Sidebar />

        {/* Main content */}
        <main className="relative z-10 pt-14 lg:pl-60 md:pl-16 pb-20 md:pb-6 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </WebSocketProvider>
  )
}
