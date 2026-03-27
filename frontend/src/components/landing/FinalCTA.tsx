import Link from 'next/link'
import GlowButton from '@/components/ui/GlowButton'

export default function FinalCTA() {
  return (
    <section className="py-24 px-8">
      <div className="max-w-[700px] mx-auto text-center reveal">
        <div
          className="rounded-3xl p-12 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.05))',
            border: '1px solid rgba(124,58,237,0.2)',
          }}
        >
          {/* Background glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.12), transparent)',
            }}
          />

          <div className="relative">
            <h2 className="text-3xl sm:text-5xl font-bold mb-3" style={{ color: '#fff' }}>
              Your agents are running.
            </h2>
            <h2
              className="text-3xl sm:text-5xl font-bold mb-8"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #06B6D4, #F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Do you know what they're doing?
            </h2>

            <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Set up in 2 minutes. No credit card. Free tier forever.
            </p>

            <Link href="/setup">
              <GlowButton size="lg">Start Free — It's Free →</GlowButton>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
