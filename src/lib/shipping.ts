/**
 * The shipping rule, in one place.
 *
 * Both the browser (the cart store, which has no database) and the server (`priceCart`, which
 * is what actually charges) have always applied the same two numbers. They used to be written
 * out twice — literals in @/store/cart, constants in @/lib/cartPricing — which is exactly the
 * kind of duplication that eventually drifts. They live here now and both read them.
 *
 * The rule itself is unchanged: shipping is decided by the **goods subtotal**, and a promo
 * code never moves it in either direction. See `shippingForSubtotalOere`.
 */

import { toOere } from './money'

/** Shipping the customer pays when the cart is under the free-shipping threshold. */
export const SHIPPING_COST_KR = 69
/** Goods subtotal (BEFORE any promo discount) at which shipping becomes free. */
export const FREE_SHIPPING_THRESHOLD_KR = 650

export const SHIPPING_COST_OERE = SHIPPING_COST_KR * 100
export const FREE_SHIPPING_THRESHOLD_OERE = FREE_SHIPPING_THRESHOLD_KR * 100

/**
 * Shipping for a given goods subtotal.
 *
 * Deliberately takes the subtotal **before** any promo discount: a promo code must never
 * push an order back under the free-shipping threshold, and must never buy free shipping
 * either.
 *
 * The subtotal it is given is the *effective* one — after quantity pricing, which is a price,
 * not a discount. Twelve aBoks Mini at the 10–19 price reach the threshold on what the
 * customer actually pays, exactly as one aBoks at its ordinary price does.
 */
export function shippingForSubtotalOere(subtotalOere: number): number {
  return subtotalOere >= FREE_SHIPPING_THRESHOLD_OERE ? 0 : SHIPPING_COST_OERE
}

/** The same rule for a subtotal in kroner, for the cart store's own summary. */
export function shippingForSubtotalKr(subtotalKr: number): number {
  return shippingForSubtotalOere(toOere(subtotalKr)) / 100
}
