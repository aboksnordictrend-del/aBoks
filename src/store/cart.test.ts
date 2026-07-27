import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import type { CartItem } from './cart'

/**
 * Store tests run against a minimal in-memory `window.localStorage`, installed before the
 * store module is imported so zustand's `persist` picks it up exactly as it would in a
 * browser (its default storage reads `window.localStorage`, not the bare global).
 * Nothing here touches a network or a database.
 */

class MemoryStorage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  clear(): void {
    this.data.clear()
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }
}

const storage = new MemoryStorage()

/** A cart persisted by the version of the store that had no promo-code state at all. */
const LEGACY_PERSISTED = JSON.stringify({
  state: {
    items: [
      {
        variantId: '10',
        productSlug: 'aboks',
        colorName: 'Mørk blå',
        colorHex: '#2b3a5b',
        colorImage: '/blue.jpg',
        price: 449,
        qty: 2,
      },
    ],
  },
  version: 0,
})

type CartStore = typeof import('./cart')['useCartStore']
let useCartStore: CartStore

before(async () => {
  const globals = globalThis as { window?: unknown; localStorage?: unknown }
  globals.localStorage = storage
  globals.window = { localStorage: storage }
  storage.setItem('aboks-cart', LEGACY_PERSISTED)
  // Imported only now, so hydration reads the legacy payload above.
  ;({ useCartStore } = await import('./cart'))
})

const sampleItem: Omit<CartItem, 'qty'> = {
  variantId: '20',
  productSlug: 'aboks-mini',
  colorName: 'Creme',
  colorHex: '#e8e0cd',
  colorImage: '/creme.jpg',
  price: 299,
}

/** What actually reached localStorage. */
const persisted = (): { items?: unknown[]; promoCode?: unknown } => {
  const raw = storage.getItem('aboks-cart')
  return raw ? JSON.parse(raw).state : {}
}

describe('cart store — hydration of an existing cart', () => {
  it('loads a cart persisted before promo codes existed, with no promo state', () => {
    const state = useCartStore.getState()
    assert.equal(state.items.length, 1)
    assert.equal(state.items[0].variantId, '10')
    assert.equal(state.items[0].qty, 2)
    // The key is simply absent from the persisted payload; the initial value stands.
    assert.equal(state.promoCode, null)
  })

  it('keeps the existing cart calculations unchanged', () => {
    const state = useCartStore.getState()
    assert.equal(state.subtotal(), 898)
    assert.equal(state.shipping(), 0) // 898 ≥ 650
    assert.equal(state.orderTotal(), 898)
    assert.equal(state.totalCount(), 2)
  })
})

describe('cart store — promo code', () => {
  it('stores the code string, normalised, and nothing else', () => {
    useCartStore.getState().setPromoCode('  welcome10 ')
    assert.equal(useCartStore.getState().promoCode, 'WELCOME10')

    const state = persisted()
    assert.equal(state.promoCode, 'WELCOME10')
    // No discount, no totals, no eligibility, no promo-code id ever reaches storage.
    assert.deepEqual(Object.keys(state).sort(), ['items', 'promoCode'])
    const raw = storage.getItem('aboks-cart') ?? ''
    for (const leak of ['discountAmount', 'subtotalAfterDiscount', 'totalAfterDiscount', 'valid', 'promoCodeId', 'eligible']) {
      assert.ok(!raw.includes(leak), `persisted cart must not contain ${leak}`)
    }
  })

  it('treats a blank code as no code', () => {
    useCartStore.getState().setPromoCode('   ')
    assert.equal(useCartStore.getState().promoCode, null)
  })

  it('clears the code on request', () => {
    useCartStore.getState().setPromoCode('ABOKS100')
    assert.equal(useCartStore.getState().promoCode, 'ABOKS100')
    useCartStore.getState().clearPromoCode()
    assert.equal(useCartStore.getState().promoCode, null)
  })

  it('drops the code when the cart is emptied', () => {
    useCartStore.getState().addItem(sampleItem, 1)
    useCartStore.getState().setPromoCode('WELCOME10')
    useCartStore.getState().clearCart()

    const state = useCartStore.getState()
    assert.deepEqual(state.items, [])
    assert.equal(state.promoCode, null)
  })

  it('leaves the code alone for ordinary cart edits — the UI revalidates instead', () => {
    useCartStore.getState().addItem(sampleItem, 1)
    useCartStore.getState().setPromoCode('WELCOME10')

    useCartStore.getState().incrementItem('20')
    assert.equal(useCartStore.getState().promoCode, 'WELCOME10')

    useCartStore.getState().decrementItem('20')
    assert.equal(useCartStore.getState().promoCode, 'WELCOME10')

    // Removing the last line leaves an empty cart; the code is cleared by the hook, which
    // owns that decision — the store itself only reacts to an explicit clearCart().
    useCartStore.getState().removeItem('20')
    assert.deepEqual(useCartStore.getState().items, [])
  })
})
