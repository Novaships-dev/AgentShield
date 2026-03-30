'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Bell, Settings, Search, ShieldCheck, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function TopNav() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'AG'

  // Fermer le menu au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4 gap-4"
      style={{
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-4 flex-shrink-0">
        <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>◆</span>
        <span
          className="text-sm font-semibold tracking-tight hidden sm:block"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-inter)' }}
        >
          AgentShield
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Search hint */}
        <button
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
          }}
        >
          <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Search</span>
          <kbd
            className="ml-1 px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Alerts */}
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Alerts"
        >
          <Bell className="w-4 h-4" strokeWidth={1.5} />
        </button>

        {/* Admin (platform admin only) */}
        {user?.email === 'novaships.dev@outlook.com' && (
          <Link
            href="/admin"
            className="p-2 rounded-lg transition-colors hover:bg-white/[0.04]"
            style={{ color: '#a78bfa' }}
            aria-label="Platform Admin"
            title="Platform Admin"
          >
            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        )}

        {/* Settings */}
        <Link
          href="/dashboard/settings"
          className="p-2 rounded-lg transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" strokeWidth={1.5} />
        </Link>

        {/* Avatar + Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold ml-1 flex-shrink-0 transition-opacity hover:opacity-80"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: 'white',
            }}
            title={user?.email ?? 'Account'}
          >
            {initials}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-60 rounded-xl py-2 z-50"
              style={{
                background: 'rgba(15,15,20,0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {/* User email */}
              <div className="px-4 py-2.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {user?.email ?? 'Not signed in'}
              </div>
              <div className="h-px mx-3" style={{ background: 'var(--border)' }} />
              {/* Sign Out */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                }}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm transition-colors rounded-md mx-0"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
