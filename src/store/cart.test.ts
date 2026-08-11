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

describe('cart store — the drawer flag', () => {
  it('starts shut and opens only when asked', () => {
    useCartStore.setState({ items: [], promoCode: null, drawerOpen: false })
    assert.equal(useCartStore.getState().drawerOpen, false)

    useCartStore.getState().openCartDrawer()
    assert.equal(useCartStore.getState().drawerOpen, true)

    useCartStore.getState().closeCartDrawer()
    assert.equal(useCartStore.getState().drawerOpen, false)
  })

  it('is never opened by a cart write — adding is what the caller decides to follow with', () => {
    useCartStore.setState({ items: [], promoCode: null, drawerOpen: false })

    useCartStore.getState().addItem(sampleItem, 1)
    useCartStore.getState().incrementItem('20')
    useCartStore.getState().decrementItem('20')
    useCartStore.getState().removeItem('20')

    assert.equal(useCartStore.getState().drawerOpen, false)
  })

  it('stays open across further cart writes, so a second add does not reopen it', () => {
    useCartStore.setState({ items: [], promoCode: null, drawerOpen: false })
    useCartStore.getState().openCartDrawer()

    useCartStore.getState().addItem(sampleItem, 1)
    useCartStore.getState().openCartDrawer() // the product page asks again — same value
    useCartStore.getState().incrementItem('20')

    assert.equal(useCartStore.getState().drawerOpen, true)
    assert.equal(useCartStore.getState().items[0].qty, 2)
  })

  it('never reaches localStorage — a reload must not restore an open cart', () => {
    useCartStore.setState({ items: [], promoCode: null, drawerOpen: false })
    useCartStore.getState().addItem(sampleItem, 1)
    useCartStore.getState().openCartDrawer()

    assert.deepEqual(Object.keys(persisted()).sort(), ['items', 'promoCode'])
    assert.ok(!(storage.getItem('aboks-cart') ?? '').includes('drawerOpen'))
  })
})

describe('cart store — product title on the line', () => {
  it('stores the product title given at add time', () => {
    useCartStore.setState({ items: [], promoCode: null })
    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'aBoks Mini' }, 1)

    const [item] = useCartStore.getState().items
    assert.equal(item.productTitle, 'aBoks Mini')
    // Kept apart from the colour — the two are never merged into one stored string.
    assert.equal(item.colorName, 'Creme')
    assert.ok(!item.productTitle!.includes('Creme'))
  })

  it('persists the title, so a reload still knows what the line is', () => {
    useCartStore.setState({ items: [], promoCode: null })
    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'aBoks Mini' }, 1)

    const stored = (persisted().items ?? []) as { productTitle?: string }[]
    assert.equal(stored[0].productTitle, 'aBoks Mini')
  })

  it('fills in a missing title when the same variant is added again, changing nothing else', () => {
    // A line hydrated from a cart persisted before the field existed.
    useCartStore.setState({
      items: [{ ...sampleItem, qty: 3 }],
      promoCode: null,
    })
    assert.equal(useCartStore.getState().items[0].productTitle, undefined)

    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'aBoks Mini' }, 1)

    const [item] = useCartStore.getState().items
    assert.equal(item.productTitle, 'aBoks Mini')
    assert.equal(item.qty, 4) // 3 + 1 — quantity merged as before, not reset
    assert.equal(item.variantId, '20') // the chosen variant is untouched
    assert.equal(item.price, 299)
  })

  it('never overwrites a title a line already has', () => {
    useCartStore.setState({ items: [], promoCode: null })
    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'aBoks Mini' }, 1)
    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'Noe annet' }, 1)

    assert.equal(useCartStore.getState().items[0].productTitle, 'aBoks Mini')
    assert.equal(useCartStore.getState().items[0].qty, 2)
  })

  it('keeps two products as two separate lines with their own titles', () => {
    useCartStore.setState({ items: [], promoCode: null })
    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'aBoks Mini' }, 1)
    useCartStore.getState().addItem(
      {
        variantId: '31',
        productSlug: 'aboks-vegg',
        productTitle: 'aBoks Vegg',
        colorName: 'Sort',
        colorHex: '#1a1d17',
        colorImage: '/sort.jpg',
        price: 549,
      },
      1,
    )

    assert.deepEqual(
      useCartStore.getState().items.map((i) => [i.productTitle, i.colorName]),
      [
        ['aBoks Mini', 'Creme'],
        ['aBoks Vegg', 'Sort'],
      ],
    )
  })

  it('keeps totals, quantities and shipping exactly as before', () => {
    useCartStore.setState({ items: [], promoCode: null })
    useCartStore.getState().addItem({ ...sampleItem, productTitle: 'aBoks Mini' }, 2)

    assert.equal(useCartStore.getState().subtotal(), 598)
    assert.equal(useCartStore.getState().shipping(), 69) // under kr 650
    assert.equal(useCartStore.getState().orderTotal(), 667)
    assert.equal(useCartStore.getState().totalCount(), 2)

    useCartStore.getState().incrementItem('20')
    assert.equal(useCartStore.getState().items[0].qty, 3)
    assert.equal(useCartStore.getState().subtotal(), 897)
    assert.equal(useCartStore.getState().shipping(), 0) // over the threshold

    useCartStore.getState().decrementItem('20')
    assert.equal(useCartStore.getState().items[0].qty, 2)
  })
})

/**
 * Lines for a product with no variants.
 *
 * These carry a `productId` and no `variantId` — never a placeholder — so every store
 * operation has to work off the line reference rather than the variant id.
 */
const plainItem: Omit<CartItem, 'qty'> = {
  productId: '7',
  productSlug: 'gp-ultra-plus-aa-10',
  productTitle: 'GP Ultra Plus Alkaline AA-batteri, 10-pakk',
  colorName: '',
  colorHex: '',
  colorImage: '/gp-aa.jpg',
  price: 129,
}

describe('cart store — a product with no variants', () => {
  it('adds it as an ordinary line, with no invented variant', () => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(plainItem, 1)

    const [item] = useCartStore.getState().items
    assert.equal(item.variantId, undefined)
    assert.equal(item.productId, '7')
    assert.equal(item.qty, 1)
    assert.equal(useCartStore.getState().subtotal(), 129)
  })

  it('merges a second add into the same line', () => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(plainItem, 1)
    useCartStore.getState().addItem(plainItem, 2)

    assert.equal(useCartStore.getState().items.length, 1)
    assert.equal(useCartStore.getState().items[0].qty, 3)
  })

  it('increments, decrements and removes by line reference', () => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(plainItem, 1)

    useCartStore.getState().incrementItem('product-7')
    assert.equal(useCartStore.getState().items[0].qty, 2)

    useCartStore.getState().decrementItem('product-7')
    assert.equal(useCartStore.getState().items[0].qty, 1)

    useCartStore.getState().removeItem('product-7')
    assert.equal(useCartStore.getState().items.length, 0)
  })

  it('keeps two different variant-less products apart', () => {
    // The bug this guards against: keying on a missing variant id would collapse every
    // variant-less product onto one line.
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(plainItem, 1)
    useCartStore.getState().addItem({ ...plainItem, productId: '8', price: 99 }, 1)

    assert.equal(useCartStore.getState().items.length, 2)
    assert.equal(useCartStore.getState().subtotal(), 228)
  })
})

describe('cart store — a mixed cart', () => {
  it('holds a variant line and a variant-less line side by side, and settles them separately', () => {
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(sampleItem, 1) // variant '20', 299 kr
    useCartStore.getState().addItem(plainItem, 2) // product 7, 2 × 129 kr

    assert.equal(useCartStore.getState().items.length, 2)
    assert.equal(useCartStore.getState().totalCount(), 3)
    assert.equal(useCartStore.getState().subtotal(), 557)

    // Removing one leaves the other exactly as it was.
    useCartStore.getState().removeItem('product-7')
    assert.equal(useCartStore.getState().items.length, 1)
    assert.equal(useCartStore.getState().items[0].variantId, '20')
    assert.equal(useCartStore.getState().subtotal(), 299)
  })

  it('still addresses a variant line by its bare variant id', () => {
    // Backward compatibility: the reference of a variant line is unchanged, so any caller
    // that already had a variant id keeps working.
    useCartStore.getState().clearCart()
    useCartStore.getState().addItem(sampleItem, 1)
    useCartStore.getState().incrementItem('20')
    assert.equal(useCartStore.getState().items[0].qty, 2)
    useCartStore.getState().removeItem('20')
    assert.equal(useCartStore.getState().items.length, 0)
  })
})
