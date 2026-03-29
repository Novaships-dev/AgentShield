'use client'

import TopNav from '@/components/dashboard/TopNav'
import Sidebar from '@/components/dashboard/Sidebar'
import { WebSocketProvider } from '@/components/providers/WebSocketProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
        <Sidebar />
        <main className="relative z-10 pt-14 lg:pl-60 md:pl-16 pb-20 md:pb-6 min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </WebSocketProvider>
  )
}
