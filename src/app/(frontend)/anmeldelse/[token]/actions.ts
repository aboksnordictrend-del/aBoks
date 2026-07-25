'use server'

import { headers } from 'next/headers'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import { rateLimit, clientIpFromHeaders } from '@/lib/rateLimit'
import { verifyTurnstile } from '@/lib/turnstile'
import { validateReviewInput } from '@/lib/reviewValidation'
import { PHOTO_LIMITS } from '@/lib/reviewPhotos'
import { submitReview } from '@/lib/reviewServer'
import type { ReviewActionResult } from '@/lib/reviewSubmitResult'

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))

/**
 * Verifies the request Origin against the same allowlist Payload uses for CSRF. A missing
 * Origin (some same-origin navigations) is allowed; a present-but-untrusted Origin is not.
 */
async function originAllowed(): Promise<boolean> {
  const h = await headers()
  const origin = h.get('origin')
  if (!origin) return true
  return trustedOrigins.has(origin)
}

/**
 * Temporary, PII-free diagnostic. Never logs the token, email, review text or photos —
 * only success/failure, the failing field names, and whether a review was created.
 */
function logResult(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ scope: 'reviews-action', ...fields }))
}

/**
 * Server action behind the private review form. Runs, in order: Origin check, honeypot,
 * rate limit, optional Turnstile, input validation, then the token-gated submission.
 *
 * Contract (strict discriminated union): it returns `{ success: true, reviewId }` ONLY when
 * a review was actually created, and `{ success: false, … }` for every other outcome —
 * including the honeypot, which must NEVER report success (that was the bug: a browser
 * autofilling the hidden field made the form show the thank-you page with nothing saved).
 */
export async function submitReviewAction(formData: FormData): Promise<ReviewActionResult> {
  const token = String(formData.get('token') ?? '')

  // 1) Origin / CSRF.
  if (!(await originAllowed())) {
    logResult({ event: 'rejected', reason: 'origin', success: false })
    return { success: false, message: 'Forespørselen ble avvist (ugyldig opprinnelse).' }
  }

  // 2) Honeypot — a hidden field a real user never fills in. A hit is NOT success: we never
  // create a review, and we must not show the thank-you page (strict success contract).
  const honeypot = String(formData.get('referansekode') ?? '')
  if (honeypot.trim() !== '') {
    logResult({ event: 'rejected', reason: 'honeypot', success: false })
    return { success: false, message: 'Noe gikk galt. Prøv igjen senere.' }
  }

  // 3) Rate limit (per IP). Best-effort on Vercel — see src/lib/rateLimit.ts.
  const h = await headers()
  const ip = clientIpFromHeaders(h)
  const rl = await rateLimit({ key: `review-submit:${ip}`, limit: 8, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    logResult({ event: 'rejected', reason: 'rate-limit', success: false })
    return { success: false, message: 'For mange forsøk. Prøv igjen om en liten stund.' }
  }

  // 4) Turnstile (optional; skipped when not configured).
  const turnstileToken = formData.get('cf-turnstile-response')
  const turnstileOk = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : undefined,
    ip,
  )
  if (!turnstileOk) {
    logResult({ event: 'rejected', reason: 'turnstile', success: false })
    return { success: false, message: 'Kunne ikke bekrefte at du er et menneske. Last siden på nytt og prøv igjen.' }
  }

  // 5) Parse the product selection (composite value "productId::variantName").
  const selection = String(formData.get('product') ?? '')
  const [productId, ...variantParts] = selection.split('::')
  const chosenVariantName = variantParts.join('::') || undefined

  // 6) Validate the fields. rating is validated strictly as an integer 1–5 in
  // validateReviewInput — an empty string, "0", 0, NaN, 6 or a decimal are all rejected.
  const photoFiles = formData
    .getAll('photos')
    .filter((v): v is File => v instanceof File && v.size > 0)

  const validation = validateReviewInput({
    productId,
    rating: formData.get('rating'),
    title: formData.get('title'),
    text: formData.get('text'),
    customerName: formData.get('customerName'),
    customerCity: formData.get('customerCity'),
    consentToPublishName: formData.get('consentToPublishName'),
    consentToPublishPhotos: formData.get('consentToPublishPhotos'),
    photoCount: photoFiles.length,
  })
  if (!validation.ok) {
    // Field-level errors only — no generic banner. The form shows each message inline under
    // its field and preserves everything the user already entered.
    logResult({ event: 'validation-failed', fields: Object.keys(validation.errors), success: false })
    return { success: false, errors: validation.errors }
  }

  // 7) Read the (already count-limited) photo buffers.
  const buffers: Buffer[] = []
  for (const file of photoFiles.slice(0, PHOTO_LIMITS.maxPhotos)) {
    if (file.size > PHOTO_LIMITS.maxBytes) {
      logResult({ event: 'validation-failed', fields: ['photos'], success: false })
      return { success: false, errors: { photos: 'Hvert bilde kan være maksimalt 8 MB.' } }
    }
    buffers.push(Buffer.from(await file.arrayBuffer()))
  }

  // 8) Token-gated submission.
  const outcome = await submitReview(token, validation.value, buffers, chosenVariantName)
  if (!outcome.ok) {
    logResult({ event: 'submit', reason: outcome.reason, reviewCreated: false, success: false })
    return { success: false, message: outcome.message }
  }

  logResult({ event: 'submit', reviewCreated: true, success: true })
  return { success: true, reviewId: String(outcome.reviewId) }
}
