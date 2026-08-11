import type { CheckoutInput, CheckoutLine, CheckoutResult, CheckoutTotals } from './checkoutFlow'

/**
 * The checkout page's pure decisions: what to send, and what to show for each server answer.
 *
 * Kept out of the component so both are unit-testable — the project has no DOM test setup,
 * and these two rules are the ones that matter (what crosses the trust boundary, and whether
 * the payment widget is allowed to render).
 */

/** Minimal cart-line shape — the store's `CartItem` satisfies it. */
export interface CheckoutCartItem {
  variantId?: string
  productId?: string
  qty: number
}

/**
 * The request body.
 *
 * Built from scratch rather than by copying and deleting fields, so the store's `price`,
 * `colorName`, `colorHex`, `colorImage` and `productSlug` have no way in. Only the code
 * string is sent for the promo — never the discount the cart displayed.
 *
 * One identifier per line: the variant when the line has one, otherwise the product. Lines
 * with neither are dropped rather than sent — a line the server could not identify would fail
 * the whole checkout, and such a line cannot be bought in any case.
 */
export function toCheckoutRequest(
  items: CheckoutCartItem[],
  promoCode: string | null | undefined,
): CheckoutInput {
  const code = typeof promoCode === 'string' ? promoCode.trim() : ''
  return {
    items: items
      .filter((item) => item.variantId || item.productId)
      .map((item) =>
        item.variantId
          ? { variantId: item.variantId, quantity: item.qty }
          : { productId: item.productId as string, quantity: item.qty },
      ),
    ...(code ? { promoCode: code } : {}),
  }
}

export type CheckoutViewState =
  | { phase: 'loading' }
  /** A generic failure: retryable in place. */
  | { phase: 'error'; message: string }
  /**
   * The promo code was rejected server-side. The widget is deliberately NOT rendered: the
   * customer asked for a discount, so charging them full price without asking would be
   * wrong. They go back to the cart to change or remove the code.
   */
  | { phase: 'promo_rejected'; message: string; totals: CheckoutTotals }
  /** The cart no longer matches the catalogue — the customer must fix it in the cart. */
  | { phase: 'cart_invalid'; message: string }
  | {
      phase: 'ready'
      kustomOrderId: string
      htmlSnippet: string
      totals: CheckoutTotals
      lines: CheckoutLine[]
      /** The code the server actually applied, or null. */
      promoCode: string | null
    }

/** Maps a server result onto the view state. */
export function checkoutStateFromResult(result: CheckoutResult): CheckoutViewState {
  if (result.ok) {
    return {
      phase: 'ready',
      kustomOrderId: result.kustomOrderId,
      htmlSnippet: result.htmlSnippet,
      totals: result.totals,
      lines: result.lines,
      promoCode: result.promo?.code ?? null,
    }
  }
  if (result.type === 'promo_invalid') {
    return { phase: 'promo_rejected', message: result.message, totals: result.trustedTotals }
  }
  if (result.type === 'cart_invalid') {
    return { phase: 'cart_invalid', message: result.message }
  }
  // promo_unavailable / payment_unavailable / server_error are all retryable in place.
  return { phase: 'error', message: result.message }
}

/** The Kustom widget may only be injected once the server has approved the order. */
export function shouldRenderWidget(state: CheckoutViewState): boolean {
  return state.phase === 'ready'
}

/**
 * The figures the summary displays: the server's as soon as it has answered, the cart's own
 * only while the request is still in flight.
 */
export function displayTotalsFor(
  state: CheckoutViewState,
  localTotals: CheckoutTotals,
): CheckoutTotals {
  if (state.phase === 'ready' || state.phase === 'promo_rejected') return state.totals
  return localTotals
}
