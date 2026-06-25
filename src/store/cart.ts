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
  addItem: (item: Omit<CartItem, 'qty'>, qty: number) => void
  removeItem: (variantId: string) => void
  incrementItem: (variantId: string) => void
  decrementItem: (variantId: string) => void
  clearCart: () => void
  totalCount: () => number
  subtotal: () => number
  shipping: () => number
  orderTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

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

      clearCart: () => set({ items: [] }),

      totalCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),

      subtotal: () => get().items.reduce((sum, i) => sum + i.qty * i.price, 0),

      shipping: () => (get().subtotal() >= 650 ? 0 : 69),

      orderTotal: () => get().subtotal() + get().shipping(),
    }),
    {
      name: 'aboks-cart',
    },
  ),
)
