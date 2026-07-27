'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  variantId: string
  productSlug: string
  colorName: string
  colorHex: string
  colorImage: string
  price: number
  qty: number
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
  removeItem: (variantId: string) => void
  incrementItem: (variantId: string) => void
  decrementItem: (variantId: string) => void
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
          const idx = state.items.findIndex((i) => i.variantId === item.variantId)
          if (idx >= 0) {
            return {
              items: state.items.map((i, j) =>
                j === idx ? { ...i, qty: i.qty + qty } : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, qty }] }
        })
      },

      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),

      incrementItem: (variantId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, qty: Math.min(99, i.qty + 1) } : i,
          ),
        })),

      decrementItem: (variantId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, qty: Math.max(1, i.qty - 1) } : i,
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
