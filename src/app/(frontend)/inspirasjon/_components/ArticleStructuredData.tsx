import { buildArticleBreadcrumbJsonLd, buildArticleJsonLd, getArticleBySlug } from '../_seo'

/**
 * The Article and BreadcrumbList JSON-LD for one /inspirasjon article, built from the
 * article registry (_data.ts). Renders nothing visible. Each article page includes it
 * once, with its own folder name as `slug`; an unregistered slug renders nothing rather
 * than half a schema.
 */
export default function ArticleStructuredData({ slug }: { slug: string }) {
  const article = getArticleBySlug(slug)
  if (!article) return null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleJsonLd(article)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleBreadcrumbJsonLd(article)) }}
      />
    </>
  )
}
