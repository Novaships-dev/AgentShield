'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'
import { track, EVENTS } from '@/lib/analytics'

export default function Hero() {
  const meshRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    let raf: number
    const animate = () => {
      frame += 0.003
      if (meshRef.current) {
        const x = 50 + Math.sin(frame) * 15
        const y = 50 + Math.cos(frame * 0.7) * 10
        meshRef.current.style.background = `
          radial-gradient(ellipse 80% 60% at ${x}% ${y}%, rgba(124,58,237,0.18) 0%, transparent 65%),
          radial-gradient(ellipse 60% 50% at ${100 - x}% ${100 - y}%, rgba(6,182,212,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 40% 40% at 50% 50%, rgba(245,158,11,0.07) 0%, transparent 50%)
        `
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section
      className="relative flex items-center justify-center text-center overflow-hidden"
      style={{ minHeight: '100vh', paddingTop: '80px' }}
    >
      {/* Animated gradient mesh */}
      <div
        ref={meshRef}
        className="absolute inset-0 pointer-events-none"
        style={{ transition: 'background 0.1s ease' }}
      />

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 50%, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 50%, black 30%, transparent 70%)',
          animation: 'dotPulse 4s ease-in-out infinite',
        }}
      />

      {/* Grid lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* CSS animation keyframes */}
      <style jsx>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>

      <div className="relative z-10 max-w-[1100px] mx-auto px-8 py-20 reveal">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-8">
          <span
            className="px-4 py-1.5 rounded-full text-xs font-medium tracking-wide"
            style={{
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: '#a78bfa',
            }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
            Now in public beta — Join early
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-4">
          <span style={{ color: '#fff' }}>Your AI agents are running blind.</span>
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4, #F59E0B)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            See everything.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg sm:text-xl max-w-2xl mx-auto mt-6 mb-10 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Monitor costs. Replay every session. Protect with guardrails.
          <br className="hidden sm:block" />
          One SDK. One line of code. Full visibility.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/setup" onClick={() => track(EVENTS.HERO_CTA_CLICKED)}>
            <GlowButton size="lg">Start Free →</GlowButton>
          </Link>
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
            }}
          >
            <span className="text-base">▶</span> Watch Demo
          </button>
        </div>

        {/* Social proof */}
        <p className="mt-10 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          No credit card required · Free tier forever · Set up in 2 minutes
        </p>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(transparent, #030014)' }}
      />
    </section>
  )
}
