'use client'

import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'

/* Mini particles for the CTA card bg */
const CTA_PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${5 + ((i * 137.508) % 360) / 360 * 90}%`,
  top: `${10 + ((i * 53) % 80)}%`,
  size: 2 + (i % 2),
  delay: `${(i * 0.8) % 6}s`,
  dur: `${5 + (i % 4) * 2}s`,
  color: i % 3 === 0 ? 'rgba(124,58,237,0.4)' : i % 3 === 1 ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.2)',
}))

export default function FinalCTA() {
  return (
    <section className="py-24 px-8">
      <style jsx>{`
        @keyframes ctaPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.02); }
        }
        @keyframes ctaGradient {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes miniShieldFloat {
          0%, 100% { transform: perspective(600px) rotateY(-6deg) translateY(0); }
          50%      { transform: perspective(600px) rotateY(6deg)  translateY(-8px); }
        }
        @keyframes miniIrisPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          50%      { transform: translate(-50%,-50%) scale(1.15); }
        }
        @keyframes ctaParticle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50%      { transform: translateY(-12px) translateX(6px); opacity: 0.7; }
        }
        @keyframes borderSpin {
          to { --cta-angle: 360deg; }
        }
        @property --cta-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        .cta-border {
          background: conic-gradient(from var(--cta-angle, 0deg), #7C3AED, #06B6D4, #F59E0B, #7C3AED);
          animation: borderSpin 5s linear infinite;
        }
      `}</style>

      <div className="max-w-[800px] mx-auto text-center" data-reveal>
        {/* Animated border wrapper */}
        <div className="cta-border rounded-3xl p-[1px]">
          <div
            className="rounded-3xl p-12 sm:p-16 relative overflow-hidden"
            style={{
              background: 'rgba(3,0,20,0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.1), transparent)',
            }} />

            {/* Particles */}
            {CTA_PARTICLES.map((p, i) => (
              <div key={i} className="absolute rounded-full pointer-events-none" style={{
                left: p.left, top: p.top,
                width: p.size, height: p.size,
                background: p.color,
                animation: `ctaParticle ${p.dur} ${p.delay} ease-in-out infinite`,
              }} />
            ))}

            <div className="relative flex flex-col lg:flex-row items-center gap-10">
              {/* Mini 3D shield */}
              <div className="flex-shrink-0 hidden lg:block">
                <div
                  className="relative w-[120px] h-[144px]"
                  style={{
                    animation: 'miniShieldFloat 6s ease-in-out infinite',
                    willChange: 'transform',
                    clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
                    background: 'rgba(124,58,237,0.1)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 0 40px rgba(124,58,237,0.2)',
                  }}
                >
                  <div className="absolute inset-0" style={{
                    clipPath: 'polygon(50% 0%, 100% 12%, 100% 60%, 50% 100%, 0% 60%, 0% 12%)',
                    background: 'linear-gradient(180deg, rgba(124,58,237,0.1), transparent)',
                  }} />
                  {/* Eye */}
                  <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '45%', height: '28%' }}>
                    <div className="absolute inset-0" style={{
                      borderRadius: '50%',
                      background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.15), transparent)',
                    }} />
                    <div className="absolute" style={{
                      top: '50%', left: '50%', width: '50%', height: '78%',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 40% 40%, #22d3ee, #06B6D4, #0e7490)',
                      boxShadow: '0 0 12px rgba(6,182,212,0.5)',
                      animation: 'miniIrisPulse 3s ease-in-out infinite',
                    }} />
                    <div className="absolute" style={{
                      top: '50%', left: '50%', width: '20%', height: '32%',
                      transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#030014',
                    }} />
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="text-center lg:text-left">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3" style={{ color: '#fff' }}>
                  Your agents are running.
                </h2>
                <h2
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-8"
                  style={{
                    background: 'linear-gradient(135deg, #7C3AED, #06B6D4, #F59E0B, #7C3AED)',
                    backgroundSize: '200% 200%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'ctaGradient 4s ease-in-out infinite',
                  }}
                >
                  Do you know what they&apos;re doing?
                </h2>

                <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Set up in 2 minutes. No credit card. Free tier forever.
                </p>

                <div style={{ animation: 'ctaPulse 2s ease-in-out infinite', display: 'inline-block' }}>
                  <Link href="/setup">
                    <GlowButton size="lg">Start Free — It&apos;s Free →</GlowButton>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
