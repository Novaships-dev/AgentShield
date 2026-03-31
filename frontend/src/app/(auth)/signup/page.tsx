import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import SignupForm from '@/components/auth/SignupForm'

export const metadata = {
  title: 'Create account — AgentShield',
}

export default function SignupPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--dark)' }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <img src="/logo.svg" alt="AgentShield" className="h-10 w-10" />
            <span
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-inter)' }}
            >
              AgentShield
            </span>
          </Link>
          <p className="mt-6 text-2xl font-semibold text-[var(--text-primary)]">Start for free</p>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Monitor your AI agents in under 5 minutes
          </p>
        </div>

        <GlassCard className="gradient-border">
          <SignupForm />
        </GlassCard>

        <p className="text-center mt-6 text-sm text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium hover:underline transition-colors"
            style={{ color: 'var(--accent2)' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
