import GlassCard from '@/components/ui/GlassCard'
import GlowButton from '@/components/ui/GlowButton'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4"
          style={{ background: 'var(--dark)' }}>
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-2xl">
        {/* Badge */}
        <div className="glass px-4 py-1.5 text-sm font-mono"
             style={{ color: 'var(--accent2)' }}>
          Coming Soon
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-bold leading-tight" style={{ fontFamily: 'var(--font-inter)' }}>
          <span className="text-gradient-static">AgentShield</span>
        </h1>

        <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
          The complete observability suite for AI agents.
          <br />
          Monitor costs · Detect anomalies · Protect with guardrails.
        </p>

        {/* Card */}
        <GlassCard className="w-full">
          <p className="text-sm font-mono mb-4" style={{ color: 'var(--text-muted)' }}>
            Get started in seconds
          </p>
          <pre className="text-left text-sm font-mono rounded-lg p-4"
               style={{ background: 'var(--surface-1)', color: 'var(--accent2)' }}>
            <code>pip install agentshield</code>
          </pre>
        </GlassCard>

        {/* CTA */}
        <div className="flex gap-4">
          <GlowButton variant="primary">Join Waitlist</GlowButton>
          <GlowButton variant="secondary">View Docs</GlowButton>
        </div>

        {/* Footer */}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Sprint 0 · Foundation complete
        </p>
      </div>
    </main>
  )
}
