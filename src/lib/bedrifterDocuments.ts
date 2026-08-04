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

/** One row in the "Dokumenter" list. A row may offer the same document in several formats. */
export interface ProductDocument {
  label: string
  files: DocumentFile[]
}

/**
 * Keys are the product slugs — the four catalogue models match the slugs `page.tsx` reads
 * from Payload, so their documents resolve without a second lookup table.
 */
export type BedrifterProductKey =
  | 'aboks-special'
  | 'aboks-office'
  | 'aboks-vegg'
  | 'aboks'
  | 'aboks-mini'
  | 'aboks-nano'

interface ProductFiles {
  produktark: string
  prisliste: string
  tilbudsmalPdf: string
  tilbudsmalHtml: string
}

/**
 * Exact filenames in the Blob `Bedrifter` folder. `aboks-office` is the one product whose
 * product sheet does not follow the `<Produkt>-<Dokument>.pdf` pattern — it is stored as
 * `aBoks-Office-produktark-A4.pdf`, and it is spelled out here rather than derived.
 */
const FILES: Record<BedrifterProductKey, ProductFiles> = {
  'aboks-special': {
    produktark: 'aBoks-Special-Produktark.pdf',
    prisliste: 'aBoks-Special-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Special-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Special-Tilbudsmal.html',
  },
  'aboks-office': {
    produktark: 'aBoks-Office-produktark-A4.pdf',
    prisliste: 'aBoks-Office-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Office-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Office-Tilbudsmal.html',
  },
  'aboks-vegg': {
    produktark: 'aBoks-Vegg-Produktark.pdf',
    prisliste: 'aBoks-Vegg-Prisliste.pdf',
    tilbudsmalPdf: 'aBoks-Vegg-Tilbudsmal.pdf',
    tilbudsmalHtml: 'aBoks-Vegg-Tilbudsmal.html',
  },
  aboks: {
    produktark: 'aBoks-Produktark.pdf',
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

/** The three document rows for one product, in the order they render. */
export function bedrifterDocuments(key: BedrifterProductKey): ProductDocument[] {
  const files = FILES[key]
  return [
    { label: 'Produktark', files: [pdf(files.produktark)] },
    { label: 'Prisliste', files: [pdf(files.prisliste)] },
    {
      label: 'Tilbudsmal',
      files: [pdf(files.tilbudsmalPdf), { type: 'HTML', url: tilbudsmalHtmlUrl(key), action: 'open' }],
    },
  ]
}
