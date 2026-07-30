// Shared shapes for the Pinterest bulk-upload export.
//
// Everything the preview, the validation layer and the CSV writer touch is normalized into
// `PinterestExportItem` first, so a product, a colour variant and a curated homepage image
// are indistinguishable downstream. Adding a fourth source means producing more items — no
// change to the CSV writer, the preview table or the endpoint.

/**
 * Which part of the site an item was derived from. `blob` is the curated `Pinterest/` folder
 * in Vercel Blob — supplementary imagery that belongs to no product, variant or homepage entry.
 */
export type PinterestSourceType = 'product' | 'variant' | 'homepage' | 'blob'

/** The four source toggles on the export page. */
export interface PinterestSourceSelection {
  products: boolean
  variants: boolean
  homepage: boolean
  blob: boolean
}

/**
 * One candidate Pin, fully resolved and validated.
 *
 * `mediaUrl` and `destinationUrl` are always absolute https URLs on the canonical production
 * origin — an item that could not satisfy that never becomes an item, it becomes a skip.
 */
export interface PinterestExportItem {
  sourceType: PinterestSourceType
  /**
   * Stable identity within its source type: the product id, the variant id, or the curated
   * homepage item's id. `${sourceType}:${sourceId}` is the key the endpoint uses to match an
   * edited preview row back to its server-computed URLs.
   */
  sourceId: string
  title: string
  description: string
  mediaUrl: string
  destinationUrl: string
  /** Comma-separated list, or '' — Pinterest treats the column as optional. */
  keywords: string
}

/** Why a candidate did not make it into the export. Surfaced in the preview, never silent. */
export interface PinterestExportSkip {
  sourceType: PinterestSourceType
  sourceId: string
  /** Human label for the admin — product title, variant name, homepage item id. */
  label: string
  reason: string
}

/** Per-source-type tallies shown above the preview table. */
export interface PinterestExportCounts {
  products: number
  variants: number
  homepage: number
  blob: number
  total: number
}

/** The full result of building an export: what is in, what is out, and what was cut. */
export interface PinterestExportPreview {
  items: PinterestExportItem[]
  counts: PinterestExportCounts
  skipped: PinterestExportSkip[]
  /** Rows dropped purely because of Pinterest's 200-row ceiling. */
  omitted: number
  /** The canonical origin every URL above was built on. Shown so a misconfiguration is visible. */
  baseUrl: string
  /** Set when NEXT_PUBLIC_SERVER_URL was unusable and the production fallback was applied. */
  baseUrlFallback: boolean
  /**
   * Non-fatal problems worth showing above the table — currently only a failed Blob listing.
   * A warning never stops the other sources from rendering.
   */
  warnings: string[]
  /**
   * Every destination a row is allowed to point at: `/produkter` plus one entry per published
   * product. This is the allowlist the destination picker offers and the POST re-validates
   * against, so a crafted body can never redirect a Pin off the canonical domain.
   */
  destinationOptions: PinterestDestinationOption[]
}

/** One entry in the destination allowlist. */
export interface PinterestDestinationOption {
  /** Absolute canonical URL — what actually goes in the CSV's Link column. */
  url: string
  /** Human label for the picker, e.g. "aBoks Vegg" or "Alle produkter". */
  label: string
}
