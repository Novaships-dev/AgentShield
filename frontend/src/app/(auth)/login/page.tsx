import Link from 'next/link'
import GlassCard from '@/components/ui/GlassCard'
import LoginForm from '@/components/auth/LoginForm'

export const metadata = {
  title: 'Sign in — AgentShield',
}

export default function LoginPage() {
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
            <span
              className="text-2xl font-bold"
              style={{ color: 'var(--accent)' }}
            >
              ◆
            </span>
            <span
              className="text-xl font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-inter)' }}
            >
              AgentShield
            </span>
          </Link>
          <p className="mt-6 text-2xl font-semibold text-[var(--text-primary)]">Welcome back</p>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Sign in to your dashboard
          </p>
        </div>

        <GlassCard className="gradient-border">
          <LoginForm />
        </GlassCard>

        <p className="text-center mt-6 text-sm text-[var(--text-muted)]">
          No account yet?{' '}
          <Link
            href="/signup"
            className="font-medium hover:underline transition-colors"
            style={{ color: 'var(--accent2)' }}
          >
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
