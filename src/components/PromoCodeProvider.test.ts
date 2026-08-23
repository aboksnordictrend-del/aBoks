import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toCheckoutRequest } from '@/lib/promo/checkoutView'
import type { CartItem } from '@/store/cart'

/**
 * One promo state, two carts.
 *
 * The cart page and the slide-out drawer are two views of the same cart, and the promo code
 * has to work the same way: `usePromoCode` owns the applied code, its trusted totals and the
 * in-flight request, so calling it in both places would give each view its own copy — two
 * requests per cart change, and a «Fjern» in one that the other never hears about. Only the
 * persisted *string* is shared through the store; the state machine is not.
 *
 * The first block below is therefore a structural test, and deliberately so: what it guards
 * is that nothing re-introduces a second `usePromoCode()` call. There is no runtime assertion
 * that could catch that — two independent hooks behave perfectly until a customer removes a
 * code in one view and finds it still applied in the other.
 */

const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')

/** Every `usePromoCode(` call site, ignoring the import statement and this file's prose. */
const callsUsePromoCode = (source: string): boolean => /usePromoCode\(\)/.test(source)

describe('one promo state serves both carts', () => {
  const provider = read('./PromoCodeProvider.tsx')
  const drawer = read('./CartDrawer.tsx')
  const cartPage = read('../app/(frontend)/handlekurv/CartClient.tsx')
  const layout = read('../app/(frontend)/layout.tsx')

  it('mounts the hook exactly once, in the provider', () => {
    assert.ok(callsUsePromoCode(provider), 'the provider is what owns the hook')
    assert.ok(!callsUsePromoCode(drawer), 'the drawer must not open a second promo state')
    assert.ok(!callsUsePromoCode(cartPage), 'the cart page must not open a second promo state')
  })

  it('has both views read the shared one', () => {
    for (const [name, source] of [
      ['CartDrawer', drawer],
      ['CartClient', cartPage],
    ] as const) {
      assert.match(source, /useSharedPromoCode\(\)/, `${name} must read the shared state`)
      assert.match(
        source,
        /from '@\/components\/PromoCodeProvider'/,
        `${name} must import it from the provider`,
      )
    }
  })

  it('wraps both of them in the provider, in the layout', () => {
    const open = layout.indexOf('<PromoCodeProvider>')
    const close = layout.indexOf('</PromoCodeProvider>')
    assert.ok(open >= 0 && close > open, 'the provider must be mounted in the layout')

    const inside = layout.slice(open, close)
    assert.match(inside, /<CartDrawer \/>/, 'the drawer must be inside the provider')
    assert.match(inside, /\{children\}/, 'the pages — including /handlekurv — must be too')
  })

  it('refuses to fall back to a private state when the provider is missing', () => {
    // A silent fallback is exactly the second, independent state this file exists to prevent.
    assert.match(provider, /throw new Error\('useSharedPromoCode must be used inside/)
  })
})

/**
 * Both views draw their totals with the same helper, so a `Rabatt` row and a discounted
 * `Totalt` cannot appear in one and not the other.
 */
describe('both carts build their totals the same way', () => {
  it('uses buildSummaryRows in the drawer as well as on the cart page', () => {
    for (const source of [read('./CartDrawer.tsx'), read('../app/(frontend)/handlekurv/CartClient.tsx')]) {
      assert.match(source, /buildSummaryRows\(/)
    }
  })
})

/* ------------------------------ the hand-off to checkout ------------------------------ */

/**
 * «Gå til kassen» is a plain link to /kasse in both carts; what carries the discount across is
 * the store's persisted `promoCode`, which /kasse reads and puts in its checkout request.
 * This walks that path with a real store over an in-memory localStorage.
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

type CartStore = typeof import('@/store/cart')['useCartStore']
let useCartStore: CartStore

const sampleItem: Omit<CartItem, 'qty'> = {
  variantId: '20',
  productSlug: 'aboks-mini',
  colorName: 'Creme',
  colorHex: '#e8e0cd',
  colorImage: '/creme.jpg',
  price: 299,
}

before(async () => {
  const globals = globalThis as { window?: unknown; localStorage?: unknown }
  globals.localStorage = storage
  globals.window = { localStorage: storage }
  ;({ useCartStore } = await import('@/store/cart'))
})

describe('a code applied in the drawer survives the trip to checkout', () => {
  it('reaches the checkout request the /kasse page sends', () => {
    const store = useCartStore.getState()
    store.clearCart()
    store.addItem(sampleItem, 2)
    // What the shared hook does on a valid answer.
    useCartStore.getState().setPromoCode('sommer20')

    const { items, promoCode } = useCartStore.getState()
    assert.equal(promoCode, 'SOMMER20')
    assert.deepEqual(toCheckoutRequest(items, promoCode), {
      items: [{ variantId: '20', quantity: 2 }],
      promoCode: 'SOMMER20',
    })
  })

  it('outlives closing and reopening the drawer — the flag is not part of the code', () => {
    useCartStore.getState().openCartDrawer()
    useCartStore.getState().closeCartDrawer()
    useCartStore.getState().openCartDrawer()
    assert.equal(useCartStore.getState().promoCode, 'SOMMER20')
  })

  it('is persisted, so a reload still hands it to checkout', () => {
    const persisted = JSON.parse(storage.getItem('aboks-cart') as string).state
    assert.equal(persisted.promoCode, 'SOMMER20')
    assert.equal(persisted.drawerOpen, undefined)
  })

  it('sends no code once it is removed', () => {
    useCartStore.getState().clearPromoCode()
    const { items, promoCode } = useCartStore.getState()
    assert.equal(promoCode, null)
    assert.deepEqual(toCheckoutRequest(items, promoCode), {
      items: [{ variantId: '20', quantity: 2 }],
    })
  })
})
