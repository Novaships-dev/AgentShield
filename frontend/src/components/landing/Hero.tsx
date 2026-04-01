'use client'

import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'
import { track, EVENTS } from '@/lib/analytics'
import { BarChart3, RefreshCcw, ShieldCheck } from 'lucide-react'
import { useState, useEffect } from 'react'

/* ---------- particle seed (deterministic positions) ---------- */
const PARTICLES = Array.from({ length: 26 }, (_, i) => {
  const seed = (i * 137.508) % 360 // golden-angle scatter
  const r = 30 + (i * 17) % 40
  return {
    left: `${10 + (seed / 360) * 80}%`,
    top: `${8 + ((i * 53) % 84)}%`,
    size: 2 + (i % 3),
    delay: `${(i * 0.7) % 8}s`,
    dur: `${6 + (i % 5) * 2}s`,
    color: i % 3 === 0 ? 'rgba(124,58,237,0.5)' : i % 3 === 1 ? 'rgba(6,182,212,0.45)' : 'rgba(255,255,255,0.35)',
    drift: r,
  }
})

const ORBS = [
  { color: '#7C3AED', label: 'Monitor', Icon: BarChart3, dur: '8s', startDeg: 0 },
  { color: '#06B6D4', label: 'Replay', Icon: RefreshCcw, dur: '10s', startDeg: 120 },
  { color: '#F59E0B', label: 'Protect', Icon: ShieldCheck, dur: '12s', startDeg: 240 },
] as const

export default function Hero() {
  const [demoOpen, setDemoOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDemoOpen(false)
    }
    if (demoOpen) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [demoOpen])

  return (
    <section
      className="relative flex items-center justify-center text-center overflow-hidden"
      style={{ minHeight: '100vh', paddingTop: '80px' }}
    >
      {/* ============ KEYFRAMES ============ */}
      <style jsx>{`
        /* --- shield --- */
        @keyframes shieldFloat {
          0%, 100% { transform: perspective(900px) rotateY(-8deg) translateY(0); }
          50%      { transform: perspective(900px) rotateY(8deg)  translateY(-12px); }
        }
        @keyframes shieldGlow {
          0%, 100% { box-shadow: 0 0 60px rgba(124,58,237,0.25), 0 0 140px rgba(124,58,237,0.12); }
          50%      { box-shadow: 0 0 90px rgba(124,58,237,0.35), 0 0 180px rgba(124,58,237,0.18); }
        }
        @keyframes reflectSlide {
          0%   { transform: translateX(-120%) rotate(25deg); }
          100% { transform: translateX(120%)  rotate(25deg); }
        }

        /* --- eye --- */
        @keyframes irisPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          50%      { transform: translate(-50%,-50%) scale(1.12); }
        }

        /* --- orbs --- */
        @keyframes orbit0  { from { transform: rotate(0deg)   translateX(var(--orbit-r)) rotate(0deg);   } to { transform: rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); } }
        @keyframes orbit1  { from { transform: rotate(120deg) translateX(var(--orbit-r)) rotate(-120deg);} to { transform: rotate(480deg) translateX(var(--orbit-r)) rotate(-480deg);} }
        @keyframes orbit2  { from { transform: rotate(240deg) translateX(var(--orbit-r)) rotate(-240deg);} to { transform: rotate(600deg) translateX(var(--orbit-r)) rotate(-600deg);} }

        /* --- particles --- */
        @keyframes particleDrift {
          0%, 100% { transform: translateY(0)   translateX(0)   scale(1);   opacity: 0.3; }
          25%      { transform: translateY(-18px) translateX(10px) scale(1.2); opacity: 0.7; }
          50%      { transform: translateY(-8px)  translateX(-6px) scale(0.9); opacity: 0.5; }
          75%      { transform: translateY(-22px) translateX(4px)  scale(1.1); opacity: 0.6; }
        }

        /* --- light rays --- */
        @keyframes raySlide {
          0%   { transform: translateX(-60vw) rotate(var(--ray-angle)); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(60vw)  rotate(var(--ray-angle)); opacity: 0; }
        }
      `}</style>

      {/* ============ BACKGROUND LAYERS ============ */}

      {/* Ambient gradient blobs */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 70% 55% at 45% 48%, rgba(124,58,237,0.14) 0%, transparent 65%),
          radial-gradient(ellipse 55% 45% at 60% 55%, rgba(6,182,212,0.09) 0%, transparent 60%),
          radial-gradient(ellipse 35% 35% at 50% 50%, rgba(245,158,11,0.05) 0%, transparent 50%)
        `,
      }} />

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 20%, transparent 70%)',
      }} />

      {/* Light rays */}
      {[
        { angle: '22deg', delay: '0s', dur: '14s', top: '10%' },
        { angle: '-18deg', delay: '5s', dur: '16s', top: '55%' },
        { angle: '12deg', delay: '9s', dur: '18s', top: '35%' },
      ].map((ray, i) => (
        <div key={i} className="absolute pointer-events-none" style={{
          top: ray.top, left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, rgba(124,58,237,0.06) 30%, rgba(6,182,212,0.05) 70%, transparent)`,
          filter: 'blur(8px)',
          ['--ray-angle' as string]: ray.angle,
          animation: `raySlide ${ray.dur} ${ray.delay} linear infinite`,
          willChange: 'transform, opacity',
        }} />
      ))}

      {/* ============ PARTICLES ============ */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        {PARTICLES.map((p, i) => (
          <div key={i} className="absolute rounded-full" style={{
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            background: p.color,
            animation: `particleDrift ${p.dur} ${p.delay} ease-in-out infinite`,
            willChange: 'transform, opacity',
          }} />
        ))}
      </div>
      {/* Reduced particles for mobile */}
      <div className="absolute inset-0 pointer-events-none sm:hidden">
        {PARTICLES.slice(0, 10).map((p, i) => (
          <div key={i} className="absolute rounded-full" style={{
            left: p.left, top: p.top,
            width: p.size, height: p.size,
            background: p.color,
            animation: `particleDrift ${p.dur} ${p.delay} ease-in-out infinite`,
            willChange: 'transform, opacity',
          }} />
        ))}
      </div>

      {/* ============ 3D SHIELD ============ */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ perspective: '900px' }}>
        <div
          className="relative w-[200px] h-[240px] sm:w-[300px] sm:h-[360px] lg:w-[400px] lg:h-[480px]"
          style={{
            animation: 'shieldFloat 7s ease-in-out infinite, shieldGlow 4s ease-in-out infinite',
            willChange: 'transform, box-shadow',
            clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
            background: 'rgba(124,58,237,0.08)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Inner shield border glow */}
          <div className="absolute inset-[1px]" style={{
            clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
            background: 'linear-gradient(180deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 60%, transparent 100%)',
          }} />

          {/* Edge highlight */}
          <div className="absolute inset-0" style={{
            clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.04) 100%)',
          }} />

          {/* Sliding reflection */}
          <div className="absolute inset-0 overflow-hidden" style={{
            clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
          }}>
            <div className="absolute" style={{
              top: '-20%', left: '-40%', width: '50%', height: '140%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              animation: 'reflectSlide 4s linear infinite',
              willChange: 'transform',
            }} />
          </div>

          {/* ---- EYE ---- */}
          <div className="absolute" style={{
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '40%', height: '26%',
          }}>
            {/* Eye white */}
            <div className="absolute inset-0" style={{
              borderRadius: '50% / 50%',
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 70%, transparent 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }} />
            {/* Iris */}
            <div className="absolute" style={{
              top: '50%', left: '50%',
              width: '52%', height: '80%',
              transform: 'translate(-50%, -50%) scale(1)',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, #22d3ee 0%, #06B6D4 50%, #0e7490 100%)',
              boxShadow: '0 0 20px rgba(6,182,212,0.5), 0 0 40px rgba(6,182,212,0.2)',
              animation: 'irisPulse 3s ease-in-out infinite',
              willChange: 'transform',
            }} />
            {/* Pupil */}
            <div className="absolute" style={{
              top: '50%', left: '50%',
              width: '22%', height: '34%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: '#030014',
            }} />
            {/* Highlight */}
            <div className="absolute" style={{
              top: '34%', left: '56%',
              width: '10%', height: '16%',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.8)',
            }} />
          </div>
        </div>
      </div>

      {/* ============ ORBITING MODULES (hidden on mobile) ============ */}
      <div className="absolute inset-0 items-center justify-center pointer-events-none hidden sm:flex">
        {ORBS.map((orb, i) => (
          <div key={orb.label} className="absolute" style={{
            ['--orbit-r' as string]: i === 0 ? '160px' : i === 1 ? '180px' : '170px',
            animation: `orbit${i} ${orb.dur} linear infinite`,
            willChange: 'transform',
          }}>
            {/* Trail blur */}
            <div className="absolute -inset-2 rounded-full" style={{
              background: `radial-gradient(circle, ${orb.color}30, transparent 70%)`,
              filter: 'blur(8px)',
            }} />
            {/* Orb */}
            <div className="relative flex items-center justify-center rounded-full" style={{
              width: i === 1 ? 52 : i === 2 ? 44 : 48,
              height: i === 1 ? 52 : i === 2 ? 44 : 48,
              background: `rgba(${orb.color === '#7C3AED' ? '124,58,237' : orb.color === '#06B6D4' ? '6,182,212' : '245,158,11'},0.12)`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${orb.color}40`,
              boxShadow: `0 0 20px ${orb.color}25`,
            }}>
              <orb.Icon size={20} strokeWidth={1.5} color={orb.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Larger orbits on desktop */}
      <style jsx>{`
        @media (min-width: 1024px) {
          div[style*="--orbit-r"] {
            --orbit-r: 220px !important;
          }
        }
      `}</style>

      {/* ============ TEXT CONTENT ============ */}
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
        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-4"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 0 40px rgba(3,0,20,0.8)' }}
        >
          <span style={{ color: '#fff' }}>Your AI agents are running blind.</span>
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4, #F59E0B)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 10px rgba(124,58,237,0.3))',
            }}
          >
            See everything.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg sm:text-xl max-w-2xl mx-auto mt-6 mb-10 leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 12px rgba(0,0,0,0.5)' }}
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
            onClick={() => setDemoOpen(true)}
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
        <p className="mt-10 text-xs" style={{ color: 'rgba(255,255,255,0.3)', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
          No credit card required · Free tier forever · Set up in 2 minutes
        </p>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(transparent, #030014)' }}
      />

      {/* Demo Modal */}
      {demoOpen && (
        <div
          onClick={() => setDemoOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(3,0,20,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 960,
              background: '#0f0a1e',
              border: '1px solid rgba(124,58,237,0.35)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 0 100px rgba(124,58,237,0.18), 0 40px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#a78bfa',
                  letterSpacing: '-0.3px',
                }}>
                  ⬡ AgentShield
                </span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                  — Product Demo
                </span>
              </div>
              <button
                onClick={() => setDemoOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                }}
              >
                ✕
              </button>
            </div>

            {/* Video */}
            <video
              src="/agentshield-demo-full.mp4"
              controls
              autoPlay
              playsInline
              style={{
                width: '100%',
                display: 'block',
                maxHeight: '75vh',
                background: '#030014',
              }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
