import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductClient from './ProductClient'
import ProductMaterialStory from '@/components/ProductMaterialStory'
import type { Crumb } from '@/components/Breadcrumbs'
import { showsMaterialStory } from '@/lib/materialStory'
import { getProductBySlug, getVariantsForProduct } from '@/lib/payload'
import { getProductReviewSummary } from '@/lib/reviewServer'
import { withVideoPosters } from '@/lib/videoPosterServer'
import { SITE_URL } from '@/lib/site'

function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val)
    return String((val as { url?: string }).url ?? '')
  return ''
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return {}

  const ogImage = product.images?.[0]
    ? mediaUrl((product.images[0] as any).image)
    : ''

  return {
    title: `${product.title} – Smart batteriorganisator`,
    description: product.description ?? '',
    alternates: {
      canonical: `/produkter/${slug}`,
    },
    openGraph: {
      title: `${product.title} – Smart batteriorganisator`,
      description: product.description ?? '',
      ...(ogImage && {
        images: [{ url: ogImage, width: 1200, height: 1200, alt: product.title }],
      }),
    },
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ variant?: string }>
}) {
  const { slug } = await params
  const { variant } = await searchParams

  const product = await getProductBySlug(slug)
  if (!product) notFound()

  // Accessories live in the same collection and on this same route — only the trail
  // above the title differs.
  const parentCrumb: Crumb =
    product.section === 'accessories'
      ? { label: 'Tilbehør', href: '/tilbehor' }
      : { label: 'Produkter', href: '/produkter' }

  const rawVariants = await getVariantsForProduct(String(product.id))
  const reviewSummary = await getProductReviewSummary(String(product.id))

  // The poster is settled here, against the real Blob folder, so the markup Safari
  // receives already carries the right still — see withVideoPosters.
  const variants = await withVideoPosters(
    rawVariants.map((v) => ({
      id: String(v.id),
      name: v.name ?? '',
      colorHex: v.colorHex ?? '#000000',
      image: mediaUrl((v as any).image),
      sku: v.sku ?? '',
      inventory: v.inventory ?? 0,
      sortOrder: v.sortOrder ?? 0,
      videoUrl: v.videoUrl ?? null,
    })),
  )

  const productImages = ((product.images as any[]) ?? [])
    .map((entry) => ({
      src: mediaUrl(entry.image),
      alt: entry.alt ?? product.title,
    }))
    .filter((img) => img.src)

  const features = (product.features ?? []).map((f, i) => ({
    id: f.id ?? String(i),
    number: f.number ?? String(i + 1).padStart(2, '0'),
    title: f.title,
    description: f.description,
  }))

  const details = (((product as any).details as any[]) ?? []).map((d: any, i: number) => ({
    id: d.id ?? String(i),
    title: d.title ?? '',
    content: d.content ?? '',
  })).filter((d) => d.title)

  const faqs = ((product.faqs as any[]) ?? []).map((f: any, i: number) => ({
    id: f.id ?? String(i),
    question: f.question ?? '',
    answer: f.answer ?? '',
  })).filter((f) => f.question)

  // Product structured data with aggregateRating — ONLY when real approved reviews exist
  // (spec §12: never emit a fake aggregateRating). Placed on the product page rather than
  // the Organization, which is where review/rating schema belongs.
  const productJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description ?? '',
    url: `${SITE_URL}/produkter/${slug}`,
    ...(productImages[0]?.src ? { image: productImages[0].src } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'NOK',
      price: (product.salePrice ?? product.price ?? 0).toString(),
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/produkter/${slug}`,
    },
    ...(reviewSummary.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: reviewSummary.average.toFixed(1),
            reviewCount: reviewSummary.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <ProductClient
      reviewSummary={reviewSummary}
      product={{
        id: String(product.id),
        title: product.title,
        slug: product.slug ?? slug,
        tagline: product.tagline ?? '',
        description: product.description ?? '',
        price: product.price ?? 0,
        images: productImages,
        features,
        details,
        faqs,
        capacity: {
          aa: product.capacity?.aa ?? 0,
          aaa: product.capacity?.aaa ?? 0,
          usedCompartments: product.capacity?.usedCompartments ?? 0,
        },
        sale: {
          salePrice: product.salePrice ?? null,
          saleStartDate: product.saleStartDate ?? null,
          saleEndDate: product.saleEndDate ?? null,
        },
      }}
      variants={variants}
      initialSku={variant}
      // Rendered here rather than inside ProductClient so the section stays a server
      // component. Only products confirmed to be PLA Matte printed in Norway get it.
      materialStory={showsMaterialStory(product.slug ?? slug) ? <ProductMaterialStory /> : null}
      breadcrumbs={[{ label: 'Hjem', href: '/' }, parentCrumb, { label: product.title }]}
      />
    </>
  )
}
