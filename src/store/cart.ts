'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { resolvedLineRef } from '@/lib/cart/lineRef'

export interface CartItem {
  /**
   * The chosen variant, for a product that has colour variants. Absent — genuinely, not as a
   * placeholder — for a product that has none.
   *
   * Optional rather than required so a variant-less product can be a first-class cart line
   * without a fabricated variant id. Every cart already in a customer's localStorage has one
   * set, so `cartLineRef` reads those exactly as before and nothing about them changes.
   */
  variantId?: string
  /**
   * The product itself. Required for a variant-less line, which has no other identity; carried
   * on a variant line too when the page that added it knew it, and simply absent on lines
   * persisted before this field existed (where the variant is the identity anyway).
   */
  productId?: string
  productSlug: string
  /**
   * The product's own name — "aBoks Mini", "aBoks Vegg", an accessory's title.
   *
   * Optional because carts persisted before this field existed genuinely do not have it;
   * the type would be lying otherwise. Those lines are resolved at render time from the live
   * catalogue by slug (see @/lib/cart/lineTitle), and `addItem` fills the gap in as soon as
   * the same variant is added again.
   *
   * Kept separate from `colorName` on purpose: the two are never concatenated into one
   * stored string. Anything that needs the combined "Produkt – Farge" label composes it at
   * the point of display.
   */
  productTitle?: string
  /** The chosen colour. Empty string for a product with no variants — there is no colour. */
  colorName: string
  /** Swatch colour. Empty string when there is no variant; the cart then shows no swatch. */
  colorHex: string
  /** The line's thumbnail: the variant's image, or the product's own for a variant-less line. */
  colorImage: string
  price: number
  qty: number
}

/**
 * The stable identity of a cart line: the variant id, or `product-<id>` when there is no
 * variant. This is the key every store operation takes and the key React renders lists on.
 *
 * Re-exported from the store because that is where every caller already looks; the rule
 * itself lives in @/lib/cart/lineRef, shared with the server.
 */
export function cartLineRef(item: Pick<CartItem, 'variantId' | 'productId'>): string {
  return resolvedLineRef(item)
}

interface CartState {
  items: CartItem[]
  /**
   * The applied promo code, as a bare string — nothing else.
   *
   * Deliberately NOT stored here: the discount amount, the subtotal or total after discount,
   * whether the code is eligible, the validation result, or the promo code's id. Those are
   * all trusted values, and anything in this store is persisted to localStorage where the
   * customer can edit it freely. The server recomputes every figure from this string alone,
   * both for display (via /api/promo-codes/validate) and again at checkout.
   */
  promoCode: string | null
  addItem: (item: Omit<CartItem, 'qty'>, qty: number) => void
  /** All three take a line reference — `cartLineRef(item)`, not a bare variant id. */
  removeItem: (ref: string) => void
  incrementItem: (ref: string) => void
  decrementItem: (ref: string) => void
  clearCart: () => void
  setPromoCode: (code: string) => void
  clearPromoCode: () => void
  totalCount: () => number
  subtotal: () => number
  shipping: () => number
  orderTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,

      addItem: (item, qty) => {
        set((state) => {
          const ref = cartLineRef(item)
          const idx = state.items.findIndex((i) => cartLineRef(i) === ref)
          if (idx >= 0) {
            return {
              items: state.items.map((i, j) =>
                j === idx
                  ? {
                      ...i,
                      qty: i.qty + qty,
                      // Heal a line persisted before `productTitle` existed. Only ever fills a
                      // gap — an existing title is left alone, and quantity, price and the
                      // chosen variant are untouched either way.
                      ...(i.productTitle ? {} : { productTitle: item.productTitle }),
                    }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, qty }] }
        })
      },

      removeItem: (ref) =>
        set((state) => ({ items: state.items.filter((i) => cartLineRef(i) !== ref) })),

      incrementItem: (ref) =>
        set((state) => ({
          items: state.items.map((i) =>
            cartLineRef(i) === ref ? { ...i, qty: Math.min(99, i.qty + 1) } : i,
          ),
        })),

      decrementItem: (ref) =>
        set((state) => ({
          items: state.items.map((i) =>
            cartLineRef(i) === ref ? { ...i, qty: Math.max(1, i.qty - 1) } : i,
          ),
        })),

      // Emptying the cart drops the code too — there is nothing left for it to apply to.
      clearCart: () => set({ items: [], promoCode: null }),

      setPromoCode: (code) => set({ promoCode: code.trim() ? code.trim().toUpperCase() : null }),

      clearPromoCode: () => set({ promoCode: null }),

      totalCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),

      subtotal: () => get().items.reduce((sum, i) => sum + i.qty * i.price, 0),

      shipping: () => (get().subtotal() >= 650 ? 0 : 69),

      orderTotal: () => get().subtotal() + get().shipping(),
    }),
    {
      name: 'aboks-cart',
      /**
       * Explicit allowlist of what reaches localStorage. The computed helpers were already
       * dropped by JSON serialisation, so this changes nothing today — it is here so that a
       * future field has to be added deliberately rather than persisted by accident.
       *
       * No `version`/`migrate`: a cart persisted before `promoCode` existed simply has no
       * such key, and zustand's default merge keeps the initial `null` for it. Bumping the
       * version instead would risk discarding carts that customers already have.
       */
      partialize: (state) => ({ items: state.items, promoCode: state.promoCode }),
    },
  ),
)
