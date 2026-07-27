import { createHmac, timingSafeEqual } from 'crypto'
import { DISCOUNT_TYPES, normalizePromoCode, type DiscountType } from './constants'
import type { KustomOrderLine } from '@/lib/kustom'

/**
 * Promo identity carried on the Kustom order, and the strict parser that reads it back.
 *
 * ── Why this exists ──
 *
 * Discounts are sent to Kustom as `total_discount_amount` on the product lines (the Stage 6.5
 * "Option A" decision). That form carries the discount *amount* but no name, so if the local
 * pending order was never written — the pre-create is deliberately best-effort — the webhook
 * can rebuild every figure from Kustom but has no way to know *which* code was used. Without
 * that, a paid discounted order could never be attributed, and no usage could be registered.
 *
 * `merchant_data` is Kustom's own free-text field for exactly this: merchant state that
 * should survive round-tripping through the checkout.
 *
 * ── Trust ──
 *
 * Coming back from Kustom does NOT make this trustworthy. It is serialized text that left our
 * process, and it is parsed at the webhook boundary as untrusted input: strict structural
 * validation, integer-øre and sign checks, size limits, and — crucially — a cross-check that
 * every amount it claims agrees with the money Kustom actually charged. Anything that fails
 * yields a typed failure, never a thrown JSON error and never a partially-trusted object.
 *
 * Optional HMAC signing is supported on top (see `PROMO_MERCHANT_DATA_SECRET`); the
 * cross-checks stand on their own when it is not configured.
 */

/** Bumped only on a breaking shape change; an unknown version is refused outright. */
export const MERCHANT_DATA_VERSION = 1

/** Kustom's merchant_data is a text field — keep well clear of any practical limit. */
export const MAX_MERCHANT_DATA_BYTES = 4_096
const MAX_CODE_LENGTH = 64
const MAX_ID_LENGTH = 64

/** The trusted, server-derived promo figures written onto the Kustom order. */
export interface TrustedPromoSnapshot {
  code: string
  promoCodeId: string
  type: DiscountType
  value: number
  discountAmountOere: number
  subtotalBeforeDiscountOere: number
  shippingOere: number
  totalAfterDiscountOere: number
}

export interface KustomMerchantDataV1 {
  version: 1
  promo?: TrustedPromoSnapshot
}

/* ------------------------------ signing ------------------------------ */

/**
 * Optional, opt-in. Deliberately NOT `PAYLOAD_SECRET`: that key signs auth cookies, and
 * reusing an authentication secret for a second protocol is how cross-protocol attacks
 * start. Deliberately not a Kustom credential either. When unset, the parser accepts
 * unsigned payloads and relies on structural validation plus the Kustom cross-checks.
 */
function signingSecret(): string | null {
  const secret = process.env.PROMO_MERCHANT_DATA_SECRET
  return typeof secret === 'string' && secret.length >= 16 ? secret : null
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Constant-time compare; length mismatch short-circuits without leaking via timing. */
function signatureMatches(expected: string, actual: unknown): boolean {
  if (typeof actual !== 'string' || actual.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'))
  } catch {
    return false
  }
}

/* ------------------------------ building ------------------------------ */

/**
 * Serialises the promo snapshot for the Kustom order. Returns undefined when there is no
 * promo — an ordinary order sends no merchant_data at all rather than an empty envelope.
 *
 * Only values already derived and asserted server-side reach this function. No customer data
 * (deliberately including the email — once-per-customer is not supported at launch and the
 * address has no business leaving our systems), no credentials, no browser input.
 */
export function buildKustomMerchantData(promo?: TrustedPromoSnapshot | null): string | undefined {
  if (!promo) return undefined

  const payload: KustomMerchantDataV1 = {
    version: MERCHANT_DATA_VERSION,
    promo: {
      code: normalizePromoCode(promo.code),
      promoCodeId: String(promo.promoCodeId),
      type: promo.type,
      value: promo.value,
      discountAmountOere: promo.discountAmountOere,
      subtotalBeforeDiscountOere: promo.subtotalBeforeDiscountOere,
      shippingOere: promo.shippingOere,
      totalAfterDiscountOere: promo.totalAfterDiscountOere,
    },
  }

  const secret = signingSecret()
  const body = secret
    ? JSON.stringify({ payload, signature: sign(JSON.stringify(payload), secret) })
    : JSON.stringify(payload)

  // A payload this size cannot occur with one promo; refusing to send an oversized value is
  // safer than having Kustom truncate it into something unparseable.
  if (Buffer.byteLength(body, 'utf8') > MAX_MERCHANT_DATA_BYTES) return undefined
  return body
}

/* ------------------------------ parsing ------------------------------ */

export type MerchantDataFailureReason =
  | 'absent'
  | 'too_large'
  | 'malformed_json'
  | 'not_an_object'
  | 'unsupported_version'
  | 'bad_signature'
  | 'invalid_promo'

export type ParsedKustomMerchantData =
  | { ok: true; promo: TrustedPromoSnapshot | null }
  | { ok: false; reason: MerchantDataFailureReason }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Non-negative, finite, whole øre. Rejects floats, NaN, Infinity and negatives. */
const isOere = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0

function parsePromo(raw: unknown): TrustedPromoSnapshot | null {
  if (!isRecord(raw)) return null

  const code = normalizePromoCode(raw.code)
  if (!code || code.length > MAX_CODE_LENGTH) return null

  const promoCodeId = typeof raw.promoCodeId === 'string' ? raw.promoCodeId.trim() : ''
  // Ids in this schema are Postgres serials; anything else is malformed.
  if (!promoCodeId || promoCodeId.length > MAX_ID_LENGTH || !/^\d+$/.test(promoCodeId)) return null

  const type = raw.type
  if (typeof type !== 'string' || !DISCOUNT_TYPES.includes(type as DiscountType)) return null

  const value = raw.value
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null

  for (const field of [
    'discountAmountOere',
    'subtotalBeforeDiscountOere',
    'shippingOere',
    'totalAfterDiscountOere',
  ] as const) {
    if (!isOere(raw[field])) return null
  }

  // A promo that discounts nothing is not a promo — treat it as corrupt rather than record a
  // zero-value usage.
  if ((raw.discountAmountOere as number) <= 0) return null

  return {
    code,
    promoCodeId,
    type: type as DiscountType,
    value,
    discountAmountOere: raw.discountAmountOere as number,
    subtotalBeforeDiscountOere: raw.subtotalBeforeDiscountOere as number,
    shippingOere: raw.shippingOere as number,
    totalAfterDiscountOere: raw.totalAfterDiscountOere as number,
  }
}

/**
 * Reads merchant_data back. Never throws — every failure is a typed reason the caller can log
 * internally without any of it reaching a customer or a webhook response body.
 */
export function parseKustomMerchantData(value: unknown): ParsedKustomMerchantData {
  if (value == null || value === '') return { ok: false, reason: 'absent' }
  if (typeof value !== 'string') return { ok: false, reason: 'not_an_object' }
  if (Buffer.byteLength(value, 'utf8') > MAX_MERCHANT_DATA_BYTES) {
    return { ok: false, reason: 'too_large' }
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(value)
  } catch {
    return { ok: false, reason: 'malformed_json' }
  }
  if (!isRecord(decoded)) return { ok: false, reason: 'not_an_object' }

  // Unwrap the signed envelope when one is present.
  let body: Record<string, unknown> = decoded
  const secret = signingSecret()
  const envelope = isRecord(decoded.payload) ? decoded : null

  if (envelope) {
    if (secret) {
      const expected = sign(JSON.stringify(envelope.payload), secret)
      if (!signatureMatches(expected, envelope.signature)) {
        return { ok: false, reason: 'bad_signature' }
      }
    }
    // With no secret configured the envelope is simply unwrapped; the cross-checks in
    // crossCheckMerchantData remain the real protection.
    body = envelope.payload as Record<string, unknown>
  } else if (secret) {
    // A secret is configured but this payload is unsigned — refuse it rather than silently
    // downgrade. Orders created before the secret was introduced land here; they keep their
    // money and simply register no usage.
    return { ok: false, reason: 'bad_signature' }
  }

  if (body.version !== MERCHANT_DATA_VERSION) return { ok: false, reason: 'unsupported_version' }

  if (body.promo === undefined || body.promo === null) return { ok: true, promo: null }

  const promo = parsePromo(body.promo)
  if (!promo) return { ok: false, reason: 'invalid_promo' }

  return { ok: true, promo }
}

/* ------------------------------ cross-checks ------------------------------ */

export type CrossCheckFailure =
  | 'discount_mismatch'
  | 'total_mismatch'
  | 'arithmetic_mismatch'
  | 'no_line_discounts'

export type CrossCheckResult = { ok: true } | { ok: false; reason: CrossCheckFailure }

/** Money as Kustom actually charged it. This is the authority for a paid transaction. */
export interface PaidKustomAmounts {
  orderAmountOere: number
  orderLines: Pick<KustomOrderLine, 'type' | 'total_discount_amount'>[]
}

/**
 * Verifies the promo snapshot against what was really charged.
 *
 * This is what makes an unsigned payload safe to act on: even a perfectly-formed forgery has
 * to agree with Kustom's own confirmed amounts, and those we did not write. A mismatch means
 * corrupted or tampered data, and no usage is registered.
 */
export function crossCheckMerchantData(
  promo: TrustedPromoSnapshot,
  paid: PaidKustomAmounts,
): CrossCheckResult {
  const lineDiscounts = paid.orderLines
    .filter((l) => l.type === 'physical')
    .reduce((sum, l) => sum + (l.total_discount_amount ?? 0), 0)

  // merchant_data claims a promo but nothing was actually discounted.
  if (lineDiscounts <= 0) return { ok: false, reason: 'no_line_discounts' }

  if (promo.discountAmountOere !== lineDiscounts) return { ok: false, reason: 'discount_mismatch' }
  if (promo.totalAfterDiscountOere !== paid.orderAmountOere) {
    return { ok: false, reason: 'total_mismatch' }
  }

  const derived =
    promo.subtotalBeforeDiscountOere + promo.shippingOere - promo.discountAmountOere
  if (derived !== promo.totalAfterDiscountOere) {
    return { ok: false, reason: 'arithmetic_mismatch' }
  }

  return { ok: true }
}
