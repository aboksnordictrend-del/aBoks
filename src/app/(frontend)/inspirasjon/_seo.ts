import type { Metadata } from 'next'
import { buildBreadcrumbJsonLd } from '@/components/Breadcrumbs'
import {
  DEFAULT_OG_IMAGE,
  LOGO_URL,
  PUBLISHER_NAME,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from '@/lib/site'
import { getSortedArticles, type InspirasjonArticle } from './_data'

export { SITE_NAME, SITE_URL }

/** Facebook/Twitter large-image previews render reliably from this size up. */
const MIN_OG_WIDTH = 1200
const MIN_OG_HEIGHT = 630

/** The suffix the root layout's title template (`%s | aBoks`) appends. */
const TITLE_SUFFIX = ` | ${SITE_NAME}`

export function getArticleBySlug(slug: string): InspirasjonArticle | undefined {
  const path = `/inspirasjon/${slug}`
  return getSortedArticles().find((a) => a.slug === path)
}

function resolveOgImage(article: InspirasjonArticle | undefined) {
  if (
    article?.image &&
    article.imageWidth &&
    article.imageHeight &&
    article.imageWidth >= MIN_OG_WIDTH &&
    article.imageHeight >= MIN_OG_HEIGHT
  ) {
    return {
      url: article.image,
      width: article.imageWidth,
      height: article.imageHeight,
      alt: article.imageAlt ?? article.title,
    }
  }
  return DEFAULT_OG_IMAGE
}

/**
 * The document title for an article. A title that already ends in `| aBoks` is used as
 * written — passing it through the layout template would print the brand twice — and
 * every other title gets the suffix from the template, exactly once either way.
 */
export function articleDocumentTitle(title: string): Metadata['title'] {
  return title.endsWith(TITLE_SUFFIX) ? { absolute: title } : title
}

/**
 * Builds a complete Metadata object (Open Graph + Twitter Card) for an
 * /inspirasjon/[slug] article page. Every article page must call this instead
 * of hand-writing its own `openGraph`/`twitter` blocks — Next.js does not
 * deep-merge nested `openGraph` objects between layout and page, so a page
 * that declares its own `openGraph` without `images` silently drops the
 * root layout's fallback image (this was the cause of the missing og:image).
 */
export function buildArticleMetadata({
  slug,
  title,
  description,
  ogTitle,
  ogDescription,
}: {
  slug: string
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
}): Metadata {
  const article = getArticleBySlug(slug)
  const path = `/inspirasjon/${slug}`
  const url = absoluteUrl(path)
  const image = resolveOgImage(article)
  const finalOgTitle = ogTitle ?? title
  const finalOgDescription = ogDescription ?? description

  return {
    title: articleDocumentTitle(title),
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      locale: 'nb_NO',
      url,
      title: finalOgTitle,
      description: finalOgDescription,
      publishedTime: article?.publishedAt,
      ...(article?.updatedAt ? { modifiedTime: article.updatedAt } : {}),
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          type: 'image/webp',
          alt: image.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: finalOgTitle,
      description: finalOgDescription,
      images: [image.url],
    },
  }
}

/** Only absolute http(s) URLs may be named as an image in structured data. */
function isAbsoluteHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Article JSON-LD for one registry entry. Everything comes from the registry: no author
 * name, date or image is stated that the registry does not hold. The company is named as
 * publisher and as author — the articles are written and published by ABOKS AS, not by a
 * named person — and dateModified appears only once `updatedAt` has been recorded.
 */
export function buildArticleJsonLd(article: InspirasjonArticle) {
  const url = absoluteUrl(article.slug)
  const organization = {
    '@type': 'Organization',
    name: PUBLISHER_NAME,
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: LOGO_URL },
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'nb-NO',
    datePublished: article.publishedAt,
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    ...(isAbsoluteHttpUrl(article.image)
      ? {
          image: {
            '@type': 'ImageObject',
            url: article.image,
            ...(article.imageWidth && article.imageHeight
              ? { width: article.imageWidth, height: article.imageHeight }
              : {}),
          },
        }
      : {}),
    author: organization,
    publisher: organization,
  }
}

/** Hjem / Inspirasjon / article — the trail every article already draws above its title. */
export function buildArticleBreadcrumbJsonLd(article: InspirasjonArticle) {
  return buildBreadcrumbJsonLd([
    { label: 'Hjem', href: '/' },
    { label: 'Inspirasjon', href: '/inspirasjon' },
    { label: article.title },
  ])
}
