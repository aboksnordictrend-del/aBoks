/**
 * Server-side validation and normalisation for a submitted review. Pure and unit-tested.
 *
 * The project has no validation library (no zod), so this is a small explicit validator
 * that returns Norwegian error messages ready to show in the form. It mirrors the limits
 * in the review-system spec §10:
 *   rating 1–5 integer · title ≤100 · text 10–3000 · name ≤80 · city ≤80 · ≤5 photos
 * plus: strip HTML, normalise whitespace, reject link-spam and empty/meaningless text.
 */

export const REVIEW_LIMITS = {
  titleMax: 100,
  textMin: 10,
  textMax: 3000,
  nameMax: 80,
  cityMax: 80,
  photosMax: 5,
  /** More than this many URLs in the body reads as link-spam. */
  maxUrls: 2,
} as const

export interface RawReviewInput {
  productId?: unknown
  rating?: unknown
  title?: unknown
  text?: unknown
  customerName?: unknown
  customerCity?: unknown
  consentToPublishName?: unknown
  consentToPublishPhotos?: unknown
  photoCount?: unknown
}

export interface CleanReviewInput {
  productId: string
  rating: number
  title?: string
  text: string
  customerName: string
  customerCity?: string
  consentToPublishName: boolean
  consentToPublishPhotos: boolean
}

export type ValidationResult =
  | { ok: true; value: CleanReviewInput }
  | { ok: false; errors: Record<string, string> }

/** Collapses runs of whitespace to single spaces and trims. */
export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

/** Collapses excessive blank lines but keeps intentional paragraph breaks. */
export function normalizeMultiline(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/** Removes any angle-bracket markup — no HTML is ever accepted in review content. */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

function countUrls(input: string): number {
  const matches = input.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|no|org|io|ru|shop|store)\b/gi)
  return matches ? matches.length : 0
}

/** True when the text is empty, or a single character/emoji repeated, or has no letters. */
function isMeaningless(text: string): boolean {
  const stripped = text.replace(/\s/g, '')
  if (stripped.length < 3) return true
  // No letters at all (only punctuation/symbols/numbers).
  if (!/\p{L}/u.test(text)) return true
  // A single character repeated (e.g. "aaaaaa", "......").
  const unique = new Set(stripped.toLowerCase()).size
  if (unique <= 1) return true
  return false
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 'on' || v === '1' || v === 1
}

export function validateReviewInput(raw: RawReviewInput): ValidationResult {
  const errors: Record<string, string> = {}

  // ── product ──
  const productId = typeof raw.productId === 'string' ? raw.productId.trim() : ''
  if (!productId) errors.productId = 'Velg hvilket produkt du vil anmelde.'

  // ── rating ──
  // Strict integer 1–5. An empty/whitespace string, null or undefined is "no rating" and is
  // rejected explicitly — we never let Number('') collapse to a valid-looking 0, and a
  // decimal or out-of-range value is rejected too.
  let ratingNum: number
  if (typeof raw.rating === 'number') {
    ratingNum = raw.rating
  } else if (typeof raw.rating === 'string' && raw.rating.trim() !== '') {
    ratingNum = Number(raw.rating)
  } else {
    ratingNum = NaN
  }
  const rating = Math.trunc(ratingNum)
  if (!Number.isFinite(ratingNum) || rating !== ratingNum || rating < 1 || rating > 5) {
    errors.rating = 'Gi en vurdering mellom 1 og 5 stjerner.'
  }

  // ── title (optional) ──
  let title: string | undefined
  if (typeof raw.title === 'string' && raw.title.trim()) {
    title = normalizeWhitespace(stripHtml(raw.title))
    if (title.length > REVIEW_LIMITS.titleMax) {
      errors.title = `Tittelen kan være maks ${REVIEW_LIMITS.titleMax} tegn.`
    }
  }

  // ── text ──
  let text = ''
  if (typeof raw.text === 'string') {
    text = normalizeMultiline(stripHtml(raw.text))
  }
  if (text.length < REVIEW_LIMITS.textMin) {
    errors.text = `Anmeldelsen må være minst ${REVIEW_LIMITS.textMin} tegn.`
  } else if (text.length > REVIEW_LIMITS.textMax) {
    errors.text = `Anmeldelsen kan være maks ${REVIEW_LIMITS.textMax} tegn.`
  } else if (isMeaningless(text)) {
    errors.text = 'Skriv noen ord om hva du synes om produktet.'
  } else if (countUrls(text) > REVIEW_LIMITS.maxUrls) {
    errors.text = 'Anmeldelsen inneholder for mange lenker.'
  }

  // ── name ──
  const customerName =
    typeof raw.customerName === 'string' ? normalizeWhitespace(stripHtml(raw.customerName)) : ''
  if (!customerName) {
    errors.customerName = 'Skriv navnet som skal vises på anmeldelsen.'
  } else if (customerName.length > REVIEW_LIMITS.nameMax) {
    errors.customerName = `Navnet kan være maks ${REVIEW_LIMITS.nameMax} tegn.`
  }

  // ── city (optional) ──
  let customerCity: string | undefined
  if (typeof raw.customerCity === 'string' && raw.customerCity.trim()) {
    customerCity = normalizeWhitespace(stripHtml(raw.customerCity))
    if (customerCity.length > REVIEW_LIMITS.cityMax) {
      errors.customerCity = `Stedsnavnet kan være maks ${REVIEW_LIMITS.cityMax} tegn.`
    }
  }

  // ── photo count ──
  const photoCount =
    typeof raw.photoCount === 'number'
      ? raw.photoCount
      : typeof raw.photoCount === 'string'
        ? Number(raw.photoCount)
        : 0
  if (Number.isFinite(photoCount) && photoCount > REVIEW_LIMITS.photosMax) {
    errors.photos = `Du kan legge ved maks ${REVIEW_LIMITS.photosMax} bilder.`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      productId,
      rating,
      title,
      text,
      customerName,
      customerCity,
      consentToPublishName: asBool(raw.consentToPublishName),
      consentToPublishPhotos: asBool(raw.consentToPublishPhotos),
    },
  }
}
