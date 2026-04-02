import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

// ── Competitor data ───────────────────────────────────────────────────────────

type Competitor = {
  name: string
  slug: string
  tagline: string
  description: string
  color: string
  strengthTitle: string
  strengths: string[]
  limitationTitle: string
  limitations: string[]
  architectureNote: string
  bestFor: string
  agentShieldBestFor: string
}

const COMPETITORS: Record<string, Competitor> = {
  langsmith: {
    name: 'LangSmith',
    slug: 'langsmith',
    tagline: 'AI Agent Monitoring Compared',
    description:
      'LangSmith is LangChain\'s observability platform — built specifically for LangChain applications. AgentShield is framework-agnostic and adds budget enforcement and no-code support.',
    color: '#1c86ee',
    strengthTitle: 'LangSmith is great if you are',
    strengths: [
      '100% committed to the LangChain ecosystem',
      'Building with LangGraph or LangChain Expression Language',
      'Want open-source self-hosting options',
      'Need deep LangChain-native tracing',
    ],
    limitationTitle: 'LangSmith limitations',
    limitations: [
      'Requires LangChain SDK — not usable with raw OpenAI or Anthropic calls',
      'No per-agent budget caps or kill switches',
      'No no-code support (n8n, Make, Zapier)',
      'No PII redaction or guardrails',
      'No anomaly detection with statistical baselines',
      'LangSmith tracks what happened — not what it cost per agent',
    ],
    architectureNote:
      'LangSmith is deeply integrated with LangChain. If you use LangGraph, you get automatic tracing. If you use anything else (raw OpenAI, CrewAI, custom agents), you need manual instrumentation.',
    bestFor: 'Teams 100% committed to the LangChain stack who need LangGraph tracing.',
    agentShieldBestFor:
      'Teams who want framework-agnostic monitoring, per-agent budget enforcement, no-code support, and PII guardrails — regardless of which LLM framework they use.',
  },
  helicone: {
    name: 'Helicone',
    slug: 'helicone',
    tagline: 'LLM Cost Tracking Compared',
    description:
      'Helicone works as a proxy — you route your API calls through their servers to get logging and cost tracking. AgentShield uses a lightweight SDK or REST API, with no proxy required.',
    color: '#7c3aed',
    strengthTitle: 'Helicone is great if you are',
    strengths: [
      'Want zero-code instrumentation via proxy URL change',
      'Already using OpenAI and want instant logging',
      'Need request caching to reduce costs',
      'Want a simple observability layer with minimal setup',
    ],
    limitationTitle: 'Helicone limitations',
    limitations: [
      'Proxy architecture means all your LLM traffic routes through Helicone\'s servers',
      'No per-agent budget caps or kill switches',
      'No session replay or step-by-step agent timeline',
      'No no-code support (n8n, Make, Zapier)',
      'No PII redaction or guardrails',
      'No anomaly detection',
      'Per-agent cost breakdown requires manual tagging',
    ],
    architectureNote:
      'Helicone\'s proxy model is simple to set up — change your base URL and you get logging. The trade-off: your production LLM traffic flows through a third-party server. Some teams have compliance requirements that make this difficult.',
    bestFor: 'Developers who want instant LLM logging with zero code and are comfortable with the proxy architecture.',
    agentShieldBestFor:
      'Teams who want per-agent attribution, session replay, budget enforcement, and guardrails — without routing production traffic through a proxy.',
  },
  langfuse: {
    name: 'Langfuse',
    slug: 'langfuse',
    tagline: 'Open Source LLM Observability Compared',
    description:
      'Langfuse is an open-source LLM observability platform that can be self-hosted. AgentShield is managed infrastructure with zero DevOps overhead, plus budget enforcement and no-code support.',
    color: '#10B981',
    strengthTitle: 'Langfuse is great if you are',
    strengths: [
      'Want open-source and self-hosted for data sovereignty',
      'Need to keep all LLM data on your own infrastructure',
      'Have DevOps capacity to manage the deployment',
      'Want to contribute to or customize an open-source tool',
    ],
    limitationTitle: 'Langfuse limitations',
    limitations: [
      'Self-hosting requires infrastructure setup, maintenance, and scaling',
      'No per-agent budget caps or kill switches',
      'No no-code support (n8n, Make, Zapier)',
      'No anomaly detection with statistical baselines',
      'No PII redaction or guardrails',
      'Cloud version has usage-based pricing that can add up',
    ],
    architectureNote:
      'Langfuse open-source is genuinely good. The self-hosting gives you full data control. The cost is that you own the infra — updates, scaling, backups, monitoring the monitoring tool. For solo developers or small teams, this is often more overhead than value.',
    bestFor: 'Teams with strict data sovereignty requirements and DevOps capacity to self-host.',
    agentShieldBestFor:
      'Teams who want managed infrastructure with zero DevOps overhead, per-agent budget enforcement, no-code support, and anomaly detection out of the box.',
  },
}

// ── Comparison table data ─────────────────────────────────────────────────────

const TABLE_ROWS = [
  { feature: 'Per-agent cost breakdown',             agentshield: true,  langsmith: false, helicone: false, langfuse: true  },
  { feature: 'Per-session cost breakdown',           agentshield: true,  langsmith: true,  helicone: false, langfuse: true  },
  { feature: 'Session Replay',                       agentshield: true,  langsmith: true,  helicone: false, langfuse: true  },
  { feature: 'Budget caps per agent',                agentshield: true,  langsmith: false, helicone: false, langfuse: false },
  { feature: 'Kill switch per agent',                agentshield: true,  langsmith: false, helicone: false, langfuse: false },
  { feature: 'Anomaly detection',                    agentshield: true,  langsmith: false, helicone: false, langfuse: false },
  { feature: 'Guardrails & PII redaction',           agentshield: true,  langsmith: false, helicone: false, langfuse: false },
  { feature: 'No-code support (n8n, Make, Zapier)', agentshield: true,  langsmith: false, helicone: false, langfuse: false },
  { feature: 'REST API (no SDK required)',           agentshield: true,  langsmith: false, helicone: true,  langfuse: true  },
  { feature: 'No proxy required',                   agentshield: true,  langsmith: true,  helicone: false, langfuse: true  },
  { feature: 'Managed (zero infra)',                 agentshield: true,  langsmith: true,  helicone: true,  langfuse: false },
  { feature: 'Free tier',                            agentshield: true,  langsmith: true,  helicone: true,  langfuse: true  },
]

// ── Static generation ─────────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(COMPETITORS).map(competitor => ({ competitor }))
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>
}): Promise<Metadata> {
  const { competitor } = await params
  const c = COMPETITORS[competitor]
  if (!c) return { title: 'Not Found' }
  return {
    title: `AgentShield vs ${c.name}: ${c.tagline}`,
    description: c.description,
    openGraph: {
      title: `AgentShield vs ${c.name}: ${c.tagline}`,
      description: c.description,
      url: `https://agentshield.one/compare/${competitor}`,
      siteName: 'AgentShield',
      type: 'website',
      images: [{ url: 'https://agentshield.one/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `AgentShield vs ${c.name}`,
      description: c.description,
      creator: '@NovaShips',
      images: ['/og-image.png'],
    },
    alternates: { canonical: `https://agentshield.one/compare/${competitor}` },
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ComparePage({
  params,
}: {
  params: Promise<{ competitor: string }>
}) {
  const { competitor } = await params
  const c = COMPETITORS[competitor]
  if (!c) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AgentShield',
    url: 'https://agentshield.one',
    applicationCategory: 'DeveloperApplication',
    description: `AgentShield vs ${c.name}: ${c.description}`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Nova', url: 'https://x.com/NovaShips' },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main style={{ background: '#030014', minHeight: '100vh', padding: '96px 20px 80px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>

          {/* Back */}
          <Link href="/" style={{ color: '#4a3d6b', fontSize: 14, textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
            ← AgentShield
          </Link>

          {/* Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa', padding: '3px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
              Comparison
            </span>
          </div>

          {/* Title */}
          <h1 style={{ color: '#e2d9f3', fontSize: 'clamp(26px, 4.5vw, 36px)', fontWeight: 700, margin: '0 0 16px', letterSpacing: '-0.8px', lineHeight: 1.2 }}>
            AgentShield vs {c.name}
          </h1>
          <p style={{ color: '#9d8ec4', fontSize: 17, lineHeight: 1.7, marginBottom: 48, maxWidth: 620 }}>
            {c.description}
          </p>

          {/* Comparison table */}
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 48 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '12px 20px' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feature</span>
              <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700, minWidth: 120, textAlign: 'center' }}>AgentShield</span>
              <span style={{ color: c.color, fontSize: 12, fontWeight: 700, minWidth: 100, textAlign: 'center' }}>{c.name}</span>
            </div>
            {TABLE_ROWS.map((row, i) => {
              const competitorVal = row[competitor as keyof typeof row] as boolean
              return (
                <div
                  key={row.feature}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    padding: '13px 20px',
                    borderBottom: i < TABLE_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{row.feature}</span>
                  <span style={{ minWidth: 120, textAlign: 'center', fontSize: 16 }}>
                    {row.agentshield ? (
                      <span style={{ color: '#4ade80' }}>✓</span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.15)' }}>✗</span>
                    )}
                  </span>
                  <span style={{ minWidth: 100, textAlign: 'center', fontSize: 16 }}>
                    {competitorVal ? (
                      <span style={{ color: '#4ade80' }}>✓</span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.15)' }}>✗</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Architecture note */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px', marginBottom: 40 }}>
            <p style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Architecture note</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{c.architectureNote}</p>
          </div>

          {/* Strengths */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 48 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '24px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600, margin: '0 0 16px' }}>{c.strengthTitle}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.strengths.map(s => (
                  <li key={s} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: c.color, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5 }}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 12, padding: '24px' }}>
              <p style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, margin: '0 0 16px' }}>{c.limitationTitle}</p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.limitations.map(l => (
                  <li key={l} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#f87171', fontSize: 14, flexShrink: 0, marginTop: 1 }}>✗</span>
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5 }}>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Who should choose what */}
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ color: '#e2d9f3', fontSize: 22, fontWeight: 700, margin: '0 0 20px', letterSpacing: '-0.4px' }}>
              Who should choose what
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${c.color}20`, border: `1px solid ${c.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: c.color, fontSize: 14, fontWeight: 700 }}>{c.name[0]}</span>
                </div>
                <div>
                  <p style={{ color: '#e2d9f3', fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Choose {c.name} if</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{c.bestFor}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#a78bfa', fontSize: 14, fontWeight: 700 }}>A</span>
                </div>
                <div>
                  <p style={{ color: '#e2d9f3', fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Choose AgentShield if</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{c.agentShieldBestFor}</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: '32px', textAlign: 'center' }}>
            <p style={{ color: '#e2d9f3', fontWeight: 700, fontSize: 20, margin: '0 0 8px', letterSpacing: '-0.3px' }}>
              Try AgentShield free
            </p>
            <p style={{ color: '#9d8ec4', fontSize: 15, margin: '0 0 24px' }}>
              Per-agent cost tracking, session replay, budget caps. Free plan. No credit card.
            </p>
            <a
              href="https://app.agentshield.one/setup"
              style={{ display: 'inline-block', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 600, fontSize: 15 }}
            >
              Start Free →
            </a>
          </div>

          {/* Other comparisons */}
          <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 16 }}>Other comparisons</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(COMPETITORS)
                .filter(([key]) => key !== competitor)
                .map(([key, comp]) => (
                  <Link
                    key={key}
                    href={`/compare/${key}`}
                    style={{ color: '#a78bfa', fontSize: 14, textDecoration: 'none', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', padding: '6px 16px', borderRadius: 99 }}
                  >
                    vs {comp.name} →
                  </Link>
                ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
