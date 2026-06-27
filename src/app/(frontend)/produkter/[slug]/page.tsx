import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductClient from './ProductClient'
import { getProductBySlug, getVariantsForProduct } from '@/lib/payload'

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

  const rawVariants = await getVariantsForProduct(String(product.id))

  const variants = rawVariants.map((v) => ({
    id: String(v.id),
    name: v.name ?? '',
    colorHex: v.colorHex ?? '#000000',
    image: mediaUrl((v as any).image),
    sku: v.sku ?? '',
    inventory: v.inventory ?? 0,
    sortOrder: v.sortOrder ?? 0,
  }))

  const productImages = ((product.images as any[]) ?? [])
    .map((entry) => ({
      src: mediaUrl(entry.image),
      alt: entry.alt ?? product.title,
    }))
    .filter((img) => img.src)

  return (
    <ProductClient
      product={{
        id: String(product.id),
        title: product.title,
        slug: product.slug ?? slug,
        tagline: product.tagline ?? '',
        description: product.description ?? '',
        price: product.price ?? 0,
        images: productImages,
        sale: {
          salePrice: product.salePrice ?? null,
          saleStartDate: product.saleStartDate ?? null,
          saleEndDate: product.saleEndDate ?? null,
        },
      }}
      variants={variants}
      initialSku={variant}
    />
  )
}
