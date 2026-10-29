import { MetadataRoute } from 'next'
import { getAccessories, getProducts } from '@/lib/payload'
import { SITE_URL, absoluteUrl } from '@/lib/site'
import { indexableSolutions } from '@/lib/solutions'
import {
  getSortedArticles,
  getTotalPages as getInspirasjonTotalPages,
} from './(frontend)/inspirasjon/_data'

export const revalidate = 3600

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
  { url: `${SITE_URL}/produkter`, changeFrequency: 'daily', priority: 0.9 },
  // Landing page for the "batteriboks" search term.
  { url: `${SITE_URL}/batteriboks`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/tilbehor`, changeFrequency: 'weekly', priority: 0.6 },
  // The B2B hub. Its four solution pages are added further down, from the registry.
  { url: `${SITE_URL}/bedrifter`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/slik-fungerer-det`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE_URL}/bli-partner`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE_URL}/historien`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/inspirasjon`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${SITE_URL}/anmeldelser`, changeFrequency: 'weekly', priority: 0.5 },
  { url: `${SITE_URL}/vanlige-sporsmal`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/kontakt`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${SITE_URL}/frakt-og-retur`, changeFrequency: 'monthly', priority: 0.4 },
  { url: `${SITE_URL}/kjopsvilkar`, changeFrequency: 'monthly', priority: 0.3 },
  { url: `${SITE_URL}/personvernerklaering`, changeFrequency: 'monthly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, accessories] = await Promise.all([getProducts(), getAccessories()])

  // Accessories are products on the same /produkter/[slug] route, so they belong in the
  // same list of detail pages.
  const productPages: MetadataRoute.Sitemap = [...products, ...accessories].map(p => ({
    url: `${SITE_URL}/produkter/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Articles come from the article registry — the same list /inspirasjon shows. (This used
  // to read the route folders from disk, which only exist at build time: once the sitemap
  // revalidated on Vercel the read failed and every article dropped out.) lastmod is the
  // recorded revision date when there is one, otherwise the publication date.
  const articlePages: MetadataRoute.Sitemap = getSortedArticles().map(article => ({
    url: absoluteUrl(article.slug),
    lastModified: new Date(article.updatedAt ?? article.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // The B2B solution pages, taken from the solution registry rather than listed here: a
  // page appears once its content module says it may be indexed, which is the same flag the
  // route uses for its robots metadata. A solution still showing its placeholder has no
  // entry and stays out.
  const solutionPages: MetadataRoute.Sitemap = indexableSolutions().map(solution => ({
    url: `${SITE_URL}/bedrifter/${solution.slug}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const inspirasjonTotalPages = getInspirasjonTotalPages()
  const inspirasjonPaginationPages: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, inspirasjonTotalPages - 1) },
    (_, i) => ({
      url: `${SITE_URL}/inspirasjon/page/${i + 2}`,
      changeFrequency: 'weekly',
      priority: 0.5,
    }),
  )

  // One entry per URL: the first occurrence wins.
  const seen = new Set<string>()
  return [
    ...STATIC_PAGES,
    ...productPages,
    ...solutionPages,
    ...articlePages,
    ...inspirasjonPaginationPages,
  ].filter(entry => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
}
