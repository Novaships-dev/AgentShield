import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Agent Cost Calculator — AgentShield',
  description:
    'Calculate your LLM API costs before they surprise you. Estimate monthly spend for GPT-4, Claude, and other models based on your usage.',
  alternates: { canonical: 'https://agentshield.one/tools/cost-calculator' },
  openGraph: {
    title: 'AI Agent Cost Calculator',
    description: 'Estimate your monthly LLM API costs. Free tool by AgentShield.',
    url: 'https://agentshield.one/tools/cost-calculator',
    siteName: 'AgentShield',
  },
}

export default function CostCalculatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
