import { MetadataRoute } from 'next'
import { readdirSync } from 'fs'
import { join } from 'path'
import { getProducts } from '@/lib/payload'

export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE_URL, changeFrequency: 'daily', priority: 1 },
  { url: `${BASE_URL}/produkter`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE_URL}/inspirasjon`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/kontakt`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/frakt-og-retur`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE_URL}/kjopsvilkar`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${BASE_URL}/personvernerklaering`, changeFrequency: 'monthly', priority: 0.3 },
]

function getArticleSlugs(): string[] {
  try {
    const dir = join(process.cwd(), 'src', 'app', '(frontend)', 'inspirasjon')
    return readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, articleSlugs] = await Promise.all([
    getProducts(),
    Promise.resolve(getArticleSlugs()),
  ])

  const productPages: MetadataRoute.Sitemap = products.map(p => ({
    url: `${BASE_URL}/produkter/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const articlePages: MetadataRoute.Sitemap = articleSlugs.map(slug => ({
    url: `${BASE_URL}/inspirasjon/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...STATIC_PAGES, ...productPages, ...articlePages]
}
