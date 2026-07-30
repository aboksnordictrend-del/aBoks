// Turning a `Pinterest/` Blob filename into Pin copy.
//
// Everything here is deterministic and derived from the PATHNAME only. Nothing inspects the
// image: there is no vision model in this project, and inventing visual claims would put
// unverifiable statements on a public Pin. The filename is the administrator's own label, so
// it is the most reliable signal available.
//
// Pure — no I/O, no env, no Payload. All of it is unit-testable in isolation.

/** The one approved folder. Case-sensitive: Blob pathnames are case-sensitive. */
export const PINTEREST_BLOB_PREFIX = 'Pinterest/'

/**
 * Extensions Pinterest bulk upload is documented to take, restricted further to what aBoks
 * actually publishes. GIF, AVIF and SVG are deliberately absent: SVG is not a raster format
 * Pinterest fetches, and GIF/AVIF compatibility has not been verified against a real upload.
 */
export const SUPPORTED_BLOB_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const

/** Tokens that describe the file, not its subject. Dropped from the generated title. */
const TECHNICAL_TOKENS = new Set([
  'final',
  'copy',
  'kopi',
  'compressed',
  'optimized',
  'optimised',
  'web',
  'pinterest',
  'pin',
  'export',
])

/**
 * Whole-token transliterations. Applied per token, never as a substring replace — a blind
 * `aa → å` would turn "aaa" into "å" and mangle any word containing the pair. Everything here
 * is an unambiguous Norwegian word that appears in aBoks filenames.
 */
const TRANSLITERATIONS: Record<string, string> = {
  pa: 'på',
  bla: 'blå',
  mork: 'mørk',
  moerk: 'mørk',
  gronn: 'grønn',
  groenn: 'grønn',
  olivengronn: 'olivengrønn',
  olivengroenn: 'olivengrønn',
  kjokken: 'kjøkken',
  kjokkenet: 'kjøkkenet',
  kjoekken: 'kjøkken',
  kjokkenoppbevaring: 'kjøkkenoppbevaring',
  soverom: 'soverom',
  soverommet: 'soverommet',
  baerekraft: 'bærekraft',
  baerekraftig: 'bærekraftig',
  tradlos: 'trådløs',
  traadlos: 'trådløs',
  hoy: 'høy',
  smabarn: 'småbarn',
  apen: 'åpen',
  ar: 'år',
}

/** Tokens whose capitalization is fixed. The brand spelling must survive sentence-casing. */
const FIXED_CASE: Record<string, string> = {
  aboks: 'aBoks',
  aa: 'AA',
  aaa: 'AAA',
}

/** Words that name a product line when they directly follow the brand. */
const PRODUCT_LINE_WORDS = new Set(['mini', 'nano', 'vegg'])

/** `Pinterest/interior/aBoks-i-stua.webp` → `aBoks-i-stua.webp`. */
export function basename(pathname: string): string {
  const cut = pathname.lastIndexOf('/')
  return cut === -1 ? pathname : pathname.slice(cut + 1)
}

/** Lowercased extension including the dot, or '' when there is none. */
export function extensionOf(pathname: string): string {
  const name = basename(pathname)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/** True for a raster image Pinterest can fetch. Case-insensitive on the extension. */
export function isSupportedBlobImage(pathname: string): boolean {
  return (SUPPORTED_BLOB_EXTENSIONS as readonly string[]).includes(extensionOf(pathname))
}

/** True for dotfiles, system junk and editor leftovers, at any depth. */
export function isHiddenOrSystemFile(pathname: string): boolean {
  const name = basename(pathname)
  if (!name || name.startsWith('.') || name.startsWith('~') || name.endsWith('~')) return true
  return name === 'Thumbs.db' || name === 'desktop.ini'
}

/** Split on the separators used in filenames, dropping empties from repeated separators. */
function tokenize(name: string): string[] {
  return name
    .replace(/[_\-+.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/**
 * Drop tokens that describe the file rather than its subject: `800x800`, `1200x1500`,
 * zero-padded counters (`01`), a trailing short sequence number, and the technical vocabulary
 * above. A number is only removed when it is clearly a marker — `2026` or `20` in the middle
 * of a phrase is meaningful content and stays.
 */
function stripTechnicalTokens(tokens: string[]): string[] {
  const kept = tokens.filter((token, index) => {
    const lower = token.toLowerCase()
    if (/^\d+x\d+$/.test(lower)) return false // dimensions
    if (/^0\d$/.test(lower)) return false // 01, 02 … zero-padded counter
    if (TECHNICAL_TOKENS.has(lower)) return false
    // A bare 1–2 digit number in the LAST position is a sequence marker, but only when
    // enough real words remain for the title to still say something.
    if (index === tokens.length - 1 && /^\d{1,2}$/.test(lower) && tokens.length >= 3) return false
    return true
  })
  // Never strip a name down to nothing.
  return kept.length > 0 ? kept : tokens
}

/** Apply the whole-token transliteration table, preserving any character already correct. */
function transliterate(tokens: string[]): string[] {
  return tokens.map((token) => {
    const lower = token.toLowerCase()
    return TRANSLITERATIONS[lower] ?? token
  })
}

/**
 * A clean Norwegian title from a Blob pathname.
 *
 * Only the basename is used — folder names are organizational, not editorial. Truncation and
 * formula-guarding happen later in the shared pipeline, so this returns the natural phrase.
 */
export function titleFromPathname(pathname: string): string {
  const name = basename(pathname)
  const withoutExtension = name.slice(0, name.length - extensionOf(name).length) || name
  const tokens = transliterate(stripTechnicalTokens(tokenize(withoutExtension)))
  if (tokens.length === 0) return ''

  const words = tokens.map((token) => {
    const fixed = FIXED_CASE[token.toLowerCase()]
    return fixed ?? token.toLowerCase()
  })

  // "aBoks vegg" is the product line aBoks Vegg, not a wall. Only the word immediately after
  // the brand is promoted, so "batterier på veggen" keeps its ordinary lower case.
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] !== FIXED_CASE.aboks) continue
    const next = words[i + 1]
    if (PRODUCT_LINE_WORDS.has(next)) {
      words[i + 1] = next.charAt(0).toUpperCase() + next.slice(1)
    }
  }

  // Sentence case, unless the first word has a fixed spelling (aBoks, AA, AAA).
  const first = words[0]
  const firstIsFixed = Object.values(FIXED_CASE).includes(first)
  if (!firstIsFixed) words[0] = first.charAt(0).toUpperCase() + first.slice(1)

  return words.join(' ')
}

// ── Recognized vocabulary ─────────────────────────────────────────────────────────────────

/** Product line detected in a filename, most specific first. */
export type BlobProductTerm = 'aboks-mini' | 'aboks-nano' | 'aboks-vegg' | 'aboks'

export interface BlobTerms {
  /** Most specific product line mentioned, or null. */
  product: BlobProductTerm | null
  /** Norwegian colour name as it should be written, or null. */
  colour: string | null
  /** Room key, or null. */
  room: string | null
  /** The filename mentions used/spent batteries. */
  usedBatteries: boolean
  /** The filename mentions AA and/or AAA. */
  batterySizes: string[]
}

/**
 * A whole-word matcher for the space-normalized haystack.
 *
 * `\b` is ASCII-only in JavaScript, so `blå` or `kjøkken` would never match at the trailing
 * boundary. `matchable()` guarantees single-space-separated tokens padded with spaces, so
 * space lookarounds are both correct and Unicode-safe.
 */
function word(pattern: string): RegExp {
  return new RegExp(`(?<= )(?:${pattern})(?= )`)
}

const PRODUCT_TERMS: [BlobProductTerm, RegExp][] = [
  ['aboks-mini', word('aboks ?mini')],
  ['aboks-nano', word('aboks ?nano')],
  ['aboks-vegg', word('aboks ?vegg')],
  ['aboks', word('aboks')],
]

const COLOUR_TERMS: [string, RegExp][] = [
  ['olivengrønn', word('oliven ?gr(?:o|ø|oe)nn|oliven')],
  ['mørk blå', word('m(?:o|ø|oe)rk ?bl(?:a|å)')],
  ['sort', word('sort|svart')],
  ['hvit', word('hvit')],
  ['creme', word('creme|krem')],
]

/** Room key → the phrase used inside a generated sentence. */
export const ROOM_PHRASES: Record<string, string> = {
  kjøkken: 'på kjøkkenet',
  stue: 'i stua',
  soverom: 'på soverommet',
  vaskerom: 'på vaskerommet',
  gang: 'i gangen',
  hjemmekontor: 'på hjemmekontoret',
  hytte: 'på hytta',
  bod: 'i boden',
  skuff: 'i skuffen',
  skap: 'i skapet',
  vegg: 'på veggen',
  barnerom: 'på barnerommet',
}

const ROOM_TERMS: [string, RegExp][] = [
  ['kjøkken', word('kj(?:o|ø|oe)kken(?:et)?')],
  ['stue', word('stue|stua')],
  ['soverom', word('soverom(?:met)?')],
  ['vaskerom', word('vaskerom(?:met)?')],
  ['hjemmekontor', word('hjemmekontor(?:et)?')],
  ['hytte', word('hytte|hytta')],
  ['barnerom', word('barnerom(?:met)?')],
  ['bod', word('bod(?:en)?')],
  ['skuff', word('skuff(?:en)?')],
  ['skap', word('skap(?:et)?')],
  ['gang', word('gang(?:en)?')],
  ['vegg', word('vegg(?:en)?')],
]

/** Normalize a pathname for matching: basename, lowercase, separators → spaces. */
function matchable(pathname: string): string {
  return ` ${tokenize(basename(pathname).toLowerCase()).join(' ')} `
}

/** Everything the vocabulary recognizes in one filename. Deterministic and order-independent. */
export function recognizeTerms(pathname: string): BlobTerms {
  const haystack = matchable(pathname)

  const product = PRODUCT_TERMS.find(([, re]) => re.test(haystack))?.[0] ?? null
  const colour = COLOUR_TERMS.find(([, re]) => re.test(haystack))?.[0] ?? null
  // `vegg` is a product line as well as a surface; when it named the product, it is not a room.
  const roomMatch = ROOM_TERMS.find(([, re]) => re.test(haystack))?.[0] ?? null
  const room = roomMatch === 'vegg' && product === 'aboks-vegg' ? null : roomMatch

  const usedBatteries = word('brukte').test(haystack)
  const batterySizes: string[] = []
  if (word('aaa').test(haystack)) batterySizes.push('AAA')
  if (word('aa').test(haystack)) batterySizes.push('AA')

  return { product, colour, room, usedBatteries, batterySizes }
}

// ── Description ───────────────────────────────────────────────────────────────────────────

/** Display name for a recognized product line. */
export const PRODUCT_LABELS: Record<BlobProductTerm, string> = {
  'aboks-mini': 'aBoks Mini',
  'aboks-nano': 'aBoks Nano',
  'aboks-vegg': 'aBoks Vegg',
  aboks: 'aBoks',
}

/**
 * A short Norwegian description, 1–2 sentences, assembled from recognized terms only.
 *
 * Every sentence is drawn from wording already used on aboks.no. Nothing here claims fire
 * safety, certification, child safety, battery lifetime, environmental impact or performance —
 * those would be unverifiable statements about an image nobody has looked at.
 */
export function descriptionFromTerms(terms: BlobTerms): string {
  const name = terms.product ? PRODUCT_LABELS[terms.product] : 'aBoks'

  if (terms.usedBatteries) {
    return `Gi brukte batterier en fast plass frem til de leveres til gjenvinning. Praktisk og oversiktlig oppbevaring med ${name}.`
  }
  if (terms.colour) {
    return `Smart oppbevaring for AA- og AAA-batterier i en stilren ${terms.colour} variant.`
  }
  if (terms.room) {
    const phrase = ROOM_PHRASES[terms.room] ?? 'hjemme'
    return `Hold orden på batteriene ${phrase}. ${name} samler nye og brukte batterier på ett sted.`
  }
  if (terms.batterySizes.length > 0) {
    return `Egne rom for AA- og AAA-batterier, og en fast plass til de brukte. Praktisk batterioppbevaring med ${name}.`
  }
  if (terms.product) {
    return `${name} gir batteriene en fast plass i hjemmet — nye i egne rom, brukte samlet til de leveres til gjenvinning.`
  }
  return 'Et inspirerende aBoks-motiv med fokus på praktisk batterioppbevaring og bedre orden hjemme.'
}

// ── Keywords ──────────────────────────────────────────────────────────────────────────────

/** Room key → the keyword it contributes, when it has a natural one. */
const ROOM_KEYWORDS: Record<string, string> = {
  kjøkken: 'kjøkkenoppbevaring',
  vegg: 'veggoppbevaring',
  hytte: 'oppbevaring på hytta',
  soverom: 'oppbevaring på soverommet',
  hjemmekontor: 'oppbevaring på hjemmekontoret',
}

/** At most this many keywords — Pinterest ignores a long tail, and the cell stays readable. */
const MAX_KEYWORDS = 6

/**
 * A short keyword list from the recognized vocabulary, deduplicated case-insensitively and
 * joined the way the CSV writer expects (a plain comma-separated string).
 */
export function keywordsFromTerms(terms: BlobTerms): string {
  const candidates = [
    terms.product ? PRODUCT_LABELS[terms.product] : 'aBoks',
    'batterioppbevaring',
    ...terms.batterySizes.map((size) => `${size}-batterier`),
    terms.usedBatteries ? 'brukte batterier' : null,
    terms.colour,
    terms.room ? ROOM_KEYWORDS[terms.room] : null,
    'orden hjemme',
  ]

  const seen = new Set<string>()
  const kept: string[] = []
  for (const candidate of candidates) {
    if (!candidate) continue
    const folded = candidate.toLowerCase()
    if (seen.has(folded)) continue
    seen.add(folded)
    kept.push(candidate)
    if (kept.length === MAX_KEYWORDS) break
  }
  return kept.join(', ')
}
