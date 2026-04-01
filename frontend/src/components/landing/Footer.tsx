import Link from 'next/link'
import NewsletterForm from './NewsletterForm'

const PRODUCT_LINKS = [
  { label: 'Blog', href: '/blog' },
  { label: 'Cost Calculator', href: '/tools/cost-calculator' },
  { label: 'Docs', href: '/docs' },
  { label: 'REST API', href: '/docs/rest-api' },
  { label: 'Pricing', href: '/#pricing' },
]

const INTEGRATIONS_LINKS = [
  { label: 'Python SDK', href: '/docs/sdk' },
  { label: 'n8n', href: '/integrations/n8n' },
  { label: 'Make', href: '/integrations/make' },
  { label: 'Zapier', href: '/integrations/zapier' },
  { label: 'LangChain', href: '/integrations/langchain' },
  { label: 'OpenAI', href: '/integrations/openai' },
]

const COMPARE_LINKS = [
  { label: 'vs LangSmith', href: '/compare/langsmith' },
  { label: 'vs Helicone', href: '/compare/helicone' },
  { label: 'vs Langfuse', href: '/compare/langfuse' },
]

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Status', href: 'https://status.agentshield.one' },
  { label: 'GitHub', href: 'https://github.com/NovaShips' },
]

export default function Footer() {
  return (
    <footer
      className="px-8 pt-4 pb-10"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Newsletter */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 0 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <NewsletterForm />
      </div>

      {/* Link columns */}
      <div
        className="max-w-[1100px] mx-auto py-10"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {[
          { title: 'Product', links: PRODUCT_LINKS },
          { title: 'Integrations', links: INTEGRATIONS_LINKS },
          { title: 'Compare', links: COMPARE_LINKS },
          { title: 'Company', links: LEGAL_LINKS },
        ].map(col => (
          <div key={col.title}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {col.title}
            </p>
            <div className="flex flex-col gap-2.5">
              {col.links.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs no-underline transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1100px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="AgentShield" className="h-6 w-auto" />
          <span className="text-sm font-bold" style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AgentShield
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>by Nova</span>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} AgentShield
        </p>
      </div>
    </footer>
  )
}
