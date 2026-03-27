import Link from 'next/link'

const SIDEBAR = [
  {
    section: 'Getting Started',
    items: [
      { label: 'Quickstart', href: '/docs/quickstart' },
      { label: 'SDK Reference', href: '/docs/sdk' },
    ],
  },
  {
    section: 'API',
    items: [
      { label: 'API Reference', href: '/docs/api' },
      { label: 'Authentication', href: '/docs/api#authentication' },
      { label: 'Events', href: '/docs/api#events' },
    ],
  },
  {
    section: 'Frameworks',
    items: [
      { label: 'LangChain', href: '/docs/frameworks#langchain' },
      { label: 'CrewAI', href: '/docs/frameworks#crewai' },
      { label: 'AutoGen', href: '/docs/frameworks#autogen' },
      { label: 'LlamaIndex', href: '/docs/frameworks#llamaindex' },
    ],
  },
  {
    section: 'Modules',
    items: [
      { label: 'Monitor', href: '/docs/sdk#monitor' },
      { label: 'Replay', href: '/docs/sdk#replay' },
      { label: 'Protect', href: '/docs/sdk#protect' },
    ],
  },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#030014', minHeight: '100vh' }}>
      {/* Top nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-6 gap-4"
        style={{
          background: 'rgba(3,0,20,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Link
          href="/"
          className="text-sm font-bold no-underline"
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #06B6D4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AgentShield
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Docs</span>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="text-xs no-underline px-3 py-1.5 rounded-lg"
          style={{
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.3)',
            color: '#a78bfa',
          }}
        >
          Dashboard →
        </Link>
      </nav>

      <div className="flex pt-14">
        {/* Sidebar */}
        <aside
          className="hidden md:block fixed top-14 bottom-0 left-0 w-56 overflow-y-auto py-8 px-4"
          style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
        >
          {SIDEBAR.map(group => (
            <div key={group.section} className="mb-6">
              <p
                className="text-[10px] font-bold tracking-widest uppercase mb-2 px-2"
                style={{ color: 'rgba(255,255,255,0.3)' }}
              >
                {group.section}
              </p>
              {group.items.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block px-2 py-1.5 rounded-lg text-sm no-underline transition-colors mb-0.5"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 md:ml-56 px-8 py-12 max-w-3xl">
          {children}
        </main>
      </div>
    </div>
  )
}
