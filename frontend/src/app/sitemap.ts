import { MetadataRoute } from 'next'
import { articles } from '@/lib/blog'

const BASE = 'https://agentshield.one'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const blogEntries: MetadataRoute.Sitemap = articles.map(a => ({
    url: `${BASE}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [
    // Core
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/setup`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },

    // Blog
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    ...blogEntries,

    // Docs
    { url: `${BASE}/docs/quickstart`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/docs/rest-api`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${BASE}/docs/sdk`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/docs/api`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/docs/frameworks`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },

    // Integrations — SDK & Frameworks
    { url: `${BASE}/integrations/langchain`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/integrations/openai`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/integrations/anthropic`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/integrations/crewai`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/integrations/llamaindex`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/integrations/autogen`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },

    // Integrations — No-code & API
    { url: `${BASE}/integrations/n8n`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/integrations/make`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/integrations/zapier`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/integrations/flowise`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/integrations/javascript`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 },

    // Compare
    { url: `${BASE}/compare/langsmith`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/compare/helicone`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/compare/langfuse`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },

    // Tools
    { url: `${BASE}/tools/cost-calculator`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.75 },
  ]
}
