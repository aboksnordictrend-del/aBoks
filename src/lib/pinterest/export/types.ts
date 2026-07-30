// Shared shapes for the Pinterest bulk-upload export.
//
// Everything the preview, the validation layer and the CSV writer touch is normalized into
// `PinterestExportItem` first, so a product, a colour variant and a curated homepage image
// are indistinguishable downstream. Adding a fourth source means producing more items — no
// change to the CSV writer, the preview table or the endpoint.

/** Which part of the site an item was derived from. */
export type PinterestSourceType = 'product' | 'variant' | 'homepage'

/** The three source toggles on the export page. */
export interface PinterestSourceSelection {
  products: boolean
  variants: boolean
  homepage: boolean
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
}
