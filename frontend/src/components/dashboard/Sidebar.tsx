'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bot, Bell, Wallet, TrendingUp, FileText, Users,
  Film, Shield, Eye, AlertTriangle, Settings, ClipboardList, Lock,
} from 'lucide-react'
import { clsx } from 'clsx'
import ModuleBadge from './ModuleBadge'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  module?: 'monitor' | 'replay' | 'protect'
  planRequired?: string
}

const SECTIONS: { title: string; module?: 'monitor' | 'replay' | 'protect'; items: NavItem[] }[] = [
  {
    title: 'Monitor',
    module: 'monitor',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'monitor' },
      { label: 'Agents', href: '/dashboard/agents', icon: Bot, module: 'monitor' },
      { label: 'Alerts', href: '/dashboard/alerts', icon: Bell, module: 'monitor', planRequired: 'starter' },
      { label: 'Budgets', href: '/dashboard/budgets', icon: Wallet, module: 'monitor', planRequired: 'starter' },
      { label: 'Forecast', href: '/dashboard/forecast', icon: TrendingUp, module: 'monitor', planRequired: 'pro' },
      { label: 'Reports', href: '/dashboard/reports', icon: FileText, module: 'monitor', planRequired: 'pro' },
      { label: 'Team', href: '/dashboard/team', icon: Users, module: 'monitor', planRequired: 'team' },
    ],
  },
  {
    title: 'Replay',
    module: 'replay',
    items: [
      { label: 'Sessions', href: '/dashboard/sessions', icon: Film, module: 'replay', planRequired: 'starter' },
    ],
  },
  {
    title: 'Protect',
    module: 'protect',
    items: [
      { label: 'Guardrails', href: '/dashboard/guardrails', icon: Shield, module: 'protect', planRequired: 'pro' },
      { label: 'PII Redaction', href: '/dashboard/pii', icon: Eye, module: 'protect', planRequired: 'pro' },
      { label: 'Violations', href: '/dashboard/violations', icon: AlertTriangle, module: 'protect', planRequired: 'pro' },
    ],
  },
]

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Audit Log', href: '/dashboard/audit', icon: ClipboardList, planRequired: 'pro' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

// Plan hierarchy for checking if feature is available
const PLAN_RANK: Record<string, number> = { free: 1, starter: 2, pro: 3, team: 4 }

interface SidebarProps {
  plan?: string
}

export default function Sidebar({ plan = 'free' }: SidebarProps) {
  const pathname = usePathname()
  const planRank = PLAN_RANK[plan] ?? 1

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  function isLocked(item: NavItem) {
    if (!item.planRequired) return false
    return planRank < (PLAN_RANK[item.planRequired] ?? 1)
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href)
    const locked = isLocked(item)
    const Icon = item.icon

    if (locked) {
      return (
        <div
          className="group relative flex items-center gap-2.5 px-3 py-1.5 rounded-md cursor-not-allowed select-none"
          title={`Requires ${item.planRequired} plan — Upgrade`}
        >
          <Icon
            className="w-4 h-4 flex-shrink-0"
            strokeWidth={1.5}
            style={{ color: 'var(--text-muted)' }}
          />
          <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
            {item.label}
          </span>
          <Lock className="w-3 h-3 ml-auto flex-shrink-0" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          {/* Tooltip */}
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block whitespace-nowrap text-xs text-[var(--text-secondary)] glass px-2 py-1 rounded pointer-events-none">
            Requires {item.planRequired} plan — Upgrade
          </span>
        </div>
      )
    }

    return (
      <Link
        href={item.href}
        className={clsx(
          'flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-sm',
          active
            ? 'text-[var(--text-primary)] font-medium'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        )}
        style={
          active
            ? {
                background: 'rgba(124,58,237,0.12)',
                borderLeft: '2px solid var(--accent)',
                paddingLeft: '10px',
              }
            : {
                borderLeft: '2px solid transparent',
                paddingLeft: '10px',
              }
        }
        onMouseEnter={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
          }
        }}
      >
        <Icon
          className="w-4 h-4 flex-shrink-0"
          strokeWidth={1.5}
          style={{ color: active ? 'var(--accent)' : 'currentColor' }}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-14 bottom-0 w-60 overflow-y-auto z-30"
        style={{
          background: 'rgba(10,10,15,0.8)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <nav className="flex-1 py-4 px-3 space-y-6">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div className="flex items-center gap-2 px-3 mb-1.5">
                {section.module && <ModuleBadge module={section.module} />}
                <span
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {section.title}
                </span>
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          ))}

          <div className="h-px" style={{ background: 'var(--border)' }} />

          <div className="space-y-0.5">
            {BOTTOM_ITEMS.map(item => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </nav>
      </aside>

      {/* Tablet sidebar (icons only, w-16) */}
      <aside
        className="hidden md:flex lg:hidden flex-col fixed left-0 top-14 bottom-0 w-16 overflow-hidden z-30 group/sidebar hover:w-60 transition-all duration-200"
        style={{
          background: 'rgba(10,10,15,0.9)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <nav className="flex-1 py-4 space-y-1 overflow-hidden">
          {[...SECTIONS.flatMap(s => s.items), ...BOTTOM_ITEMS].map(item => {
            const active = isActive(item.href)
            const locked = isLocked(item)
            const Icon = item.icon
            return (
              <div key={item.href} className="px-3">
                {locked ? (
                  <div
                    className="flex items-center gap-2.5 p-2 rounded-md cursor-not-allowed"
                    title={`Requires ${item.planRequired} plan`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm truncate opacity-0 group-hover/sidebar:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="flex items-center gap-2.5 p-2 rounded-md transition-colors"
                    style={{
                      background: active ? 'rgba(124,58,237,0.12)' : undefined,
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm truncate opacity-0 group-hover/sidebar:opacity-100 transition-opacity whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2"
        style={{
          background: 'rgba(10,10,15,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
        }}
      >
        {[
          { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { label: 'Agents', href: '/dashboard/agents', icon: Bot },
          { label: 'Sessions', href: '/dashboard/sessions', icon: Film },
          { label: 'Alerts', href: '/dashboard/alerts', icon: Bell },
          { label: 'Settings', href: '/dashboard/settings', icon: Settings },
        ].map(item => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
