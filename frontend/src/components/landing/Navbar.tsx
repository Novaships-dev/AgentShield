'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import GlowButton from '@/components/ui/GlowButton'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)

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
          <a href="#features" className="text-sm transition-colors duration-200 no-underline" style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>Features</a>

          {/* Integrations dropdown */}
          <div className="relative" onMouseEnter={() => setIntegrationsOpen(true)} onMouseLeave={() => setIntegrationsOpen(false)}>
            <button className="text-sm transition-colors duration-200 no-underline flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
              Integrations <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>
            {integrationsOpen && (
              <div className="absolute top-full left-0 pt-2" style={{ zIndex: 100 }}>
                <div className="rounded-xl py-2" style={{ background: 'rgba(15,10,30,0.98)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 200, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>SDK & Frameworks</p>
                  {[
                    { label: 'Python SDK', href: '/docs/sdk' },
                    { label: 'LangChain', href: '/integrations/langchain' },
                    { label: 'OpenAI', href: '/integrations/openai' },
                    { label: 'Anthropic', href: '/integrations/anthropic' },
                  ].map(item => (
                    <Link key={item.label} href={item.href} className="block px-4 py-1.5 text-sm no-underline transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
                      {item.label}
                    </Link>
                  ))}
                  <hr style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                  <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>No-Code & API</p>
                  {[
                    { label: 'n8n', href: '/integrations/n8n' },
                    { label: 'Make', href: '/integrations/make' },
                    { label: 'Zapier', href: '/integrations/zapier' },
                    { label: 'REST API', href: '/docs/rest-api' },
                  ].map(item => (
                    <Link key={item.label} href={item.href} className="block px-4 py-1.5 text-sm no-underline transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
                      {item.label}
                    </Link>
                  ))}
                  <hr style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                  <Link href="/integrations/langchain" className="block px-4 py-1.5 text-sm no-underline" style={{ color: '#a78bfa' }}>
                    See all integrations →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link href="/blog" className="text-sm transition-colors duration-200 no-underline" style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>Blog</Link>
          <a href="#pricing" className="text-sm transition-colors duration-200 no-underline" style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>Pricing</a>
          <Link href="/docs" className="text-sm transition-colors duration-200 no-underline" style={{ color: 'rgba(255,255,255,0.6)' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>Docs</Link>
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
          <a href="#features" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>Features</a>
          <a href="#how-it-works" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>How it works</a>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Integrations</p>
          <Link href="/integrations/n8n" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>n8n</Link>
          <Link href="/integrations/make" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>Make</Link>
          <Link href="/integrations/zapier" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>Zapier</Link>
          <Link href="/docs/rest-api" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>REST API</Link>
          <Link href="/blog" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>Blog</Link>
          <a href="#pricing" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>Pricing</a>
          <Link href="/docs" className="block text-sm no-underline" style={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setMenuOpen(false)}>Docs</Link>
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
