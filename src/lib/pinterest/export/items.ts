// Normalization: Products, Product Variants and the curated homepage list → PinterestExportItem[].
//
// Pure. Takes already-fetched, depth-resolved Payload documents and returns the full preview
// (items + skips + counts), so every rule below is unit-testable without a database, without
// env vars and without a network.

import type { Media, Product, ProductVariant } from '@/payload-types'
import { PINTEREST_HOMEPAGE_ITEMS, type PinterestHomepageItem } from '../homepageItems'
import { DESCRIPTION_MAX, TITLE_MAX, normalizeText } from './text'
import {
  canonicalUrl,
  isCanonicalDestination,
  isPublicHttpsUrl,
  normalizeUrlForComparison,
  resolveMediaUrl,
} from './urls'
import type {
  PinterestExportItem,
  PinterestExportPreview,
  PinterestExportSkip,
  PinterestSourceSelection,
} from './types'

/** Pinterest's documented ceiling: "up to 200 images or videos at the same time". */
export const PINTEREST_ROW_LIMIT = 200

/** Keywords have no documented limit; bounded to the description limit to keep cells sane. */
const KEYWORDS_MAX = DESCRIPTION_MAX

/** Both regular products and accessories live on this route (see src/app/sitemap.ts). */
const PRODUCT_ROUTE = '/produkter'

export interface BuildExportInput {
  products: Product[]
  /** Every variant of the products above; `product` may be an id or a resolved document. */
  variants: ProductVariant[]
  /** Defaults to the curated list; injectable for tests. */
  homepage?: PinterestHomepageItem[]
}

export interface BuildExportOptions {
  baseUrl: string
  baseUrlFallback?: boolean
  sources: PinterestSourceSelection
  limit?: number
}

/** The product id as a string, whether the relationship came back resolved or as an id. */
function productIdOf(variant: ProductVariant): string | null {
  const rel = variant.product
  if (typeof rel === 'number') return String(rel)
  if (rel && typeof rel === 'object' && 'id' in rel) return String(rel.id)
  return null
}

/** Description precedence: SEO description → tagline → the long description. */
function productDescription(product: Product): string {
  return normalizeText(
    product.seo?.description || product.tagline || product.description,
    DESCRIPTION_MAX,
  )
}

/** Title precedence: SEO title → product title. */
function productTitle(product: Product): string {
  return normalizeText(product.seo?.title || product.title, TITLE_MAX)
}

/** The product's main image — the first row of the `images` array. */
function mainImage(product: Product): Media | number | null {
  const first = product.images?.[0]
  return first?.image ?? null
}

/** FNV-1a (32-bit). Deterministic and dependency-free; only ever used to build an id. */
function hash32(value: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Stable identity for one gallery image: `product:{productId}:image:{mediaId}`.
 *
 * Deliberately NOT the gallery index — reordering the array in Payload must not re-key every
 * row, or an admin's preview edits would jump to the wrong image. When the upload relationship
 * carries no id (only possible for a malformed document), the fallback hashes the normalized
 * image URL, which is equally stable for a fixed product + image pair.
 */
export function productImageSourceId(
  productId: string,
  media: Media | number | null | undefined,
  mediaUrl: string,
): string {
  const mediaId =
    typeof media === 'number'
      ? media
      : media && typeof media === 'object' && typeof media.id === 'number'
        ? media.id
        : null
  if (mediaId !== null) return `product:${productId}:image:${mediaId}`
  return `product:${productId}:url:${hash32(normalizeUrlForComparison(mediaUrl))}`
}

/** The dedup key: a normalized (image, destination) pair. */
function pairKey(item: PinterestExportItem): string {
  return JSON.stringify([
    normalizeUrlForComparison(item.mediaUrl),
    normalizeUrlForComparison(item.destinationUrl),
  ])
}

/**
 * Which of two rows that resolved to the same (image, destination) pair survives.
 *
 * Deterministic and independent of array order:
 *   • variant beats product — the variant row carries the colour name and colour-specific copy,
 *     so it is strictly the more specific description of the same photograph;
 *   • variant beats homepage, for the same reason;
 *   • homepage beats product ONLY when its curated title or description actually differs from
 *     the product's. A curated entry that says the same thing adds nothing, so the catalogue
 *     row — which stays in sync with Payload — wins;
 *   • two rows of the same type: the first one wins, which preserves gallery order.
 */
export function preferItem(
  existing: PinterestExportItem,
  candidate: PinterestExportItem,
): PinterestExportItem {
  if (existing.sourceType === candidate.sourceType) return existing
  if (candidate.sourceType === 'variant') return candidate
  if (existing.sourceType === 'variant') return existing

  const [homepageRow, productRow] =
    candidate.sourceType === 'homepage' ? [candidate, existing] : [existing, candidate]
  const curatedDiffers =
    homepageRow.title !== productRow.title || homepageRow.description !== productRow.description
  return curatedDiffers ? homepageRow : productRow
}

/**
 * Build the complete export.
 *
 * Display order is products → variants → homepage. Variants are *computed* first, because a
 * product gallery image that a variant already claims is represented by the variant row
 * instead (see the gallery loop) — but only when variants are actually being exported, so
 * unticking "Varianter" never loses an image.
 *
 * Deduplication is centralized at the end, on the normalized (image, destination) pair, with a
 * deterministic winner from `preferItem`. The 200-row cap is applied last, after dedup, so the
 * cap counts real rows.
 */
export function buildExportItems(
  input: BuildExportInput,
  options: BuildExportOptions,
): PinterestExportPreview {
  const { baseUrl, sources } = options
  const limit = options.limit ?? PINTEREST_ROW_LIMIT
  const homepage = input.homepage ?? PINTEREST_HOMEPAGE_ITEMS

  const productRows: PinterestExportItem[] = []
  const variantRows: PinterestExportItem[] = []
  const homepageRows: PinterestExportItem[] = []
  const skipped: PinterestExportSkip[] = []
  /** variant row sourceId → the id of the product it belongs to. */
  const variantOwnerByRowId = new Map<string, string>()

  const publishedById = new Map<string, Product>()
  for (const product of input.products) {
    if (product.published) publishedById.set(String(product.id), product)
  }

  // Main image URL per product — needed both for the product row and to detect a variant that
  // merely reuses the parent image.
  const mainImageUrlById = new Map<string, string | null>()
  for (const [id, product] of publishedById) {
    mainImageUrlById.set(id, resolveMediaUrl(mainImage(product), baseUrl))
  }

  // ── Variants ────────────────────────────────────────────────────────────────────────────
  // Computed before products so the gallery loop can defer to a variant that owns the image.
  if (sources.variants) {
    for (const variant of input.variants) {
      const sourceId = String(variant.id)
      const label = variant.displayName || variant.name || `Variant ${sourceId}`

      const productId = productIdOf(variant)
      const product = productId ? publishedById.get(productId) : undefined
      if (!product) {
        skipped.push({
          sourceType: 'variant',
          sourceId,
          label,
          reason: 'Overordnet produkt er ikke publisert.',
        })
        continue
      }
      if (!product.slug) {
        skipped.push({
          sourceType: 'variant',
          sourceId,
          label,
          reason: 'Overordnet produkt mangler URL-slug.',
        })
        continue
      }
      if (!variant.image) {
        skipped.push({ sourceType: 'variant', sourceId, label, reason: 'Mangler eget bilde.' })
        continue
      }
      const mediaUrl = resolveMediaUrl(variant.image, baseUrl)
      if (!mediaUrl) {
        skipped.push({
          sourceType: 'variant',
          sourceId,
          label,
          reason: 'Variantbildet er ikke en offentlig https-URL.',
        })
        continue
      }
      // A variant whose image resolves to the parent's main image would produce a duplicate
      // Pin with a different link — excluded by requirement, not merely deduplicated.
      if (mediaUrl === mainImageUrlById.get(String(product.id))) {
        skipped.push({
          sourceType: 'variant',
          sourceId,
          label,
          reason: 'Bruker samme bilde som hovedproduktet.',
        })
        continue
      }

      const title = normalizeText(
        variant.displayName || `${product.title} – ${variant.name}`,
        TITLE_MAX,
      )
      if (!title) {
        skipped.push({ sourceType: 'variant', sourceId, label, reason: 'Mangler tittel.' })
        continue
      }

      // ?variant=<sku> is read by the product page (src/app/(frontend)/produkter/[slug]/page.tsx
      // → searchParams.variant → initialSku). No route is invented; without a SKU the plain
      // product URL is used.
      const path = variant.sku
        ? `${PRODUCT_ROUTE}/${product.slug}?variant=${encodeURIComponent(variant.sku)}`
        : `${PRODUCT_ROUTE}/${product.slug}`

      variantOwnerByRowId.set(sourceId, String(product.id))
      variantRows.push({
        sourceType: 'variant',
        sourceId,
        title,
        description: productDescription(product),
        mediaUrl,
        destinationUrl: canonicalUrl(path, baseUrl),
        keywords: normalizeText(variant.name, KEYWORDS_MAX),
      })
    }
  }

  // Normalized image URLs already represented by an exported variant row, per product. A
  // gallery image in this set is skipped: the variant row is the same photograph with a more
  // specific title, the colour as a keyword and the colour preselected on the product page.
  const variantMediaByProduct = new Map<string, Set<string>>()
  for (const row of variantRows) {
    const owner = variantOwnerByRowId.get(row.sourceId)
    if (!owner) continue
    const set = variantMediaByProduct.get(owner) ?? new Set<string>()
    set.add(normalizeUrlForComparison(row.mediaUrl))
    variantMediaByProduct.set(owner, set)
  }

  // ── Products — one Pin per distinct gallery image ───────────────────────────────────────
  if (sources.products) {
    for (const product of input.products) {
      const productId = String(product.id)
      const label = product.title || `Produkt ${productId}`

      if (!product.published) {
        skipped.push({ sourceType: 'product', sourceId: productId, label, reason: 'Ikke publisert.' })
        continue
      }
      if (!product.slug) {
        skipped.push({ sourceType: 'product', sourceId: productId, label, reason: 'Mangler URL-slug.' })
        continue
      }
      const title = productTitle(product)
      if (!title) {
        skipped.push({ sourceType: 'product', sourceId: productId, label, reason: 'Mangler tittel.' })
        continue
      }

      const gallery = product.images ?? []
      if (gallery.length === 0) {
        skipped.push({
          sourceType: 'product',
          sourceId: productId,
          label,
          reason: 'Mangler produktbilder.',
        })
        continue
      }

      // Every image of a product points at the same canonical product page.
      const destinationUrl = canonicalUrl(`${PRODUCT_ROUTE}/${product.slug}`, baseUrl)
      const description = productDescription(product)
      const claimedByVariant = variantMediaByProduct.get(productId) ?? new Set<string>()
      const seenInGallery = new Set<string>()

      // Gallery order is Payload's array order and is preserved end to end.
      for (const row of gallery) {
        const mediaUrl = resolveMediaUrl(row.image, baseUrl)
        if (!mediaUrl) {
          skipped.push({
            sourceType: 'product',
            sourceId: productId,
            label,
            reason: 'Et galleribilde mangler en offentlig https-URL.',
          })
          continue
        }

        const normalized = normalizeUrlForComparison(mediaUrl)
        if (seenInGallery.has(normalized)) {
          skipped.push({
            sourceType: 'product',
            sourceId: productId,
            label,
            reason: 'Samme bilde ligger flere ganger i galleriet.',
          })
          continue
        }
        seenInGallery.add(normalized)

        if (claimedByVariant.has(normalized)) {
          skipped.push({
            sourceType: 'product',
            sourceId: productId,
            label,
            reason: 'Eksporteres som variant-pin i stedet.',
          })
          continue
        }

        productRows.push({
          sourceType: 'product',
          sourceId: productImageSourceId(productId, row.image, mediaUrl),
          title,
          description,
          mediaUrl,
          destinationUrl,
          keywords: '',
        })
      }
    }
  }

  // ── Homepage (curated) ──────────────────────────────────────────────────────────────────
  if (sources.homepage) {
    for (const entry of homepage) {
      const sourceId = entry.id
      const label = entry.title || entry.id

      const mediaUrl = /^https?:\/\//i.test(entry.imageUrl)
        ? entry.imageUrl
        : canonicalUrl(entry.imageUrl, baseUrl)
      if (!isPublicHttpsUrl(mediaUrl)) {
        skipped.push({
          sourceType: 'homepage',
          sourceId,
          label,
          reason: 'Bilde-URL-en er ikke en offentlig https-URL.',
        })
        continue
      }

      const destinationUrl = canonicalUrl(entry.destinationPath, baseUrl)
      if (!isCanonicalDestination(destinationUrl, baseUrl)) {
        skipped.push({
          sourceType: 'homepage',
          sourceId,
          label,
          reason: 'Mål-URL-en er ikke på aBoks-domenet.',
        })
        continue
      }

      const title = normalizeText(entry.title, TITLE_MAX)
      if (!title) {
        skipped.push({ sourceType: 'homepage', sourceId, label, reason: 'Mangler tittel.' })
        continue
      }

      homepageRows.push({
        sourceType: 'homepage',
        sourceId,
        title,
        description: normalizeText(entry.description, DESCRIPTION_MAX),
        mediaUrl,
        destinationUrl,
        keywords: normalizeText(entry.keywords, KEYWORDS_MAX),
      })
    }
  }

  // ── Centralized deduplication on the normalized (image, destination) pair ───────────────
  // One pass over products → variants → homepage. On a collision `preferItem` picks the
  // winner and the loser is reported as a skip, so nothing disappears silently. The winner
  // keeps the loser's slot, which preserves gallery order in the preview.
  const collected = [...productRows, ...variantRows, ...homepageRows]
  const slotByKey = new Map<string, number>()
  const unique: (PinterestExportItem | null)[] = []

  for (const item of collected) {
    const key = pairKey(item)
    const slot = slotByKey.get(key)
    if (slot === undefined) {
      slotByKey.set(key, unique.length)
      unique.push(item)
      continue
    }

    const existing = unique[slot]!
    const winner = preferItem(existing, item)
    const loser = winner === existing ? item : existing
    unique[slot] = winner
    skipped.push({
      sourceType: loser.sourceType,
      sourceId: loser.sourceId,
      label: loser.title,
      reason: 'Duplikat — samme bilde og samme mål-URL.',
    })
  }

  const deduped = unique.filter((i): i is PinterestExportItem => i !== null)

  // ── Pinterest's 200-row ceiling ─────────────────────────────────────────────────────────
  const items = deduped.slice(0, limit)
  const omitted = deduped.length - items.length

  return {
    items,
    counts: {
      products: items.filter((i) => i.sourceType === 'product').length,
      variants: items.filter((i) => i.sourceType === 'variant').length,
      homepage: items.filter((i) => i.sourceType === 'homepage').length,
      total: items.length,
    },
    skipped,
    omitted,
    baseUrl,
    baseUrlFallback: options.baseUrlFallback ?? false,
  }
}
