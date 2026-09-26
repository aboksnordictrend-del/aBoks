import { MetadataRoute } from 'next'
import { readdirSync } from 'fs'
import { join } from 'path'
import { getAccessories, getProducts } from '@/lib/payload'
import { indexableSolutions } from '@/lib/solutions'
import { getTotalPages as getInspirasjonTotalPages } from './(frontend)/inspirasjon/_data'

export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: BASE_URL, changeFrequency: 'daily', priority: 1 },
  { url: `${BASE_URL}/produkter`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/tilbehor`, changeFrequency: 'weekly', priority: 0.6 },
  // The B2B hub. Its four solution pages are added further down, from the registry.
  { url: `${BASE_URL}/bedrifter`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE_URL}/slik-fungerer-det`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE_URL}/historien`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE_URL}/inspirasjon`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/vanlige-sporsmal`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE_URL}/kontakt`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/frakt-og-retur`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${BASE_URL}/kjopsvilkar`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${BASE_URL}/personvernerklaering`, changeFrequency: 'monthly', priority: 0.3 },
]

function getArticleSlugs(): string[] {
  try {
    const dir = join(process.cwd(), 'src', 'app', '(frontend)', 'inspirasjon')
    return readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && d.name !== 'page')
      .map(d => d.name)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, accessories, articleSlugs] = await Promise.all([
    getProducts(),
    getAccessories(),
    Promise.resolve(getArticleSlugs()),
  ])

  // Accessories are products on the same /produkter/[slug] route, so they belong in the
  // same list of detail pages.
  const productPages: MetadataRoute.Sitemap = [...products, ...accessories].map(p => ({
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

  // The B2B solution pages, taken from the solution registry rather than listed here: a
  // page appears once its content module says it may be indexed, which is the same flag the
  // route uses for its robots metadata. A solution still showing its placeholder has no
  // entry and stays out.
  const solutionPages: MetadataRoute.Sitemap = indexableSolutions().map(solution => ({
    url: `${BASE_URL}/bedrifter/${solution.slug}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const inspirasjonTotalPages = getInspirasjonTotalPages()
  const inspirasjonPaginationPages: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, inspirasjonTotalPages - 1) },
    (_, i) => ({
      url: `${BASE_URL}/inspirasjon/page/${i + 2}`,
      changeFrequency: 'weekly',
      priority: 0.5,
    }),
  )

  return [
    ...STATIC_PAGES,
    ...productPages,
    ...solutionPages,
    ...articlePages,
    ...inspirasjonPaginationPages,
  ]
}
