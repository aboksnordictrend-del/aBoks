import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import RecommendationCard, {
  RECOMMENDATION_LABELS,
  type RecommendationCardLayout,
} from './RecommendationCard'
import {
  buildCartRecommendations,
  recommendationCartItem,
  resolveRecommendationVariant,
  type CartRecommendationCatalogue,
  type RecommendationProduct,
  type RecommendationVariant,
} from '@/lib/cart/recommendations'
import { formatPrice } from '@/lib/format'
import { cartLineTitle } from '@/lib/cart/lineTitle'
import type { CartItem } from '@/store/cart'

/**
 * The card the customer actually sees, and the round trip through the real cart store.
 *
 * The list-building rules are covered as pure functions in
 * @/lib/cart/recommendations.test.ts; these cover the two things that only show up once the
 * pieces are joined — what the markup offers to press, and that pressing it produces an
 * ordinary cart line which then removes the product from the list.
 *
 * The store is the project's own zustand store, imported after a minimal in-memory
 * `window.localStorage` is installed exactly as in @/store/cart.test.ts. Nothing here touches
 * a network or a database.
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

let useCartStore: typeof import('@/store/cart').useCartStore

before(async () => {
  const globals = globalThis as { window?: unknown; localStorage?: unknown }
  globals.localStorage = storage
  globals.window = { localStorage: storage }
  ;({ useCartStore } = await import('@/store/cart'))
})

function variant(overrides: Partial<RecommendationVariant> = {}): RecommendationVariant {
  return {
    id: overrides.id ?? 'v-sort',
    name: overrides.name ?? 'Sort',
    colorHex: overrides.colorHex ?? '#1a1d17',
    image: overrides.image ?? 'https://blob.example/sort.webp',
    inventory: overrides.inventory ?? 8,
  }
}

function product(overrides: Partial<RecommendationProduct> = {}): RecommendationProduct {
  const slug = overrides.slug ?? 'aboks-special'
  return {
    key: overrides.key ?? `products:${slug}`,
    collection: 'products',
    id: overrides.id ?? slug,
    title: overrides.title ?? 'aBoks Spesial',
    slug,
    href: overrides.href ?? `/produkter/${slug}`,
    section: overrides.section ?? 'products',
    image: overrides.image ?? 'https://blob.example/special.webp',
    imageAlt: overrides.imageAlt ?? 'aBoks Spesial',
    price: overrides.price ?? 649,
    compareAtPrice: overrides.compareAtPrice ?? null,
    // Defaults describe a product WITH colours, so every existing expectation here is
    // unchanged. A variant-less product is built with `hasVariants: false, variants: []`.
    hasVariants: overrides.hasVariants ?? true,
    variants: overrides.variants ?? [variant()],
    stock: overrides.stock ?? 0,
    defaultVariantId: overrides.defaultVariantId ?? null,
  }
}

const noop = () => {}

function card(props: {
  product: RecommendationProduct
  selectedVariantId?: string
  busy?: boolean
  layout?: RecommendationCardLayout
}): string {
  return renderToStaticMarkup(
    <RecommendationCard
      product={props.product}
      selectedVariantId={props.selectedVariantId}
      busy={props.busy ?? false}
      layout={props.layout}
      onSelectVariant={noop}
      onAdd={noop}
    />,
  )
}

describe('recommendation card', () => {
  it('shows the name, the price and an enabled «Legg til»', () => {
    const html = card({ product: product() })

    assert.ok(html.includes('aBoks Spesial'))
    // Through formatPrice, not a literal — it uses a non-breaking space, and the currency
    // formatting is not this component's to define.
    assert.ok(html.includes(formatPrice(649)))
    assert.ok(html.includes(RECOMMENDATION_LABELS.add))
    assert.ok(!html.includes('disabled'))
  })

  it('links the image and the name to the product page', () => {
    const html = card({ product: product({ slug: 'aboks-vegg' }) })
    const links = html.match(/href="\/produkter\/aboks-vegg"/g) ?? []
    assert.equal(links.length, 2)
  })

  it('uses the accessory’s own route data rather than assuming one', () => {
    const html = card({
      product: product({ slug: 'lokk', section: 'accessories', href: '/produkter/lokk' }),
    })
    assert.ok(html.includes('href="/produkter/lokk"'))
  })

  it('falls back to a tinted tile when the product has no image', () => {
    const html = card({ product: product({ image: '' }) })
    assert.ok(!html.includes('<img'))
    assert.ok(html.includes('#ede8db'))
    // The card is still complete and addable.
    assert.ok(html.includes(RECOMMENDATION_LABELS.add))
  })

  it('strikes through the ordinary price while a sale is running', () => {
    const html = card({ product: product({ price: 499, compareAtPrice: 649 }) })
    assert.ok(html.includes(formatPrice(499)))
    assert.ok(html.includes(formatPrice(649)))
    assert.match(html, /line-through/)
  })

  it('keeps the cart’s design system — olive pill, 999px radius, Manrope, Cormorant', () => {
    const html = card({ product: product() })
    assert.match(html, /border-radius:999px/)
    assert.match(html, /background:#39402c/)
    assert.match(html, /var\(--font-manrope\)/)
    assert.match(html, /var\(--font-cormorant\)/)
  })

  it('says «Lagt til» and goes inert right after a successful add', () => {
    const html = card({ product: product(), busy: true })
    assert.ok(html.includes(RECOMMENDATION_LABELS.added))
    assert.match(html, /disabled/)
    assert.match(html, /aria-busy="true"/)
    // Greyed rather than olive, the same disabled colour the product page uses.
    assert.match(html, /background:#c8c0b0/)
  })
})

describe('recommendation card — products with several variants', () => {
  const multi = product({
    slug: 'aboks',
    title: 'aBoks',
    variants: [
      variant({ id: 'v-sort', name: 'Sort', colorHex: '#1a1d17' }),
      variant({ id: 'v-oliven', name: 'Olivengrønn', colorHex: '#5b6347' }),
    ],
  })

  it('names the single colour when there is only one', () => {
    const html = card({ product: product({ variants: [variant({ name: 'Sort' })] }) })
    assert.ok(html.includes('Sort'))
    assert.ok(!html.includes(RECOMMENDATION_LABELS.chooseVariant))
  })

  it('offers the colours inline instead of a random pick', () => {
    const html = card({ product: multi })

    assert.ok(html.includes('aria-label="Sort"'))
    assert.ok(html.includes('aria-label="Olivengrønn"'))
    assert.ok(html.includes('#5b6347'))
    // Nothing is addable until one is chosen.
    assert.ok(html.includes(RECOMMENDATION_LABELS.chooseVariant))
    assert.match(html, /disabled/)
    assert.equal(resolveRecommendationVariant(multi), null)
  })

  it('enables «Legg til» once a colour is picked, and marks it as pressed', () => {
    const html = card({ product: multi, selectedVariantId: 'v-oliven' })

    assert.ok(html.includes(RECOMMENDATION_LABELS.add))
    assert.ok(!html.includes('disabled'))
    assert.ok(html.includes('aria-pressed="true"'))
    assert.ok(html.includes('Olivengrønn'))
    assert.equal(resolveRecommendationVariant(multi, 'v-oliven')?.id, 'v-oliven')
  })
})

describe('adding a recommendation to the real cart store', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], promoCode: null })
  })

  const special = product()

  it('writes an ordinary cart line — same shape the product page produces', () => {
    const chosen = special.variants[0]
    const payload = recommendationCartItem(special, chosen)

    useCartStore.getState().addItem(payload, 1)

    const [item] = useCartStore.getState().items
    assert.deepEqual(item, {
      variantId: 'v-sort',
      // Carried alongside the variant so a line always knows both halves of its identity.
      // For a variant line the variant is still what identifies it — see cartLineRef.
      productId: 'aboks-special',
      productSlug: 'aboks-special',
      productTitle: 'aBoks Spesial',
      colorName: 'Sort',
      colorHex: '#1a1d17',
      colorImage: 'https://blob.example/sort.webp',
      price: 649,
      qty: 1,
    } satisfies CartItem)
  })

  it('carries the recommendation’s real product title onto the cart line', () => {
    // Distinct variant ids, or the store would merge them into a single line.
    const vegg = product({
      slug: 'aboks-vegg',
      title: 'aBoks Vegg',
      variants: [variant({ id: 'v-vegg' })],
    })
    const accessory = product({
      slug: 'kabelholder',
      title: 'Kabelholder',
      section: 'accessories',
      variants: [variant({ id: 'v-kabel' })],
    })

    useCartStore.getState().addItem(recommendationCartItem(vegg, vegg.variants[0]), 1)
    useCartStore.getState().addItem(recommendationCartItem(accessory, accessory.variants[0]), 1)

    const titles = useCartStore.getState().items.map((i) => cartLineTitle(i))
    assert.deepEqual(titles, ['aBoks Vegg', 'Kabelholder'])
    // Not one of them is the generic brand name, and none has the colour folded in.
    for (const title of titles) assert.ok(!title.includes('Sort'))
  })

  it('adds the chosen variant, not the first one', () => {
    const multi = product({
      slug: 'aboks',
      variants: [variant({ id: 'v-sort', name: 'Sort' }), variant({ id: 'v-oliven', name: 'Olivengrønn' })],
    })
    const chosen = resolveRecommendationVariant(multi, 'v-oliven')
    assert.ok(chosen)

    useCartStore.getState().addItem(recommendationCartItem(multi, chosen), 1)

    const [item] = useCartStore.getState().items
    assert.equal(item.variantId, 'v-oliven')
    assert.equal(item.colorName, 'Olivengrønn')
  })

  it('updates the totals and the free-shipping threshold immediately', () => {
    const store = useCartStore.getState()
    store.addItem(recommendationCartItem(product({ slug: 'liten', price: 200 }), variant({ id: 'a' })), 1)

    assert.equal(useCartStore.getState().subtotal(), 200)
    assert.equal(useCartStore.getState().shipping(), 69)

    useCartStore.getState().addItem(recommendationCartItem(special, variant({ id: 'b' })), 1)

    assert.equal(useCartStore.getState().subtotal(), 849)
    // Past kr 650, so shipping is now free — recomputed from the cart, not from this block.
    assert.equal(useCartStore.getState().shipping(), 0)
    assert.equal(useCartStore.getState().orderTotal(), 849)
  })

  it('keeps the card in the list after it has been used', () => {
    const vegg = product({
      slug: 'aboks-vegg',
      title: 'aBoks Vegg',
      variants: [variant({ id: 'v-vegg', name: 'Hvit', colorHex: '#f2efe6' })],
    })
    const catalogue: CartRecommendationCatalogue = {
      recommendationsBySlug: { aboks: [special.key, vegg.key] },
      products: { [special.key]: special, [vegg.key]: vegg },
    }

    useCartStore
      .getState()
      .addItem(
        { variantId: 'v-aboks', productSlug: 'aboks', colorName: 'Sort', colorHex: '#1a1d17', colorImage: '', price: 499 },
        1,
      )

    const before = buildCartRecommendations(useCartStore.getState().items, catalogue)
    assert.deepEqual(before.map((p) => p.slug), ['aboks-special', 'aboks-vegg'])

    // The customer presses «Legg til» on the first card — both cards are still there.
    useCartStore.getState().addItem(recommendationCartItem(special, special.variants[0]), 1)

    const after = buildCartRecommendations(useCartStore.getState().items, catalogue)
    assert.deepEqual(after.map((p) => p.slug), ['aboks-special', 'aboks-vegg'])
  })

  it('lets the customer add a second colour from the same card', () => {
    const multi = product({
      slug: 'aboks-vegg',
      variants: [
        variant({ id: 'v-sort', name: 'Sort' }),
        variant({ id: 'v-oliven', name: 'Olivengrønn' }),
      ],
    })
    const catalogue: CartRecommendationCatalogue = {
      recommendationsBySlug: { aboks: [multi.key] },
      products: { [multi.key]: multi },
    }
    useCartStore
      .getState()
      .addItem(
        { variantId: 'v-aboks', productSlug: 'aboks', colorName: 'Sort', colorHex: '#1a1d17', colorImage: '', price: 499 },
        1,
      )

    const sort = resolveRecommendationVariant(multi, 'v-sort')!
    useCartStore.getState().addItem(recommendationCartItem(multi, sort), 1)

    // Still on screen, and still offering both colours.
    const stillThere = buildCartRecommendations(useCartStore.getState().items, catalogue)
    assert.deepEqual(stillThere.map((p) => p.slug), ['aboks-vegg'])

    // The customer picks the other colour and adds that too.
    const oliven = resolveRecommendationVariant(stillThere[0], 'v-oliven')!
    useCartStore.getState().addItem(recommendationCartItem(multi, oliven), 1)

    const lines = useCartStore.getState().items.filter((i) => i.productSlug === 'aboks-vegg')
    assert.deepEqual(lines.map((i) => `${i.variantId}x${i.qty}`), ['v-sortx1', 'v-olivenx1'])
    // And the card has not gone anywhere.
    assert.deepEqual(
      buildCartRecommendations(useCartStore.getState().items, catalogue).map((p) => p.slug),
      ['aboks-vegg'],
    )
  })

  it('increments the quantity when the same variant is added again', () => {
    // The store's ordinary behaviour, which the card now relies on: a deliberate second add
    // of the same colour bumps the line. CartRecommendations still holds a synchronous
    // in-flight ref so that one *click* cannot do this by accident.
    const payload = recommendationCartItem(special, special.variants[0])
    useCartStore.getState().addItem(payload, 1)
    useCartStore.getState().addItem(payload, 1)

    assert.equal(useCartStore.getState().items.length, 1)
    assert.equal(useCartStore.getState().items[0].qty, 2)
  })
})

describe('recommendation card — the drawer’s two-up «cartGrid» layout', () => {
  const multi = product({
    slug: 'aboks',
    title: 'aBoks',
    variants: [
      variant({ id: 'v-sort', name: 'Sort', colorHex: '#1a1d17' }),
      variant({ id: 'v-oliven', name: 'Olivengrønn', colorHex: '#5b6347' }),
      variant({ id: 'v-sand', name: 'Sand', colorHex: '#d8cdb4' }),
      variant({ id: 'v-hvit', name: 'Hvit', colorHex: '#f2efe6' }),
    ],
  })

  it('offers exactly what the full-width card does', () => {
    const html = card({ product: product(), layout: 'cartGrid' })

    assert.ok(html.includes('aBoks Spesial'))
    assert.ok(html.includes(formatPrice(649)))
    assert.ok(html.includes(RECOMMENDATION_LABELS.add))
    assert.ok(!html.includes('disabled'))
    assert.ok(html.includes('href="/produkter/aboks-special"'))
  })

  it('shows the product’s own title, untouched and unabbreviated', () => {
    const long = product({ title: 'aBoks Spesial Oppbevaring for AA- og AAA-batterier' })
    assert.ok(card({ product: long, layout: 'cartGrid' }).includes(long.title))
  })

  it('stacks the image above the text at a square ratio, so two cards match', () => {
    const html = card({ product: product(), layout: 'cartGrid' })
    assert.match(html, /flex-direction:column/)
    assert.match(html, /aspect-ratio:1 \/ 1/)
    // No fixed 64px tile — the image is as wide as the card it sits in.
    assert.ok(!html.includes('width:64px'))
  })

  it('clamps the name to two lines and lets nothing spill out of the track', () => {
    const html = card({ product: product(), layout: 'cartGrid' })
    assert.match(html, /-webkit-line-clamp:2/)
    assert.match(html, /overflow-wrap:anywhere/)
    assert.match(html, /min-width:0/)
  })

  it('pins the CTA to the bottom edge so neighbours line up', () => {
    const html = card({ product: product(), layout: 'cartGrid' })
    assert.match(html, /margin-top:auto/)
    assert.match(html, /height:100%/)
  })

  it('keeps the cart’s design system at the smaller size', () => {
    const html = card({ product: product(), layout: 'cartGrid' })
    assert.match(html, /border-radius:999px/)
    assert.match(html, /background:#39402c/)
    assert.match(html, /var\(--font-manrope\)/)
    assert.match(html, /var\(--font-cormorant\)/)
  })

  it('still asks for a colour first, and still takes all four swatches', () => {
    const html = card({ product: multi, layout: 'cartGrid' })

    for (const option of multi.variants) assert.ok(html.includes(`aria-label="${option.name}"`))
    assert.ok(html.includes(RECOMMENDATION_LABELS.chooseVariant))
    assert.match(html, /disabled/)
    // Smaller than the full-width card's 26px, and none of them may be squeezed.
    assert.match(html, /width:18px;height:18px/)
    assert.match(html, /flex-shrink:0/)
  })

  it('enables «Legg til» once a colour is picked, exactly as the wide card does', () => {
    const html = card({ product: multi, selectedVariantId: 'v-sand', layout: 'cartGrid' })

    assert.ok(html.includes(RECOMMENDATION_LABELS.add))
    assert.ok(!html.includes('disabled'))
    assert.ok(html.includes('aria-pressed="true"'))
    assert.ok(html.includes('Sand'))
  })

  it('confirms with «Lagt til» and goes inert, as before', () => {
    const html = card({ product: product(), busy: true, layout: 'cartGrid' })
    assert.ok(html.includes(RECOMMENDATION_LABELS.added))
    assert.match(html, /aria-busy="true"/)
    assert.match(html, /background:#c8c0b0/)
  })

  it('leaves the cart page’s card exactly as it was', () => {
    // The default layout is what /handlekurv renders, and nothing above may have reached it:
    // still a 64px tile beside the name, still no bottom-pinned button.
    const html = card({ product: product() })
    assert.match(html, /width:64px;height:64px/)
    assert.ok(!html.includes('aspect-ratio'))
    assert.ok(!html.includes('margin-top:auto'))
    assert.ok(!html.includes('height:100%'))
    // And still the full-size swatches, not the drawer's 18px ones.
    assert.match(card({ product: multi }), /width:26px;height:26px/)
  })
})
