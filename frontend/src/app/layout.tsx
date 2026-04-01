import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://agentshield.one'),
  title: {
    default: 'AgentShield — The complete observability suite for AI agents',
    template: '%s | AgentShield',
  },
  description:
    'Monitor costs, replay every session, protect with guardrails. One SDK. One line of code. Full visibility for your AI agents.',
  keywords: [
    'AI agent monitoring',
    'LLM cost tracking',
    'agent observability',
    'LLM observability',
    'AI cost tracking',
    'guardrails',
    'session replay',
    'OpenAI cost tracking',
    'LangChain monitoring',
  ],
  authors: [{ name: 'Nova', url: 'https://github.com/NovaShips' }],
  creator: 'Nova',
  verification: {
    google: '0TYiVDajcU5iokWwEgY9B6BMl9ge3sGNnrZDalRR2cw',
  },
  openGraph: {
    title: 'AgentShield — The complete observability suite for AI agents',
    description:
      'Monitor costs, replay every session, protect with guardrails. One SDK. One line of code.',
    type: 'website',
    url: 'https://agentshield.one',
    siteName: 'AgentShield',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AgentShield — AI Agent Observability',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentShield — The complete observability suite for AI agents',
    description: 'Monitor costs, replay every session, protect with guardrails.',
    images: ['/og-image.png'],
    creator: '@NovaShips',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'AgentShield',
              url: 'https://agentshield.one',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              description:
                'AI agent observability platform — monitor costs, replay sessions, and enforce guardrails for your LLM applications.',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              author: { '@type': 'Person', name: 'Nova', url: 'https://x.com/NovaShips' },
            }),
          }}
        />
        {children}
        {/* Plausible analytics — agentshield.one */}
        <Script
          defer
          data-domain="agentshield.one"
          src="https://plausible.io/js/script.tagged-events.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-WBZD30G3T3"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-WBZD30G3T3');
          `}
        </Script>
      </body>
    </html>
  )
}
