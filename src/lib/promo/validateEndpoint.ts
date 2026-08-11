import type { Payload } from 'payload'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import {
  rateLimit as defaultRateLimit,
  type RateLimitOptions,
  type RateLimitResult,
} from '@/lib/rateLimit'
import { priceCart, type CartLineInput, type CartPricingFailureReason } from '@/lib/cartPricing'
import { validatePromoCode } from './validate'
import type { PromoFailureReason } from './types'

/**
 * Everything behind `POST /api/promo-codes/validate`, kept out of the route file so it can be
 * unit-tested without loading the Payload config (importing `@/lib/payload` would build the
 * whole CMS and open a database connection). The route is a five-line adapter over this.
 *
 * The endpoint is strictly READ-ONLY. It queries products, variants, promo codes and usage
 * rows, and writes nothing: no order, no reservation, no usage row, no counter.
 *
 * It also does not reserve the code. A successful answer means "this code is usable right
 * now, and here is what it is worth" — nothing more. Two customers can both be told yes on a
 * one-time code's last use; the binding decision is made once, after payment, by the atomic
 * registration step. See the header of ./validate.ts.
 *
 * All money comes from `priceCart()` + `validatePromoCode()`. No pricing, shipping, eligibility
 * or discount arithmetic exists in this file or in the route.
 */

/* ------------------------------ limits ------------------------------ */

/** More lines than any real cart, small enough to bound the catalogue query. */
export const MAX_CART_LINES = 50
/** Long enough for any sane code; stops multi-kilobyte junk reaching the database. */
export const MAX_CODE_LENGTH = 64
/** RFC 5321 maximum length of an email address. */
export const MAX_EMAIL_LENGTH = 254
/** Variant and product ids are short numeric strings; this only bounds abuse. */
const MAX_LINE_ID_LENGTH = 64
/** Rejects a multi-megabyte body before JSON.parse ever sees it. */
const MAX_BODY_BYTES = 16_384

const RATE_LIMIT = { limit: 30, windowMs: 5 * 60 * 1000 }

/* ------------------------------ contract ------------------------------ */

/** Endpoint-level failures, on top of the reasons the two services already define. */
export type EndpointFailureReason =
  | 'invalid_request'
  | 'forbidden_origin'
  | 'rate_limited'
  | 'server_error'

export type PromoEndpointFailureReason =
  | EndpointFailureReason
  | CartPricingFailureReason
  | PromoFailureReason

export interface PromoEndpointSuccess {
  valid: true
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  /** Sum of the lines the code applies to, before discount. */
  eligibleSubtotal: number
  discountAmount: number
  subtotalBeforeDiscount: number
  subtotalAfterDiscount: number
  shipping: number
  totalBeforeDiscount: number
  totalAfterDiscount: number
  /**
   * The same figures as integer øre. Present so the UI can compare/display without ever
   * re-deriving money from floats — it is never required to calculate anything.
   */
  oere: {
    eligibleSubtotal: number
    discountAmount: number
    subtotalBeforeDiscount: number
    subtotalAfterDiscount: number
    shipping: number
    totalBeforeDiscount: number
    totalAfterDiscount: number
  }
}

export interface PromoEndpointFailure {
  valid: false
  reason: PromoEndpointFailureReason
  /** Norwegian, customer-facing, safe to render verbatim. */
  message: string
  /** Seconds to wait, on a rate-limit rejection only. */
  retryAfter?: number
}

export type PromoEndpointResponse = PromoEndpointSuccess | PromoEndpointFailure

export interface PromoEndpointResult {
  status: number
  body: PromoEndpointResponse
  headers?: Record<string, string>
}

/* ------------------------------ request parsing ------------------------------ */

/**
 * Explicit parser — no schema library, because the project has none and this shape is small.
 *
 * It does not sanitise the client's object; it BUILDS A NEW ONE containing only one
 * identifier (`variantId` or `productId`) and `quantity`. Anything else the client sends (`price`, `lineTotal`, `discountAmount`,
 * `total`, product names, eligibility flags…) is structurally incapable of reaching the
 * pricing or promo services — there is no code path that reads it. That is a stronger
 * guarantee than rejecting a blacklist of known-dangerous field names, so unknown keys are
 * ignored rather than treated as an error.
 *
 * `quantity` is passed through untouched: `priceCart()` is the authority on what a valid
 * quantity is, and duplicating that rule here would let the two drift apart.
 */
export interface ParsedPromoRequest {
  code: string
  items: CartLineInput[]
  email?: string
}

export type ParseResult =
  | { ok: true; value: ParsedPromoRequest }
  | { ok: false; message: string }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function parsePromoValidationRequest(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, message: 'Ugyldig forespørsel.' }

  const rawCode = body.code
  if (typeof rawCode !== 'string') return { ok: false, message: 'Skriv inn en rabattkode.' }
  if (rawCode.length > MAX_CODE_LENGTH) return { ok: false, message: 'Rabattkoden er for lang.' }
  if (rawCode.trim() === '') return { ok: false, message: 'Skriv inn en rabattkode.' }

  const rawItems = body.items
  if (!Array.isArray(rawItems)) return { ok: false, message: 'Ugyldig handlekurv.' }
  if (rawItems.length === 0) return { ok: false, message: 'Handlekurven er tom.' }
  if (rawItems.length > MAX_CART_LINES) return { ok: false, message: 'Handlekurven har for mange varelinjer.' }

  /** A usable id, or null. Rejects the wrong type, blanks and anything oversized. */
  const readId = (value: unknown): string | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const id = String(value).trim()
    if (!id || id.length > MAX_LINE_ID_LENGTH) return null
    return id
  }

  const items: CartLineInput[] = []
  for (const raw of rawItems) {
    if (!isRecord(raw)) return { ok: false, message: 'Ugyldig handlekurv.' }

    // Exactly one identifier per line: the variant when there is one, otherwise the product
    // (which is how a product with no variants at all is named). A line carrying both is
    // read as a variant line — the same precedence priceCart applies.
    const variantId = raw.variantId === undefined ? null : readId(raw.variantId)
    const productId = raw.productId === undefined ? null : readId(raw.productId)
    if (!variantId && !productId) {
      return { ok: false, message: 'Ugyldig handlekurv.' }
    }

    // Deliberately unvalidated here — priceCart() decides. Cast because the shared input type
    // promises a number; anything else falls out there as `invalid_quantity`.
    items.push({
      ...(variantId ? { variantId } : { productId: productId as string }),
      quantity: raw.quantity as number,
    })
  }

  const rawEmail = body.email
  if (rawEmail !== undefined && rawEmail !== null && typeof rawEmail !== 'string') {
    return { ok: false, message: 'Ugyldig e-postadresse.' }
  }
  if (typeof rawEmail === 'string' && rawEmail.length > MAX_EMAIL_LENGTH) {
    return { ok: false, message: 'Ugyldig e-postadresse.' }
  }

  const email = typeof rawEmail === 'string' && rawEmail.trim() !== '' ? rawEmail : undefined
  return { ok: true, value: { code: rawCode, items, ...(email ? { email } : {}) } }
}

/* ------------------------------ status mapping ------------------------------ */

/**
 * A business answer ("this code is expired") is a *successful* request with a negative
 * result, so it is 200 with `valid: false` — the UI branches on `valid` and `reason`, never
 * on the status code. Statuses are reserved for genuinely different situations:
 *
 *   400 the request itself was malformed
 *   403 the Origin is not trusted
 *   409 the cart no longer matches the catalogue (deleted/unpublished product) — the client
 *       has to fix its cart, but it did nothing wrong
 *   429 rate limited
 *   503 a lookup failed on our side; the same request may well succeed on retry
 *   500 an unexpected error (never carries any detail)
 */
const CART_FAILURE_STATUS: Record<CartPricingFailureReason, number> = {
  cart_empty: 400,
  invalid_line: 400,
  invalid_quantity: 400,
  variant_not_found: 409,
  product_not_found: 409,
  product_unavailable: 409,
  invalid_price: 409,
  // Both mean "the cart no longer matches the catalogue" — the customer must change it, but
  // the request itself was well formed, which is exactly what 409 is for here.
  variant_required: 409,
  insufficient_stock: 409,
  lookup_failed: 503,
}

/* ------------------------------ handler ------------------------------ */

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))

/**
 * A missing `Origin` is allowed, matching the existing review action: some same-origin
 * requests omit it. A present-but-untrusted origin is refused. This endpoint is read-only,
 * so the origin check is defence in depth; the rate limit is what actually bounds abuse.
 */
function defaultOriginAllowed(origin: string | null): boolean {
  if (!origin) return true
  return trustedOrigins.has(origin)
}

export interface PromoEndpointDeps {
  /** Lazy so a rejected origin or a rate-limited caller never constructs Payload. */
  getPayload: () => Promise<Payload>
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitResult>
  originAllowed?: (origin: string | null) => boolean
  /** PII-free structured log sink. Defaults to console.log. */
  log?: (line: Record<string, unknown>) => void
}

export interface PromoEndpointInput {
  origin: string | null
  ip: string
  /** Unparsed body. Parsed here so malformed JSON is a normal, testable outcome. */
  rawBody: string
}

function failure(
  status: number,
  reason: PromoEndpointFailureReason,
  message: string,
  extra?: Partial<PromoEndpointFailure>,
): PromoEndpointResult {
  return { status, body: { valid: false, reason, message, ...extra } }
}

export async function handlePromoValidation(
  deps: PromoEndpointDeps,
  input: PromoEndpointInput,
): Promise<PromoEndpointResult> {
  const startedAt = Date.now()
  const limiter = deps.rateLimit ?? defaultRateLimit
  const originAllowed = deps.originAllowed ?? defaultOriginAllowed
  const log =
    deps.log ?? ((line: Record<string, unknown>) => console.log(JSON.stringify(line)))

  /** Never logs the code, the email or any cart contents — only shape and outcome. */
  const finish = (result: PromoEndpointResult, extra: Record<string, unknown> = {}) => {
    log({
      scope: 'promo-validate',
      status: result.status,
      valid: result.body.valid,
      ...(result.body.valid ? {} : { reason: result.body.reason }),
      durationMs: Date.now() - startedAt,
      ...extra,
    })
    return result
  }

  // 1) Origin / CSRF.
  if (!originAllowed(input.origin)) {
    return finish(failure(403, 'forbidden_origin', 'Forespørselen ble avvist.'))
  }

  // 2) Rate limit (per IP). Best-effort on Vercel — see src/lib/rateLimit.ts.
  const rl = await limiter({
    key: `promo-validate:${input.ip}`,
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  })
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil(rl.resetMs / 1000))
    const result = failure(
      429,
      'rate_limited',
      'For mange forsøk. Prøv igjen om en liten stund.',
      { retryAfter },
    )
    result.headers = { 'Retry-After': String(retryAfter) }
    return finish(result)
  }

  // 3) Body — size, JSON, then shape.
  if (input.rawBody.length > MAX_BODY_BYTES) {
    return finish(failure(400, 'invalid_request', 'Ugyldig forespørsel.'))
  }

  let json: unknown
  try {
    json = JSON.parse(input.rawBody)
  } catch {
    return finish(failure(400, 'invalid_request', 'Ugyldig forespørsel.'))
  }

  const parsed = parsePromoValidationRequest(json)
  if (!parsed.ok) {
    return finish(failure(400, 'invalid_request', parsed.message))
  }

  // 4) Trusted pricing, then validation. Both may only read.
  try {
    const payload = await deps.getPayload()

    const priced = await priceCart(payload, parsed.value.items)
    if (!priced.ok) {
      return finish(
        failure(CART_FAILURE_STATUS[priced.reason], priced.reason, priced.message),
        { lineCount: parsed.value.items.length },
      )
    }

    const result = await validatePromoCode(payload, {
      code: parsed.value.code,
      cart: priced.cart,
      email: parsed.value.email,
    })

    if (!result.valid) {
      // A failed lookup is transient and worth retrying; every other reason is a real,
      // final answer about the code and is a perfectly successful request.
      const status = result.reason === 'lookup_failed' ? 503 : 200
      return finish(failure(status, result.reason, result.message), {
        lineCount: parsed.value.items.length,
        hasEmail: Boolean(parsed.value.email),
      })
    }

    // Only display-safe fields. No promo-code id, no usage data, no product restrictions,
    // no internal note, no per-line split — the UI needs none of them, and the server
    // recalculates everything from the code string at checkout anyway.
    const body: PromoEndpointSuccess = {
      valid: true,
      code: result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      eligibleSubtotal: result.eligibleSubtotal,
      discountAmount: result.discountAmount,
      subtotalBeforeDiscount: result.subtotalBeforeDiscount,
      subtotalAfterDiscount: result.subtotalAfterDiscount,
      shipping: result.shipping,
      totalBeforeDiscount: result.totalBeforeDiscount,
      totalAfterDiscount: result.totalAfterDiscount,
      oere: {
        eligibleSubtotal: result.eligibleSubtotalOere,
        discountAmount: result.discountAmountOere,
        subtotalBeforeDiscount: result.subtotalBeforeDiscountOere,
        subtotalAfterDiscount: result.subtotalAfterDiscountOere,
        shipping: result.shippingOere,
        totalBeforeDiscount: result.totalBeforeDiscountOere,
        totalAfterDiscount: result.totalAfterDiscountOere,
      },
    }

    return finish({ status: 200, body }, {
      lineCount: parsed.value.items.length,
      hasEmail: Boolean(parsed.value.email),
    })
  } catch (err) {
    // Nothing from the exception reaches the client — no message, no stack, no SQL.
    log({
      scope: 'promo-validate',
      status: 500,
      error: err instanceof Error ? err.message : 'unknown',
      durationMs: Date.now() - startedAt,
    })
    return {
      status: 500,
      body: {
        valid: false,
        reason: 'server_error',
        message: 'Noe gikk galt. Prøv igjen om litt.',
      },
    }
  }
}
