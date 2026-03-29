'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { LayoutDashboard, Building2, Users, Activity, DollarSign, ArrowLeft } from 'lucide-react'

const ADMIN_EMAIL = 'novaships.dev@outlook.com'

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Events', href: '/admin/events', icon: Activity },
  { label: 'Revenue', href: '/admin/revenue', icon: DollarSign },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (user?.email === ADMIN_EMAIL) {
        setAuthorized(true)
      } else {
        window.location.replace('/dashboard')
      }
    }
  }, [user, isLoading])

  if (isLoading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#030014' }}>
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

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen" style={{ background: '#030014' }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.08) 0%, transparent 60%)',
        }}
      />

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 gap-4"
        style={{
          background: 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </Link>
        <div className="flex-1" />
        <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          Platform Admin
        </span>
      </header>

      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-14 bottom-0 w-56 overflow-y-auto z-30"
        style={{
          background: 'rgba(10,10,15,0.8)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-150 text-sm"
                style={{
                  background: active ? 'rgba(124,58,237,0.12)' : undefined,
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingLeft: '10px',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: active ? 'var(--accent)' : 'currentColor' }} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="relative z-10 pt-14 md:pl-56 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
