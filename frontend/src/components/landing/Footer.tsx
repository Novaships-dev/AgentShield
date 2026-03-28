import Link from 'next/link'

const LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Status', href: 'https://status.agentshield.one' },
  { label: 'Docs', href: '/docs' },
  { label: 'GitHub', href: 'https://github.com/NovaShips' },
]

export default function Footer() {
  return (
    <footer
      className="py-10 px-8"
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="AgentShield" className="h-6 w-auto" />
          <span
            className="text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AgentShield
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            by Nova
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 flex-wrap justify-center">
          {LINKS.map(link => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs no-underline transition-colors duration-200"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} AgentShield
        </p>
      </div>
    </footer>
  )
}
