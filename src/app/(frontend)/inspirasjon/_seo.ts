import type { Metadata } from 'next'
import { getSortedArticles, type InspirasjonArticle } from './_data'

export const SITE_URL = 'https://aboks.no'
export const SITE_NAME = 'aBoks'

/** Facebook/Twitter large-image previews render reliably from this size up. */
const MIN_OG_WIDTH = 1200
const MIN_OG_HEIGHT = 630

const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/images/hero-desktop.webp`,
  width: 3500,
  height: 1997,
  alt: 'aBoks – Smart batteriorganisering',
}

function getArticleBySlug(slug: string): InspirasjonArticle | undefined {
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
  const url = `${SITE_URL}${path}`
  const image = resolveOgImage(article)
  const finalOgTitle = ogTitle ?? title
  const finalOgDescription = ogDescription ?? description

  return {
    title,
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
