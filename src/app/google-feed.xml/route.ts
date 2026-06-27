import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getEffectivePrice } from '@/lib/pricing'
import type { Media, Product, ProductVariant } from '@/payload-types'

export const dynamic = 'force-dynamic'

const BASE_URL = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://aboks.no').replace(/\/$/, '')

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 3) + '...'
}

function resolveImageUrl(media: Media | null | undefined): string | null {
  if (!media) return null
  const raw = media.sizes?.card?.url || media.url
  if (!raw) return null
  return raw.startsWith('http') ? raw : `${BASE_URL}${raw}`
}

function availability(inventory: number): string {
  return inventory > 0 ? 'in stock' : 'out of stock'
}

function formatFeedPrice(price: number): string {
  return `${price.toFixed(2)} NOK`
}

/** Format a UTC ISO string as Europe/Oslo local time with timezone offset, e.g. 2024-06-01T10:00+02:00 */
function toOsloISO(isoStr: string): string {
  const d = new Date(isoStr)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'

  // Compute the Oslo offset by comparing UTC vs Oslo wall-clock interpretation
  const localAsUtcMs = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
  )
  const diffMins = Math.round((localAsUtcMs - d.getTime()) / 60000)
  const sign = diffMins >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(diffMins) / 60)).padStart(2, '0')
  const mm = String(Math.abs(diffMins) % 60).padStart(2, '0')

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}${sign}${hh}:${mm}`
}

interface SaleFields {
  price: string
  salePrice?: string
  saleDateRange?: string
}

function buildSaleFields(product: Product): SaleFields {
  const regularPrice = formatFeedPrice(product.price)
  const sale = {
    salePrice: product.salePrice ?? null,
    saleStartDate: product.saleStartDate ?? null,
    saleEndDate: product.saleEndDate ?? null,
  }
  const effective = getEffectivePrice(product.price, sale)

  if (effective >= product.price) {
    return { price: regularPrice }
  }

  const fields: SaleFields = {
    price: regularPrice,
    salePrice: formatFeedPrice(effective),
  }

  if (sale.saleStartDate && sale.saleEndDate) {
    fields.saleDateRange = `${toOsloISO(sale.saleStartDate)}/${toOsloISO(sale.saleEndDate)}`
  }

  return fields
}

function buildItem(fields: {
  id: string
  title: string
  description: string
  link: string
  imageLink: string
  additionalImages: string[]
  avail: string
  sale: SaleFields
  itemGroupId?: string
  color?: string
}): string {
  const { sale } = fields
  const lines = [
    `    <item>`,
    `      <g:id>${escapeXml(fields.id)}</g:id>`,
    `      <g:title>${escapeXml(fields.title)}</g:title>`,
    `      <g:description>${escapeXml(fields.description)}</g:description>`,
    `      <g:link>${escapeXml(fields.link)}</g:link>`,
    `      <g:image_link>${escapeXml(fields.imageLink)}</g:image_link>`,
    ...fields.additionalImages.map(
      (u) => `      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`,
    ),
    `      <g:availability>${fields.avail}</g:availability>`,
    `      <g:price>${sale.price}</g:price>`,
    ...(sale.salePrice ? [`      <g:sale_price>${sale.salePrice}</g:sale_price>`] : []),
    ...(sale.saleDateRange
      ? [`      <g:sale_price_effective_date>${sale.saleDateRange}</g:sale_price_effective_date>`]
      : []),
    `      <g:brand>aBoks</g:brand>`,
    `      <g:condition>new</g:condition>`,
    `      <g:google_product_category>Home &amp; Garden &gt; Household Supplies</g:google_product_category>`,
    `      <g:product_type>Battery organizer / Home organization</g:product_type>`,
    `      <g:identifier_exists>no</g:identifier_exists>`,
  ]

  if (fields.itemGroupId) {
    lines.push(`      <g:item_group_id>${escapeXml(fields.itemGroupId)}</g:item_group_id>`)
  }
  if (fields.color) {
    lines.push(`      <g:color>${escapeXml(fields.color)}</g:color>`)
  }

  lines.push(`    </item>`)
  return lines.join('\n')
}

export async function GET() {
  try {
    const payload = await getPayloadClient()

    const { docs: products } = await payload.find({
      collection: 'products',
      where: { published: { equals: true } },
      depth: 2,
      limit: 200,
    })

    const items: string[] = []

    for (const product of products as Product[]) {
      const { docs: variants } = await payload.find({
        collection: 'product-variants',
        where: { product: { equals: product.id } },
        sort: 'sortOrder',
        depth: 2,
        limit: 50,
      })

      const productImages = (product.images ?? [])
        .map((row) => (typeof row.image === 'object' ? (row.image as Media) : null))
        .filter(Boolean) as Media[]

      const description = truncate(stripHtml(product.description ?? ''), 5000)
      const sale = buildSaleFields(product)

      if (variants.length > 0) {
        for (const variant of variants as ProductVariant[]) {
          const variantMedia =
            variant.image && typeof variant.image === 'object' ? (variant.image as Media) : null
          const mainImage = variantMedia ?? productImages[0] ?? null
          const imageLink = resolveImageUrl(mainImage)
          if (!imageLink) continue

          const seen = new Set<string>([imageLink])
          const additional: string[] = []
          if (variantMedia && productImages.length > 0) {
            for (const m of productImages) {
              const u = resolveImageUrl(m)
              if (u && !seen.has(u)) {
                seen.add(u)
                additional.push(u)
              }
            }
          }

          items.push(
            buildItem({
              id: `${product.slug}-${variant.sku}`,
              title: `${product.title} - ${variant.name}`,
              description,
              link: `${BASE_URL}/produkter/${product.slug}?variant=${encodeURIComponent(variant.sku)}`,
              imageLink,
              additionalImages: additional,
              avail: availability(variant.inventory),
              sale,
              itemGroupId: product.slug,
              color: variant.name,
            }),
          )
        }
      } else {
        const imageLink = resolveImageUrl(productImages[0] ?? null)
        if (!imageLink) continue

        const additional = productImages
          .slice(1)
          .map(resolveImageUrl)
          .filter(Boolean) as string[]

        items.push(
          buildItem({
            id: product.slug,
            title: product.title,
            description,
            link: `${BASE_URL}/produkter/${product.slug}`,
            imageLink,
            additionalImages: additional,
            avail: 'in stock',
            sale,
          }),
        )
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>aBoks – Google Merchant Center Feed</title>
    <link>${BASE_URL}</link>
    <description>aBoks product feed for Google Merchant Center</description>
${items.join('\n')}
  </channel>
</rss>`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[google-feed] generation error:', err)
    return new NextResponse('Internal error generating feed', { status: 500 })
  }
}
