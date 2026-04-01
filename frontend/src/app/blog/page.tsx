import Link from 'next/link'
import type { Metadata } from 'next'
import { articles } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog — AI Agent Monitoring & Observability Insights',
  description:
    'Practical guides on AI agent monitoring, LLM observability, cost tracking, and running AI agents reliably in production.',
  openGraph: {
    title: 'AgentShield Blog — AI Agent Observability',
    description:
      'Practical guides on AI agent monitoring, LLM observability, and cost tracking.',
    url: 'https://agentshield.one/blog',
    siteName: 'AgentShield',
    images: [{ url: 'https://agentshield.one/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentShield Blog',
    description: 'AI agent monitoring tips and best practices.',
    images: ['/og-image.png'],
    creator: '@NovaShips',
  },
  alternates: { canonical: 'https://agentshield.one/blog' },
}

export default function BlogIndex() {
  return (
    <main style={{ background: '#030014', minHeight: '100vh', padding: '96px 20px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p
          style={{
            color: '#7c3aed',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Blog
        </p>
        <h1
          style={{
            color: '#e2d9f3',
            fontSize: 'clamp(28px, 5vw, 38px)',
            fontWeight: 700,
            margin: '0 0 12px',
            letterSpacing: '-1px',
            lineHeight: 1.15,
          }}
        >
          AI Agent Observability Insights
        </h1>
        <p
          style={{
            color: '#9d8ec4',
            fontSize: 17,
            marginBottom: 56,
            lineHeight: 1.6,
            maxWidth: 520,
          }}
        >
          Practical guides on monitoring, cost tracking, and running AI agents reliably in
          production.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {articles.map((post, i) => (
            <article
              key={post.slug}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: 32,
                paddingTop: i === 0 ? 0 : 32,
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      background: 'rgba(124,58,237,0.12)',
                      border: '1px solid rgba(124,58,237,0.25)',
                      color: '#a78bfa',
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                <h2
                  style={{
                    color: '#e2d9f3',
                    fontSize: 21,
                    fontWeight: 700,
                    margin: '0 0 10px',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.3,
                    transition: 'color 0.15s',
                  }}
                >
                  {post.title}
                </h2>
              </Link>
              <p
                style={{
                  color: '#9d8ec4',
                  fontSize: 15,
                  lineHeight: 1.7,
                  margin: '0 0 16px',
                  maxWidth: 600,
                }}
              >
                {post.description}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#4a3d6b', fontSize: 13 }}>{post.date}</span>
                <span style={{ color: '#2a1f4e' }}>·</span>
                <span style={{ color: '#4a3d6b', fontSize: 13 }}>{post.readTime}</span>
                <Link
                  href={`/blog/${post.slug}`}
                  style={{
                    color: '#7c3aed',
                    fontSize: 13,
                    fontWeight: 600,
                    marginLeft: 'auto',
                    textDecoration: 'none',
                  }}
                >
                  Read article →
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div style={{ marginTop: 56, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <Link
            href="/"
            style={{ color: '#4a3d6b', fontSize: 14, textDecoration: 'none' }}
          >
            ← Back to AgentShield
          </Link>
        </div>
      </div>
    </main>
  )
}
