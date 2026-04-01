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
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    ...blogEntries,
    { url: `${BASE}/docs/quickstart`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/docs/sdk`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/docs/api`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/docs/frameworks`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/setup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]
}
