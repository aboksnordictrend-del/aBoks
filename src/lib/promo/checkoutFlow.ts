import type { Payload } from 'payload'
import { oereToKr, priceCart, type CartLineInput } from '@/lib/cartPricing'
import type { KustomCreateOrderPayload, KustomOrder } from '@/lib/kustom'
import { validatePromoCode } from './validate'
import { MAX_CART_LINES } from './validateEndpoint'
import {
  assertKustomOrderInvariants,
  assertLocalOrderParity,
  buildKustomOrder,
  type KustomOrderBuild,
} from './kustomLines'
import type { PromoValidationSuccess } from './types'

/**
 * Trusted checkout creation.
 *
 * ── Trust boundary ──
 *
 * The browser sends variant identifiers, quantities and (optionally) a promo-code string.
 * Nothing else crosses. Every price, name, subtotal, shipping charge, tax figure, discount
 * and total is derived server-side from the catalogue by `priceCart()` and, for discounts, by
 * `validatePromoCode()`. A tampered `price` in localStorage — the cart is a persisted zustand
 * store, entirely under the customer's control — has no path into anything here.
 *
 * This replaces the previous behaviour, where the subtotal, every Kustom `unit_price` and the
 * stored order's own money were all computed from `item.price` as sent by the browser.
 *
 * ── Sequence, and why it is in this order ──
 *
 *   1. price the cart          → fail fast: no Kustom call, no order number, no local order
 *   2. validate the promo code → fail fast, same
 *   3. build lines + assert    → fail fast, same
 *   4. allocate an order number
 *   5. POST to Kustom
 *   6. create the pending local order (best effort)
 *
 * Everything that can fail cheaply fails before any external call, so a rejected checkout
 * leaves no orphan Kustom order and burns no order number. The local order is written last
 * and deliberately non-blocking: a database hiccup must not stop a customer paying, and the
 * webhook rebuilds the order from Kustom if it does. The reverse order would be worse — a
 * local order pointing at a Kustom order that was never created is unreconcilable.
 *
 * Dependencies are injected so the whole flow is testable without a database, without the
 * Payload config, and without ever reaching api.kustom.co.
 */

/** Only ever these two fields per line — see the trust boundary above. */
export interface CheckoutLineInput {
  variantId: string | number
  quantity: number
}

export interface CheckoutInput {
  items: CheckoutLineInput[]
  promoCode?: string
}

/** Server-computed figures, in kroner, for the checkout summary. */
export interface CheckoutTotals {
  subtotal: number
  discount: number
  shipping: number
  total: number
}

export interface AppliedPromo {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  discountAmount: number
}

/** One line as the server priced it, so the summary never displays a cart-derived amount. */
export interface CheckoutLine {
  variantId: string
  displayName: string
  quantity: number
  /** Pre-discount line value, in kroner. */
  lineTotal: number
  discountAmount: number
}

export type CheckoutResult =
  | {
      ok: true
      kustomOrderId: string
      htmlSnippet: string
      totals: CheckoutTotals
      lines: CheckoutLine[]
      promo: AppliedPromo | null
    }
  /** The cart no longer matches the catalogue, or the request was malformed. */
  | { ok: false; type: 'cart_invalid'; reason: string; message: string }
  /** The code was accepted in the cart but is not usable now. Kustom is never called. */
  | {
      ok: false
      type: 'promo_invalid'
      reason: string
      message: string
      trustedTotals: CheckoutTotals
    }
  /** The promo lookup itself failed. Retryable; Kustom is never called. */
  | { ok: false; type: 'promo_unavailable'; message: string }
  /** Kustom is unreachable or refused the order. */
  | { ok: false; type: 'payment_unavailable'; message: string }
  /** Our own arithmetic or an unexpected failure. Never carries detail. */
  | { ok: false; type: 'server_error'; message: string }

export const CHECKOUT_MESSAGES = {
  malformed: 'Handlekurven kunne ikke leses. Oppdater siden og prøv igjen.',
  promoUnavailable: 'Vi klarte ikke å kontrollere rabattkoden akkurat nå. Prøv igjen om litt.',
  paymentUnavailable: 'Betalingstjenesten er ikke tilgjengelig akkurat nå. Prøv igjen om litt.',
  noPaymentMethods:
    'Ingen betalingsmetoder er aktivert for nettbutikken. Kontakt oss på post@aboks.no for hjelp.',
  serverError: 'Noe gikk galt under klargjøring av betalingen. Prøv igjen om litt.',
} as const

export interface CheckoutDeps {
  payload: Payload
  createOrder: (payload: KustomCreateOrderPayload) => Promise<KustomOrder>
  allocateOrderNumber: (payload: Payload) => Promise<string>
  /** Fallback order number when the allocator is unreachable. */
  fallbackOrderNumber: () => string
  serverUrl: string
  /** PII-free structured log. Never the promo code, never credentials, never a stack. */
  log?: (fields: Record<string, unknown>) => void
}

/**
 * Rebuilds the cart lines from scratch, keeping only the identifier and the quantity.
 *
 * Deliberately not a filtered copy of the browser's objects: a new object is constructed per
 * line, so a field we have not thought of cannot ride along. Quantity is passed through
 * unvalidated — `priceCart()` is the authority on what a valid quantity is.
 */
export function toTrustedLines(items: unknown): CartLineInput[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CART_LINES) return null

  const lines: CartLineInput[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const source = raw as { variantId?: unknown; quantity?: unknown }
    const id = source.variantId
    if (typeof id !== 'string' && typeof id !== 'number') return null
    const variantId = String(id).trim()
    if (!variantId) return null
    lines.push({ variantId, quantity: source.quantity as number })
  }
  return lines
}

/**
 * The pending order, built entirely from trusted figures.
 *
 * `lineTotal` is the line's PRE-discount value and `discountAmount` holds its share of the
 * promo discount, which keeps the order's existing identity intact:
 *
 *     subtotal + shipping − total === discount.discountAmount
 *
 * That is the identity the PDF receipt already relies on to print its "Rabatt" row. The
 * `discount` group is written only for a genuinely applied promo — every field on it is
 * optional, so an ordinary order stores nothing new.
 */
export function buildPendingOrderData(
  orderNumber: string,
  build: KustomOrderBuild,
  promo: PromoValidationSuccess | null,
) {
  const { totals } = build

  return {
    orderNumber,
    items: build.productLines.map((line) => ({
      variant: Number(line.variantId),
      displayName: line.displayName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPrice: oereToKr(line.unitPriceOere),
      lineTotal: oereToKr(line.grossOere),
      discountAmount: oereToKr(line.discountOere),
    })),
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    total: totals.total,
    ...(promo
      ? {
          discount: {
            promoCode: Number(promo.promoCodeId),
            code: promo.code,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            discountAmount: totals.discount,
            subtotalBeforeDiscount: totals.subtotal,
            subtotalAfterDiscount: oereToKr(totals.subtotalOere - totals.discountOere),
            totalBeforeDiscount: oereToKr(totals.subtotalOere + totals.shippingOere),
            totalAfterDiscount: totals.total,
          },
        }
      : {}),
    status: 'pending' as const,
  }
}

export async function createTrustedCheckout(
  deps: CheckoutDeps,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const startedAt = Date.now()
  const log = deps.log ?? ((fields) => console.log(JSON.stringify({ scope: 'checkout', ...fields })))

  const trustedLines = toTrustedLines(input?.items)
  if (!trustedLines) {
    log({ event: 'rejected', type: 'cart_invalid', reason: 'malformed_input' })
    return {
      ok: false,
      type: 'cart_invalid',
      reason: 'malformed_input',
      message: CHECKOUT_MESSAGES.malformed,
    }
  }

  log({ event: 'start', lineCount: trustedLines.length, hasPromo: Boolean(input.promoCode) })

  const { payload } = deps

  // ── 1. Trusted pricing ────────────────────────────────────────────────────
  const priced = await priceCart(payload, trustedLines)
  if (!priced.ok) {
    log({ event: 'rejected', type: 'cart_invalid', reason: priced.reason })
    return { ok: false, type: 'cart_invalid', reason: priced.reason, message: priced.message }
  }
  const cart = priced.cart

  // ── 2. Promo revalidation ─────────────────────────────────────────────────
  // The cart UI's earlier answer is never trusted: the code may have expired, been used up
  // or stopped applying since. A code that no longer works must NOT be silently dropped and
  // the customer charged full price — they are told, and they decide.
  let promo: PromoValidationSuccess | null = null
  const submittedCode = typeof input.promoCode === 'string' ? input.promoCode.trim() : ''

  if (submittedCode) {
    const result = await validatePromoCode(payload, { code: submittedCode, cart })

    if (!result.valid) {
      if (result.reason === 'lookup_failed') {
        // Transient. Creating a full-price order here would charge more than the cart showed,
        // for a reason that is entirely ours — so nothing is created and the customer retries.
        log({ event: 'rejected', type: 'promo_unavailable', reason: result.reason })
        return { ok: false, type: 'promo_unavailable', message: CHECKOUT_MESSAGES.promoUnavailable }
      }

      log({ event: 'rejected', type: 'promo_invalid', reason: result.reason })
      return {
        ok: false,
        type: 'promo_invalid',
        reason: result.reason,
        message: result.message,
        trustedTotals: {
          subtotal: cart.subtotalKr,
          discount: 0,
          shipping: cart.shippingKr,
          total: cart.totalKr,
        },
      }
    }

    promo = result
  }

  // ── 3. Kustom lines + invariants ──────────────────────────────────────────
  let build: KustomOrderBuild
  try {
    build = buildKustomOrder(cart, promo)
    assertKustomOrderInvariants(build, cart, promo)
  } catch (err) {
    // Our own arithmetic is wrong. Nothing is created and nobody is charged.
    log({
      event: 'invariant-failed',
      error: err instanceof Error ? err.message : 'unknown',
      lineCount: cart.lines.length,
    })
    return { ok: false, type: 'server_error', message: CHECKOUT_MESSAGES.serverError }
  }

  // ── 4. Order number ───────────────────────────────────────────────────────
  // Allocated up front: Kustom needs it as merchant_reference before the Payload row exists.
  // A database hiccup must not stop the customer paying, so an unreachable allocator degrades
  // to the old random number.
  let orderNumber: string
  try {
    orderNumber = await deps.allocateOrderNumber(payload)
  } catch (err) {
    console.error('[kasse] Failed to allocate order number:', err instanceof Error ? err.message : err)
    orderNumber = deps.fallbackOrderNumber()
  }

  // The local order is assembled (and checked against the Kustom figures) before the external
  // call, so a parity bug cannot be discovered only after the customer has been charged.
  const orderData = buildPendingOrderData(orderNumber, build, promo)
  try {
    assertLocalOrderParity(orderData, build)
  } catch (err) {
    log({ event: 'parity-failed', error: err instanceof Error ? err.message : 'unknown' })
    return { ok: false, type: 'server_error', message: CHECKOUT_MESSAGES.serverError }
  }

  // ── 5. Kustom ─────────────────────────────────────────────────────────────
  let kustomOrder: KustomOrder
  try {
    kustomOrder = await deps.createOrder({
      purchase_country: 'NO',
      purchase_currency: 'NOK',
      locale: 'nb-NO',
      order_amount: build.orderAmountOere,
      order_tax_amount: build.orderTaxAmountOere,
      order_lines: build.orderLines,
      merchant_urls: {
        terms: `${deps.serverUrl}/kjopsvilkar`,
        checkout: `${deps.serverUrl}/kasse?order_id={checkout.order.id}`,
        confirmation: `${deps.serverUrl}/kasse/bekreftelse?order_id={checkout.order.id}`,
        push: `${deps.serverUrl}/api/kustom/webhook?order_id={checkout.order.id}`,
      },
      merchant_reference: orderNumber,
      billing_countries: ['NO'],
      shipping_countries: ['NO'],
    })
  } catch (err) {
    // createKustomOrder already logs Kustom's status and response body server-side; the
    // customer only ever sees the fixed Norwegian message.
    console.error('[kasse] Kustom create order failed:', err instanceof Error ? err.message : err)
    return { ok: false, type: 'payment_unavailable', message: CHECKOUT_MESSAGES.paymentUnavailable }
  }

  // Account-level misconfiguration: no widget AND no payment methods enabled in the Portal.
  // html_snippet === 'deducted' is normal and not an error indicator.
  const noPaymentMethods =
    (kustomOrder.external_payment_methods?.length ?? 0) === 0 &&
    (kustomOrder.external_checkouts?.length ?? 0) === 0
  if (!kustomOrder.html_snippet && noPaymentMethods) {
    console.error(
      '[kasse] Kustom returned no usable checkout widget. ' +
        'html_snippet=%s external_payment_methods=%d external_checkouts=%d — ' +
        'Enable payment methods in the Kustom Portal under Elements/Integrations.',
      kustomOrder.html_snippet,
      kustomOrder.external_payment_methods?.length ?? 0,
      kustomOrder.external_checkouts?.length ?? 0,
    )
    return { ok: false, type: 'payment_unavailable', message: CHECKOUT_MESSAGES.noPaymentMethods }
  }

  // ── 6. Pending local order (best effort) ──────────────────────────────────
  try {
    await payload.create({
      collection: 'orders',
      data: { ...orderData, kustomOrderId: kustomOrder.order_id },
    })
  } catch (err) {
    // Logged, not fatal — the customer can still pay and the webhook rebuilds the order.
    console.error(
      '[kasse] Failed to pre-create order in Payload CMS:',
      err instanceof Error ? err.message : err,
    )
  }

  log({
    event: 'created',
    orderAmountOere: build.orderAmountOere,
    discountOere: build.totals.discountOere,
    hasPromo: Boolean(promo),
    durationMs: Date.now() - startedAt,
  })

  return {
    ok: true,
    kustomOrderId: kustomOrder.order_id,
    htmlSnippet: kustomOrder.html_snippet ?? '',
    totals: {
      subtotal: build.totals.subtotal,
      discount: build.totals.discount,
      shipping: build.totals.shipping,
      total: build.totals.total,
    },
    lines: build.productLines.map((line) => ({
      variantId: line.variantId,
      displayName: line.displayName,
      quantity: line.quantity,
      lineTotal: oereToKr(line.grossOere),
      discountAmount: oereToKr(line.discountOere),
    })),
    promo: promo
      ? {
          code: promo.code,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          discountAmount: build.totals.discount,
        }
      : null,
  }
}

/**
 * Reads the summary figures back off an existing Kustom order (the customer returned via
 * Kustom's own checkout URL). Kustom is authoritative here, so nothing is recomputed —
 * including the discount, which lives in `total_discount_amount` on the physical lines.
 */
export function checkoutResultFromKustomOrder(kustomOrder: KustomOrder): CheckoutResult {
  const lines = kustomOrder.order_lines ?? []
  const physical = lines.filter((l) => l.type === 'physical')
  const shippingOere = lines
    .filter((l) => l.type === 'shipping_fee')
    .reduce((sum, l) => sum + l.total_amount, 0)
  const grossOere = physical.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
  const discountOere = physical.reduce((sum, l) => sum + (l.total_discount_amount ?? 0), 0)

  return {
    ok: true,
    kustomOrderId: kustomOrder.order_id,
    htmlSnippet: kustomOrder.html_snippet ?? '',
    totals: {
      subtotal: oereToKr(grossOere),
      discount: oereToKr(discountOere),
      shipping: oereToKr(shippingOere),
      total: oereToKr(kustomOrder.order_amount),
    },
    lines: physical.map((l) => ({
      variantId: l.reference,
      displayName: l.name,
      quantity: l.quantity,
      lineTotal: oereToKr(l.unit_price * l.quantity),
      discountAmount: oereToKr(l.total_discount_amount ?? 0),
    })),
    // The code itself is not recoverable from Kustom's lines under Option A — see Stage 8.
    promo: null,
  }
}
