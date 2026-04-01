import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { articles, getArticleBySlug, type Article } from '@/lib/blog'

// ── Static generation ─────────────────────────────────────────────────────────

export function generateStaticParams() {
  return articles.map(a => ({ slug: a.slug }))
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return { title: 'Not Found' }
  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://agentshield.one/blog/${article.slug}`,
      siteName: 'AgentShield',
      type: 'article',
      publishedTime: article.date,
      authors: ['Nova — AgentShield'],
      images: [{ url: 'https://agentshield.one/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      creator: '@NovaShips',
      images: ['/og-image.png'],
    },
    alternates: { canonical: `https://agentshield.one/blog/${article.slug}` },
  }
}

// ── Markdown renderer — pure JSX, no external deps ────────────────────────────

function renderContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let codeLines: string[] = []
  let inCode = false
  let key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        nodes.push(
          <pre
            key={key++}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '16px 20px',
              overflowX: 'auto',
              margin: '24px 0',
            }}
          >
            <code
              style={{
                color: '#a78bfa',
                fontSize: 13,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                lineHeight: 1.7,
              }}
            >
              {codeLines.join('\n')}
            </code>
          </pre>,
        )
        codeLines = []
        inCode = false
      } else {
        inCode = true
      }
    } else if (inCode) {
      codeLines.push(line)
    } else if (line.startsWith('## ')) {
      nodes.push(
        <h2
          key={key++}
          style={{
            color: '#e2d9f3',
            fontSize: 22,
            fontWeight: 700,
            margin: '44px 0 14px',
            letterSpacing: '-0.4px',
            lineHeight: 1.3,
          }}
        >
          {line.slice(3)}
        </h2>,
      )
    } else if (line.startsWith('### ')) {
      nodes.push(
        <h3
          key={key++}
          style={{
            color: '#c4b5fd',
            fontSize: 17,
            fontWeight: 600,
            margin: '28px 0 8px',
          }}
        >
          {line.slice(4)}
        </h3>,
      )
    } else if (line.startsWith('- ')) {
      nodes.push(
        <li
          key={key++}
          style={{
            color: '#9d8ec4',
            fontSize: 16,
            lineHeight: 1.8,
            marginBottom: 6,
            paddingLeft: 4,
          }}
        >
          {line.slice(2)}
        </li>,
      )
    } else if (line.trim() !== '') {
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      const children = parts.map((p, i) =>
        p.startsWith('**') ? (
          <strong key={i} style={{ color: '#e2d9f3', fontWeight: 600 }}>
            {p.slice(2, -2)}
          </strong>
        ) : (
          p
        ),
      )
      nodes.push(
        <p key={key++} style={{ color: '#9d8ec4', fontSize: 16, lineHeight: 1.85, margin: '14px 0' }}>
          {children}
        </p>,
      )
    }
  }
  return nodes
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    author: {
      '@type': 'Person',
      name: 'Nova',
      url: 'https://x.com/NovaShips',
    },
    publisher: {
      '@type': 'Organization',
      name: 'AgentShield',
      url: 'https://agentshield.one',
      logo: { '@type': 'ImageObject', url: 'https://agentshield.one/logo.svg' },
    },
    image: 'https://agentshield.one/og-image.png',
    url: `https://agentshield.one/blog/${article.slug}`,
    mainEntityOfPage: `https://agentshield.one/blog/${article.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main style={{ background: '#030014', minHeight: '100vh', padding: '96px 20px 80px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Back */}
          <Link
            href="/blog"
            style={{ color: '#4a3d6b', fontSize: 14, textDecoration: 'none', display: 'inline-block', marginBottom: 36 }}
          >
            ← All articles
          </Link>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {article.tags.map(tag => (
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

          {/* Title */}
          <h1
            style={{
              color: '#e2d9f3',
              fontSize: 'clamp(26px, 4.5vw, 34px)',
              fontWeight: 700,
              margin: '0 0 20px',
              letterSpacing: '-0.8px',
              lineHeight: 1.2,
            }}
          >
            {article.title}
          </h1>

          {/* Meta */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 48,
              paddingBottom: 28,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#4a3d6b', fontSize: 13 }}>{article.date}</span>
            <span style={{ color: '#2a1f4e', fontSize: 13 }}>·</span>
            <span style={{ color: '#4a3d6b', fontSize: 13 }}>{article.readTime}</span>
            <span style={{ color: '#2a1f4e', fontSize: 13 }}>·</span>
            <span style={{ color: '#4a3d6b', fontSize: 13 }}>Nova — @NovaShips</span>
          </div>

          {/* Content */}
          <div>{renderContent(article.content)}</div>

          {/* CTA */}
          <div
            style={{
              marginTop: 72,
              padding: '32px 36px',
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 14,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                color: '#e2d9f3',
                fontWeight: 700,
                fontSize: 20,
                margin: '0 0 8px',
                letterSpacing: '-0.3px',
              }}
            >
              Ready to monitor your AI agents?
            </p>
            <p style={{ color: '#9d8ec4', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5 }}>
              Set up AgentShield in 5 minutes. Free plan available.
            </p>
            <a
              href="https://app.agentshield.one/setup"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                color: '#fff',
                textDecoration: 'none',
                padding: '12px 28px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Start for Free →
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
