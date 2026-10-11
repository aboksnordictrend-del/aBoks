/**
 * The PDF guide that belongs to each aBoks model — one table, read by both the product
 * pages (`produkter/[slug]/ProductClient`) and the product cards on /bedrifter (through
 * `bedrifterDocuments`), so a model can never be offered two different files or be given
 * the wrong kind of guide on one page and the right one on the other.
 *
 * Two kinds exist, and which one a model has is a fact about the product, not a style
 * choice: the boxes that sit on a desk or shelf ship with a *bruksveiledning*, the ones
 * that are mounted on a wall with a *monteringsveiledning*.
 *
 * Colours are variants of one product in Payload, served by the same `/produkter/<slug>`
 * page (`?variant=<sku>`), so keying by slug already covers every colour of a model.
 */

/** The public Blob host the rest of the site's documents are served from. */
const BLOB_BASE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'

export type ProductGuideKind = 'bruksveiledning' | 'monteringsveiledning'

export interface ProductGuide {
  kind: ProductGuideKind
  /** Public Blob URL of the PDF. Opened in a new tab; nothing forces a download. */
  url: string
  /** Product page link text — "Last ned bruksveiledning". */
  downloadLabel: string
  /** Document-row label in a /bedrifter card — "Bruksveiledning". */
  cardLabel: string
}

/** Model keys are the product slugs in Payload. */
type ProductGuideKey =
  | 'aboks'
  | 'aboks-mini'
  | 'aboks-nano'
  | 'aboks-office'
  | 'aboks-spesial'
  | 'aboks-vegg'
  | 'aboks-xl'

/**
 * Exact filenames as they are stored in Blob. Spelled out rather than derived from the
 * slug: the files use the product's display spelling ("aBoks Spesial" → `aBoks-Spesial-…`)
 * and nothing guarantees a future model follows the pattern.
 */
const GUIDE_FILES: Record<ProductGuideKey, { kind: ProductGuideKind; filename: string }> = {
  aboks: { kind: 'bruksveiledning', filename: 'aBoks-Bruksveiledning.pdf' },
  'aboks-mini': { kind: 'bruksveiledning', filename: 'aBoks-Mini-Bruksveiledning.pdf' },
  'aboks-nano': { kind: 'bruksveiledning', filename: 'aBoks-Nano-Bruksveiledning.pdf' },
  'aboks-office': { kind: 'bruksveiledning', filename: 'aBoks-Office-Bruksveiledning.pdf' },
  'aboks-spesial': { kind: 'monteringsveiledning', filename: 'aBoks-Spesial-Monteringsveiledning.pdf' },
  'aboks-vegg': { kind: 'monteringsveiledning', filename: 'aBoks-Vegg-Monteringsveiledning.pdf' },
  'aboks-xl': { kind: 'monteringsveiledning', filename: 'aBoks-XL-Monteringsveiledning.pdf' },
}

/**
 * Spellings that resolve to a model above. `aboks-special` is the key the Blob `Bedrifter`
 * folder and the `/dokumenter/tilbudsmal/…` route use for aBoks Spesial — see
 * `bedrifterDocuments` — so both spellings find the same guide.
 */
const KEY_ALIASES: Record<string, ProductGuideKey> = {
  'aboks-special': 'aboks-spesial',
}

const CARD_LABELS: Record<ProductGuideKind, string> = {
  bruksveiledning: 'Bruksveiledning',
  monteringsveiledning: 'Monteringsveiledning',
}

function resolveKey(slug: string): ProductGuideKey | null {
  const normalised = slug.trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(GUIDE_FILES, normalised)) {
    return normalised as ProductGuideKey
  }
  return KEY_ALIASES[normalised] ?? null
}

/**
 * The guide for a product slug, or `null` for anything without one — accessories, and any
 * model whose PDF is not in Blob yet. Callers render nothing in that case rather than
 * linking a file that would 404.
 */
export function productGuide(slug: string): ProductGuide | null {
  const key = resolveKey(slug)
  if (!key) return null
  const { kind, filename } = GUIDE_FILES[key]
  return {
    kind,
    url: `${BLOB_BASE}/${filename}`,
    downloadLabel: `Last ned ${kind}`,
    cardLabel: CARD_LABELS[kind],
  }
}
