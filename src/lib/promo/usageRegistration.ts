import type { Payload } from 'payload'
import type { KustomOrder } from '@/lib/kustom'
import { PROMO_CURRENCY, normalizePromoCode } from './constants'
import { checkPromoLaunchSupport } from './supportPolicy'
import {
  crossCheckMerchantData,
  parseKustomMerchantData,
  type TrustedPromoSnapshot,
} from './kustomMerchantData'

/**
 * Registers a promo-code use, exactly once, after a payment has been confirmed.
 *
 * ── When ──
 *
 * Only from the Kustom push webhook, and only once the existing payment gate
 * (`kustomOrder.status === 'checkout_complete'`) has passed and the local order is confirmed.
 * Checkout creation never calls this: opening a payment screen is not a use.
 *
 * ── Idempotency ──
 *
 * Kustom retries the push until it gets a 2xx, so this runs repeatedly for the same order by
 * design. The identity is `kustom:<promoCodeId>:<kustomOrderId>` written into the UNIQUE
 * `orderKey` column from Stage 2 — stable across every path (existing order, reconstructed
 * order, replay) because it is derived from the Kustom order id, which is what the webhook is
 * keyed on in the first place. It survives the case where a duplicate somehow produced two
 * local order rows.
 *
 * A read-then-insert handles the common case; the UNIQUE index is the real guarantee, and a
 * unique violation from a concurrent delivery is reported as `already_registered` — success,
 * not failure. Any *other* database error is `retryable_error` and is never mistaken for a
 * duplicate.
 *
 * ── What this deliberately does not do ──
 *
 * No reservation, no counter, no per-customer key: the launch supports reusable codes only
 * (see ./supportPolicy.ts), so `uniquenessKey` stays null and there is nothing to exhaust.
 */

export type RegisterUsageResult =
  | { status: 'created'; usageId: string }
  | { status: 'already_registered'; usageId?: string }
  /** Nothing to record: no promo, unsupported mode, or unusable/inconsistent promo data. */
  | { status: 'not_applicable'; reason: NotApplicableReason }
  /** A transient failure. The paid order stands; a later webhook retry will register it. */
  | { status: 'retryable_error'; reason: string }

export type NotApplicableReason =
  | 'no_merchant_data'
  | 'invalid_merchant_data'
  | 'cross_check_failed'
  | 'promo_not_found'
  | 'promo_identity_mismatch'
  | 'promo_unsupported'
  | 'order_promo_conflict'
  | 'discounted_without_promo_identity'

export interface UsageRegistrationDeps {
  payload: Payload
  log?: (fields: Record<string, unknown>) => void
}

export interface UsageRegistrationInput {
  kustomOrder: KustomOrder
  /** The confirmed local order. */
  order: { id: number | string; orderNumber?: string | null; discount?: { code?: string | null } | null }
}

/** `kustom:<promoCodeId>:<kustomOrderId>` — see the idempotency note above. */
export function usageKustomOrderKey(promoCodeId: string | number, kustomOrderId: string): string {
  return `kustom:${promoCodeId}:${kustomOrderId}`
}

/**
 * A database error message is not safe to log verbatim: node-postgres puts the connection
 * string — credentials included — into `ECONNREFUSED`/auth failures. Any `scheme://…@host`
 * is redacted and the rest truncated, keeping enough to diagnose without ever writing a
 * password into the logs.
 */
export function redactErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown'
  return raw
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*@\S*/gi, '[redacted-uri]')
    .replace(/\b(password|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 200)
}

/**
 * True only for a Postgres unique-constraint violation (SQLSTATE 23505), however Payload has
 * wrapped it. Anything else must stay retryable — swallowing an unrelated failure as
 * "already registered" would silently lose a usage record.
 */
export function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = err

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown; originalError?: unknown }
    if (candidate.code === '23505') return true
    if (
      typeof candidate.message === 'string' &&
      /duplicate key value violates unique constraint/i.test(candidate.message)
    ) {
      return true
    }
    current = candidate.cause ?? candidate.originalError
  }
  return false
}

/**
 * Extracts the promo identity from the paid Kustom order, verifying it against the amounts
 * Kustom actually charged. Returns null (with a reason) when nothing may be registered.
 */
export function resolvePaidPromo(
  kustomOrder: KustomOrder,
): { ok: true; promo: TrustedPromoSnapshot } | { ok: false; reason: NotApplicableReason } {
  const lines = kustomOrder.order_lines ?? []
  const lineDiscounts = lines
    .filter((l) => l.type === 'physical')
    .reduce((sum, l) => sum + (l.total_discount_amount ?? 0), 0)

  const parsed = parseKustomMerchantData(kustomOrder.merchant_data)

  if (!parsed.ok) {
    // Distinguish "there was never any promo here" from "there was, and it is unreadable".
    return {
      ok: false,
      reason: parsed.reason === 'absent' && lineDiscounts <= 0
        ? 'no_merchant_data'
        : lineDiscounts > 0 && parsed.reason === 'absent'
          ? 'discounted_without_promo_identity'
          : 'invalid_merchant_data',
    }
  }

  if (!parsed.promo) {
    // Valid envelope that carries no promo. If money was nonetheless discounted, the paid
    // amounts stand but the code identity is unavailable — never invent one.
    return {
      ok: false,
      reason: lineDiscounts > 0 ? 'discounted_without_promo_identity' : 'no_merchant_data',
    }
  }

  const crossCheck = crossCheckMerchantData(parsed.promo, {
    orderAmountOere: kustomOrder.order_amount,
    orderLines: lines,
  })
  if (!crossCheck.ok) return { ok: false, reason: 'cross_check_failed' }

  return { ok: true, promo: parsed.promo }
}

export async function registerPromoUsageOnce(
  deps: UsageRegistrationDeps,
  input: UsageRegistrationInput,
): Promise<RegisterUsageResult> {
  const { payload } = deps
  const log = deps.log ?? ((fields) => console.log(JSON.stringify({ scope: 'promo-usage', ...fields })))
  const { kustomOrder, order } = input

  const resolved = resolvePaidPromo(kustomOrder)
  if (!resolved.ok) {
    // Two of these are integrity signals worth surfacing; the rest are ordinary orders.
    if (
      resolved.reason === 'discounted_without_promo_identity' ||
      resolved.reason === 'cross_check_failed' ||
      resolved.reason === 'invalid_merchant_data'
    ) {
      log({
        event: 'integrity-warning',
        reason: resolved.reason,
        kustomOrderId: kustomOrder.order_id,
        orderId: String(order.id),
      })
    }
    return { status: 'not_applicable', reason: resolved.reason }
  }

  const promo = resolved.promo

  // The order already carries a *different* code. Never overwrite, never guess which is
  // right, and register neither — a human has to look at it.
  const storedCode = normalizePromoCode(order.discount?.code ?? '')
  if (storedCode && storedCode !== promo.code) {
    log({
      event: 'integrity-conflict',
      reason: 'order_promo_conflict',
      kustomOrderId: kustomOrder.order_id,
      orderId: String(order.id),
      storedCode,
      merchantDataCode: promo.code,
    })
    return { status: 'not_applicable', reason: 'order_promo_conflict' }
  }

  // The promo must still exist, and still be the code that id refers to.
  let promoDoc: { id: number | string; code?: string | null; usageMode?: string | null; maxUses?: number | null } | undefined
  try {
    promoDoc = (await payload.findByID({
      collection: 'promo-codes',
      id: promo.promoCodeId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })) as typeof promoDoc
  } catch (err) {
    log({
      event: 'retryable',
      step: 'promo-lookup',
      kustomOrderId: kustomOrder.order_id,
      error: redactErrorMessage(err),
    })
    return { status: 'retryable_error', reason: 'promo_lookup_failed' }
  }

  if (!promoDoc) return { status: 'not_applicable', reason: 'promo_not_found' }
  if (normalizePromoCode(promoDoc.code ?? '') !== promo.code) {
    log({
      event: 'integrity-conflict',
      reason: 'promo_identity_mismatch',
      kustomOrderId: kustomOrder.order_id,
      promoCodeId: promo.promoCodeId,
    })
    return { status: 'not_applicable', reason: 'promo_identity_mismatch' }
  }

  // A code whose mode is not supported at launch must not accrue usage either.
  const support = checkPromoLaunchSupport(promoDoc)
  if (!support.supported) {
    log({
      event: 'skipped',
      reason: 'promo_unsupported',
      detail: support.reason,
      promoCodeId: promo.promoCodeId,
    })
    return { status: 'not_applicable', reason: 'promo_unsupported' }
  }

  const orderKey = usageKustomOrderKey(promo.promoCodeId, kustomOrder.order_id)

  // Fast path: a previous delivery already recorded this.
  try {
    const existing = await payload.find({
      collection: 'promo-code-usages',
      where: { orderKey: { equals: orderKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      log({ event: 'already-registered', orderKey, kustomOrderId: kustomOrder.order_id })
      return { status: 'already_registered', usageId: String(existing.docs[0].id) }
    }
  } catch (err) {
    log({
      event: 'retryable',
      step: 'usage-lookup',
      orderKey,
      error: redactErrorMessage(err),
    })
    return { status: 'retryable_error', reason: 'usage_lookup_failed' }
  }

  try {
    const created = await payload.create({
      collection: 'promo-code-usages',
      data: {
        promoCode: Number(promo.promoCodeId),
        order: Number(order.id),
        orderNumber: order.orderNumber ?? kustomOrder.merchant_reference ?? null,
        // Left null on purpose: once-per-customer is not supported at launch, so there is no
        // reason to copy a customer's address into the audit table.
        email: null,
        discountAmount: promo.discountAmountOere / 100,
        currency: PROMO_CURRENCY,
        usedAt: new Date().toISOString(),
        kustomOrderId: kustomOrder.order_id,
        orderKey,
        // Reusable codes are unconstrained; NULL repeats freely under the unique index.
        uniquenessKey: null,
      },
      overrideAccess: true,
    })

    log({
      event: 'created',
      orderKey,
      usageId: String(created.id),
      promoCodeId: promo.promoCodeId,
      code: promo.code,
      discountOere: promo.discountAmountOere,
    })
    return { status: 'created', usageId: String(created.id) }
  } catch (err) {
    // A concurrent delivery won the race — that is the unique index doing its job.
    if (isUniqueViolation(err)) {
      log({ event: 'already-registered', orderKey, viaUniqueIndex: true })
      return { status: 'already_registered' }
    }
    log({
      event: 'retryable',
      step: 'usage-insert',
      orderKey,
      error: redactErrorMessage(err),
    })
    return { status: 'retryable_error', reason: 'usage_insert_failed' }
  }
}
