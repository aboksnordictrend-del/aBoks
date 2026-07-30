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
import { DEFAULT_PRODUCT_NAME, pickUniqueTitle, type TitleContext } from './titles'
import type {
  PinterestExportItem,
  PinterestExportPreview,
  PinterestExportSkip,
  PinterestSourceSelection,
  PinterestSourceType,
} from './types'

/**
 * A row before its final title is chosen. `ctx` is what the title generator needs to phrase
 * this row differently from every other row in the same export.
 */
interface DraftRow {
  item: PinterestExportItem
  ctx: TitleContext
  /**
   * Epoch milliseconds used only to order the export, newest first. Never reaches the CSV —
   * Pinterest has no such column — and never leaves this module on the item itself.
   * `undefined` means "no usable date", which sorts after everything dated.
   */
  sortTimestamp?: number
}

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

/** An ISO date string as epoch ms, or undefined when it is missing, blank or unparseable. */
export function parseTimestamp(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

/**
 * When the image itself was added: `media.createdAt`, falling back to `media.updatedAt`.
 *
 * Deliberately the MEDIA document's date, not the product's — a photo added to an old product
 * today is new content and belongs at the top. Returns undefined for an unresolved
 * relationship (a bare id) or a document carrying no usable timestamp.
 */
export function mediaTimestamp(media: number | Media | null | undefined): number | undefined {
  if (!media || typeof media !== 'object') return undefined
  return parseTimestamp(media.createdAt) ?? parseTimestamp(media.updatedAt)
}

/**
 * Newest image first.
 *
 * Recency is the primary key and source type is deliberately NOT part of it — a homepage image
 * added this week outranks a product photo from last year. Ties fall back to the original
 * index, which is the existing deterministic order (gallery order within a product, then
 * products → variants → homepage), so an export with no dates at all is byte-identical to
 * what it was before. Undated rows sort after every dated row.
 */
function sortByRecency(drafts: readonly DraftRow[]): DraftRow[] {
  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort((a, b) => {
      const at = a.draft.sortTimestamp
      const bt = b.draft.sortTimestamp
      if (at !== undefined && bt !== undefined) {
        if (at !== bt) return bt - at
      } else if (at !== undefined) {
        return -1
      } else if (bt !== undefined) {
        return 1
      }
      return a.index - b.index
    })
    .map((entry) => entry.draft)
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

/**
 * The dedup key: the normalized image URL, and nothing else.
 *
 * One physical image may only ever produce one Pin. The destination, the source type, the
 * sourceId, the title and the description are all deliberately excluded — the same photograph
 * pinned twice under two badges is exactly the duplicate Pinterest penalizes.
 */
function imageKey(item: PinterestExportItem): string {
  return normalizeUrlForComparison(item.mediaUrl)
}

/** Lower rank wins. Variant → Product → Homepage. */
const SOURCE_RANK: Record<PinterestSourceType, number> = {
  variant: 0,
  product: 1,
  homepage: 2,
}

/** Norwegian noun for the winning source, used in the "Hoppet over" reason. */
const SOURCE_NOUN: Record<PinterestSourceType, string> = {
  variant: 'variant-pin',
  product: 'produkt-pin',
  homepage: 'forside-pin',
}

/**
 * Which of two rows that resolved to the same image survives. Deterministic and independent of
 * array order:
 *   • variant first — it carries the colour name, the colour keyword and a link that
 *     preselects that colour, so it is strictly the most specific row for that photograph;
 *   • product next — the catalogue is the canonical source and stays in sync with Payload;
 *   • homepage last — a curated entry only survives when the image appears nowhere else;
 *   • equal rank: the first occurrence wins, which preserves gallery order.
 */
export function preferItem(
  existing: PinterestExportItem,
  candidate: PinterestExportItem,
): PinterestExportItem {
  return SOURCE_RANK[candidate.sourceType] < SOURCE_RANK[existing.sourceType] ? candidate : existing
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

  const productRows: DraftRow[] = []
  const variantRows: DraftRow[] = []
  const homepageRows: DraftRow[] = []
  const skipped: PinterestExportSkip[] = []
  /** variant row sourceId → the id of the product it belongs to. */
  const variantOwnerByRowId = new Map<string, string>()

  const publishedById = new Map<string, Product>()
  for (const product of input.products) {
    if (product.published) publishedById.set(String(product.id), product)
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
      // A variant sharing a photograph with its parent gallery — including the main image —
      // is NOT skipped here. Image identity is settled once, centrally, by the dedup pass
      // below, where the variant outranks the product row for exactly this reason.
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
        item: {
          sourceType: 'variant',
          sourceId,
          title,
          description: productDescription(product),
          mediaUrl,
          destinationUrl: canonicalUrl(path, baseUrl),
          keywords: normalizeText(variant.name, KEYWORDS_MAX),
        },
        ctx: {
          base: title,
          productName: product.title || DEFAULT_PRODUCT_NAME,
          colour: variant.name,
        },
        sortTimestamp: mediaTimestamp(variant.image),
      })
    }
  }

  // Normalized image URLs already represented by an exported variant row, per product. A
  // gallery image in this set is skipped: the variant row is the same photograph with a more
  // specific title, the colour as a keyword and the colour preselected on the product page.
  const variantMediaByProduct = new Map<string, Set<string>>()
  for (const { item } of variantRows) {
    const owner = variantOwnerByRowId.get(item.sourceId)
    if (!owner) continue
    const set = variantMediaByProduct.get(owner) ?? new Set<string>()
    set.add(normalizeUrlForComparison(item.mediaUrl))
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
          item: {
            sourceType: 'product',
            sourceId: productImageSourceId(productId, row.image, mediaUrl),
            title,
            description,
            mediaUrl,
            destinationUrl,
            keywords: '',
          },
          // Every gallery image of a product shares this context; the generator is what makes
          // their final titles differ.
          ctx: { base: title, productName: product.title || DEFAULT_PRODUCT_NAME },
          // The image's own date, so a photo added today to an old product sorts to the top.
          sortTimestamp: mediaTimestamp(row.image),
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
        item: {
          sourceType: 'homepage',
          sourceId,
          title,
          description: normalizeText(entry.description, DESCRIPTION_MAX),
          mediaUrl,
          destinationUrl,
          keywords: normalizeText(entry.keywords, KEYWORDS_MAX),
        },
        ctx: { base: title, productName: DEFAULT_PRODUCT_NAME },
        // Optional curated date; without one the entry keeps its configured order, below
        // everything that does have a date.
        sortTimestamp: parseTimestamp(entry.createdAt),
      })
    }
  }

  // ── Centralized deduplication on the image alone ────────────────────────────────────────
  // One pass over products → variants → homepage, keyed only on the normalized image URL. On
  // a collision `preferItem` picks the winner by source rank and the loser is reported as a
  // skip, so nothing disappears silently. The winner keeps the loser's slot, which preserves
  // gallery order in the preview.
  const collected = [...productRows, ...variantRows, ...homepageRows]
  const slotByKey = new Map<string, number>()
  const unique: DraftRow[] = []

  for (const draft of collected) {
    const key = imageKey(draft.item)
    const slot = slotByKey.get(key)
    if (slot === undefined) {
      slotByKey.set(key, unique.length)
      unique.push(draft)
      continue
    }

    const existing = unique[slot]
    const winnerItem = preferItem(existing.item, draft.item)
    const loser = winnerItem === existing.item ? draft : existing
    unique[slot] = winnerItem === existing.item ? existing : draft
    skipped.push({
      sourceType: loser.item.sourceType,
      sourceId: loser.item.sourceId,
      label: loser.item.title,
      reason: `Duplikat — samme bilde eksporteres allerede som ${SOURCE_NOUN[unique[slot].item.sourceType]}.`,
    })
  }

  // ── Newest images first ─────────────────────────────────────────────────────────────────
  // After dedup (so a duplicate can never displace the row that actually survived) and before
  // the row cap (so the cap keeps the NEWEST 200, not the first 200 encountered).
  const ordered = sortByRecency(unique)

  // ── Pinterest's 200-row ceiling ─────────────────────────────────────────────────────────
  const capped = ordered.slice(0, limit)
  const omitted = ordered.length - capped.length

  // ── Unique titles ───────────────────────────────────────────────────────────────────────
  // Applied last, so no phrasing is spent on a row that dedup or the row cap removed.
  // Pinterest rejects a file containing the same Title twice, and `used` is shared across
  // every row, so uniqueness holds across products and sources — not just within a gallery.
  const usedTitles = new Set<string>()
  const items = capped.map(({ item, ctx }) => ({ ...item, title: pickUniqueTitle(ctx, usedTitles) }))

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
