/**
 * The documents every product block on /bedrifter offers, resolved to files that already
 * exist in the Vercel Blob `Bedrifter` folder. Nothing here uploads, renames or rewrites a
 * file — the filenames below were read from the folder listing, not guessed.
 *
 * Shared by the page and by the Tilbudsmal HTML route, so the route's allowlist and the
 * links on the page can never drift apart.
 */

/** The public Blob host the page's hero and product photos are already served from. */
const BLOB_BASE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'
const BEDRIFTER_FOLDER = `${BLOB_BASE}/Bedrifter`

export type DocumentFileType = 'PDF' | 'HTML'

export interface DocumentFile {
  type: DocumentFileType
  url: string
  /** `download` saves the file; `open` opens it in a new tab. */
  action: 'download' | 'open'
}

/** Where a row points when it asks for something instead of handing over a file. */
export interface DocumentAnchor {
  /** `id` of the element on the same page the row scrolls to. */
  id: string
  /** The call to action shown where a file row shows its format ("PDF"). */
  label: string
}

/**
 * One row in the "Dokumenter" list. A row either offers the document as files — possibly
 * in several formats — or, with `anchor` and no files, sends the visitor somewhere on the
 * page to ask for it.
 */
export interface ProductDocument {
  label: string
  files: DocumentFile[]
  anchor?: DocumentAnchor
}

/**
 * Keys are the product slugs — the four catalogue models match the slugs `page.tsx` reads
 * from Payload, so their documents resolve without a second lookup table.
 */
export type BedrifterProductKey =
  | 'aboks-special'
  | 'aboks-office'
  | 'aboks-xl'
  | 'aboks-vegg'
  | 'aboks'
  | 'aboks-mini'
  | 'aboks-nano'

interface ProductFiles {
  produktark: string
  /** Absent for a model that has no price sheet in Blob yet — the row asks for a tilbud
   *  either way, so nothing on the page depends on it. */
  prisliste?: string
  tilbudsmalPdf: string
  tilbudsmalHtml: string
}

/**
 * Exact filenames in the Blob `Bedrifter` folder. Four product sheets do not follow the
 * `<Produkt>-<Dokument>.pdf` pattern: Office is stored as `…-produktark-v2.pdf`, XL and
 * Spesial as `…-produktark-v3.pdf`, and the plain aBoks sheet as `aBoks-produktark_3.pdf`.
 * The Spesial file is the one in this table spelled "Spesial" rather than "Special". All of
 * them are spelled out here rather than derived.
 */
const FILES: Record<BedrifterProductKey, ProductFiles> = {
  'aboks-special': {
    produktark: 'aBoks-Spesial-produktark-v3.pdf',
    prisliste: 'aBoks-Special-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Special-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Special-Tilbudsmal.html',
  },
  'aboks-office': {
    produktark: 'aBoks-Office-produktark-v2.pdf',
    prisliste: 'aBoks-Office-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Office-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Office-Tilbudsmal.html',
  },
  // No `prisliste` — aBoks XL has no price sheet in Blob yet.
  'aboks-xl': {
    produktark: 'aBoks-XL-produktark-v3.pdf',
    tilbudsmalPdf: 'aBoks-XL-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-XL-Tilbudsmal.html',
  },
  'aboks-vegg': {
    produktark: 'aBoks-Vegg-Produktark.pdf',
    prisliste: 'aBoks-Vegg-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Vegg-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Vegg-Tilbudsmal.html',
  },
  aboks: {
    produktark: 'aBoks-produktark_3.pdf',
    prisliste: 'aBoks-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Tilbudsmal.html',
  },
  'aboks-mini': {
    produktark: 'aBoks-Mini-Produktark.pdf',
    prisliste: 'aBoks-Mini-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Mini-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Mini-Tilbudsmal.html',
  },
  'aboks-nano': {
    produktark: 'aBoks-Nano-Produktark.pdf',
    prisliste: 'aBoks-Nano-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Nano-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Nano-Tilbudsmal.html',
  },
}

export function isBedrifterProductKey(value: string): value is BedrifterProductKey {
  return Object.prototype.hasOwnProperty.call(FILES, value)
}

/**
 * CMS slugs whose documents live under a differently spelled key. The files in Blob — and
 * the `/dokumenter/tilbudsmal/…` route that serves them — spell the model "Special", while
 * the product in Payload is `aboks-spesial`. Aliasing keeps both spellings working without
 * renaming a file or changing a URL.
 */
const SLUG_ALIASES: Record<string, BedrifterProductKey> = {
  'aboks-spesial': 'aboks-special',
}

/** The document key a product slug resolves to, or `null` when it has no files in Blob. */
export function bedrifterProductKey(slug: string): BedrifterProductKey | null {
  if (isBedrifterProductKey(slug)) return slug
  return SLUG_ALIASES[slug] ?? null
}

/** Blob URL of a product's fillable Tilbudsmal HTML. Only the inline route reads this. */
export function tilbudsmalHtmlBlobUrl(key: BedrifterProductKey): string {
  return `${BEDRIFTER_FOLDER}/${FILES[key].tilbudsmalHtml}`
}

/**
 * Where the HTML link points. Blob serves every `.html` with
 * `content-disposition: attachment` and offers no way to override it, so linking the Blob
 * URL straight would download the template instead of opening it. This route hands the
 * same bytes back inline.
 */
export function tilbudsmalHtmlUrl(key: BedrifterProductKey): string {
  return `/dokumenter/tilbudsmal/${key}`
}

/** `?download=1` is Blob's own force-download flag — without it PDFs are served inline. */
function pdf(filename: string): DocumentFile {
  return { type: 'PDF', url: `${BEDRIFTER_FOLDER}/${filename}?download=1`, action: 'download' }
}

/**
 * The document rows for one product, in the order they render on /bedrifter.
 *
 * No Prisliste row: prices are quoted per customer, and the price table above the
 * documents on the page already answers "hva koster den". `files.prisliste`, where a model
 * has one, still names the PDF that sits in Blob for internal use — it is not offered on
 * the page. Nothing else reads this function, so the row is gone from /bedrifter only; the
 * individual product pages build their own documents.
 */
export function bedrifterDocuments(key: BedrifterProductKey): ProductDocument[] {
  const files = FILES[key]
  return [
    { label: 'Produktark', files: [pdf(files.produktark)] },
    {
      label: 'Tilbudsmal',
      files: [pdf(files.tilbudsmalPdf), { type: 'HTML', url: tilbudsmalHtmlUrl(key), action: 'open' }],
    },
  ]
}
