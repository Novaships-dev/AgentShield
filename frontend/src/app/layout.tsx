import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
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
    'guardrails',
    'session replay',
    'OpenAI cost tracking',
    'LangChain monitoring',
  ],
  authors: [{ name: 'Nova', url: 'https://github.com/NovaShips' }],
  creator: 'Nova',
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
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
