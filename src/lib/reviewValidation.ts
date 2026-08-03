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

/**
 * Transport budget for the photo upload, shared by the browser and the Server Action.
 *
 * Vercel rejects any request body over ~4.5 MB with 413 FUNCTION_PAYLOAD_TOO_LARGE at the
 * proxy, *before* the function boots — so no amount of server-side processing can rescue a
 * raw camera roll. These numbers are what the browser compresses down to, and what both
 * layers then verify. `totalBytes` leaves ~1 MB of headroom under the platform limit for
 * multipart boundaries, the Server Action id, the review text and the Turnstile token.
 *
 * Lives here (not in @/lib/reviewPhotos) because that module imports sharp and can never be
 * pulled into a client bundle. This file is pure and isomorphic.
 */
export const UPLOAD_LIMITS = {
  /** Longest side, in px, of the first compression attempt. Never upscales. */
  maxDimension: 1600,
  /** Canvas encoder quality, 0–1, of the first attempt. */
  quality: 0.8,
  /** Second (and last) attempt, used only when attempt one is still over perPhotoBytes. */
  retryMaxDimension: 1280,
  retryQuality: 0.7,
  /** Per-photo ceiling after optimisation. */
  perPhotoBytes: 1.5 * 1024 * 1024,
  /** Combined ceiling for all photos in one submission. */
  totalBytes: 3.5 * 1024 * 1024,
} as const

/**
 * Norwegian messages for a rejected photo set. Exported so the form, the Server Action and
 * the tests all assert against one spelling.
 */
export const PHOTO_UPLOAD_MESSAGES = {
  tooMany: `Du kan laste opp maksimalt ${REVIEW_LIMITS.photosMax} bilder.`,
  perPhotoTooLarge: 'Ett av bildene er for stort selv etter komprimering. Velg et annet bilde.',
  totalTooLarge: 'Bildene er for store selv etter komprimering. Fjern ett eller flere bilder.',
} as const

export type PhotoUploadCheck = { ok: true; totalBytes: number } | { ok: false; message: string }

/**
 * Validates an *already optimised* photo set by byte size only. Pure, so the browser runs it
 * before building the FormData and the Server Action runs it again on what actually arrived.
 * Checked in the order the user can act on: drop a photo, swap a photo, drop a photo.
 */
export function validatePhotoUpload(sizes: number[]): PhotoUploadCheck {
  if (sizes.length > REVIEW_LIMITS.photosMax) {
    return { ok: false, message: PHOTO_UPLOAD_MESSAGES.tooMany }
  }
  if (sizes.some((bytes) => bytes > UPLOAD_LIMITS.perPhotoBytes)) {
    return { ok: false, message: PHOTO_UPLOAD_MESSAGES.perPhotoTooLarge }
  }
  const totalBytes = sizes.reduce((sum, bytes) => sum + bytes, 0)
  if (totalBytes > UPLOAD_LIMITS.totalBytes) {
    return { ok: false, message: PHOTO_UPLOAD_MESSAGES.totalTooLarge }
  }
  return { ok: true, totalBytes }
}

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
