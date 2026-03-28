'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import GlowButton from '@/components/ui/GlowButton'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(3,0,20,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-[1100px] mx-auto px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 no-underline">
          <img src="/logo.svg" alt="AgentShield" className="h-8 w-auto" />
          <span
            className="text-lg font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AgentShield
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Docs', href: '/docs' },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm transition-colors duration-200 no-underline"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm no-underline transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Sign in
          </Link>
          <Link href="/setup">
            <GlowButton size="sm">Start Free →</GlowButton>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span
            className="block w-5 h-0.5 transition-transform duration-200"
            style={{
              background: 'rgba(255,255,255,0.8)',
              transform: menuOpen ? 'translateY(8px) rotate(45deg)' : 'none',
            }}
          />
          <span
            className="block w-5 h-0.5 transition-opacity duration-200"
            style={{
              background: 'rgba(255,255,255,0.8)',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block w-5 h-0.5 transition-transform duration-200"
            style={{
              background: 'rgba(255,255,255,0.8)',
              transform: menuOpen ? 'translateY(-8px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden px-8 py-6 space-y-4"
          style={{ background: 'rgba(3,0,20,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Docs', href: '/docs' },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              className="block text-sm no-underline"
              style={{ color: 'rgba(255,255,255,0.7)' }}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-3">
            <Link href="/login" className="text-sm no-underline" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Sign in
            </Link>
            <Link href="/setup">
              <GlowButton size="sm">Start Free →</GlowButton>
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
