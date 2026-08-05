import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCartRecommendations,
  cartRecommendationSlugs,
  CART_RECOMMENDATION_LIMIT,
  isAddableRecommendation,
  normalizeRecommendationRefs,
  recommendationKey,
  resolveRecommendationVariant,
  type CartRecommendationCatalogue,
  type CartRecommendationLine,
  type RecommendationProduct,
  type RecommendationVariant,
} from './recommendations'

/**
 * Pure-function tests for the cart cross-sell list. No network, no database, no React —
 * every input is a plain object built by the helpers below.
 */

function variant(overrides: Partial<RecommendationVariant> = {}): RecommendationVariant {
  return {
    id: overrides.id ?? 'v1',
    name: overrides.name ?? 'Sort',
    colorHex: overrides.colorHex ?? '#1a1d17',
    image: overrides.image ?? 'https://blob.example/sort.webp',
    inventory: overrides.inventory ?? 12,
  }
}

function product(
  slug: string,
  overrides: Partial<RecommendationProduct> = {},
): RecommendationProduct {
  const id = overrides.id ?? slug
  const collection = overrides.collection ?? 'products'
  return {
    key: overrides.key ?? recommendationKey(collection, id),
    collection,
    id,
    title: overrides.title ?? slug,
    slug,
    href: overrides.href ?? `/produkter/${slug}`,
    section: overrides.section ?? 'products',
    image: overrides.image ?? 'https://blob.example/p.webp',
    imageAlt: overrides.imageAlt ?? slug,
    price: overrides.price ?? 499,
    compareAtPrice: overrides.compareAtPrice ?? null,
    variants: overrides.variants ?? [variant()],
    defaultVariantId: overrides.defaultVariantId ?? null,
  }
}

/** Builds a catalogue from `slug → recommended products`, in the given order. */
function catalogue(
  wiring: Record<string, RecommendationProduct[]>,
  extra: RecommendationProduct[] = [],
): CartRecommendationCatalogue {
  const products: Record<string, RecommendationProduct> = {}
  const recommendationsBySlug: Record<string, string[]> = {}
  for (const [slug, list] of Object.entries(wiring)) {
    recommendationsBySlug[slug] = list.map((item) => item.key)
    for (const item of list) products[item.key] = item
  }
  for (const item of extra) products[item.key] = item
  return { recommendationsBySlug, products }
}

function line(productSlug: string, variantId = `${productSlug}-v1`): CartRecommendationLine {
  return { productSlug, variantId }
}

function slugsOf(list: RecommendationProduct[]): string[] {
  return list.map((item) => item.slug)
}

describe('normalizeRecommendationRefs', () => {
  it('reads bare ids, populated documents and polymorphic entries alike', () => {
    const refs = normalizeRecommendationRefs([
      7,
      '8',
      { id: 9, title: 'populated' },
      { relationTo: 'products', value: 10 },
      { relationTo: 'accessories', value: { id: 11 } },
    ])

    assert.deepEqual(refs, [
      { relationTo: 'products', value: '7' },
      { relationTo: 'products', value: '8' },
      { relationTo: 'products', value: '9' },
      { relationTo: 'products', value: '10' },
      { relationTo: 'accessories', value: '11' },
    ])
  })

  it('drops nulls and unusable entries instead of guessing', () => {
    assert.deepEqual(normalizeRecommendationRefs([null, undefined, {}, '', true, 5]), [
      { relationTo: 'products', value: '5' },
    ])
  })

  it('returns an empty list for a field that was never set', () => {
    assert.deepEqual(normalizeRecommendationRefs(undefined), [])
    assert.deepEqual(normalizeRecommendationRefs(null), [])
  })
})

describe('buildCartRecommendations — merging', () => {
  it('merges the recommendations of several cart items, first cart item first', () => {
    const special = product('aboks-special')
    const vegg = product('aboks-vegg')
    const stroem = product('aboks-lader')

    const result = buildCartRecommendations(
      [line('aboks'), line('aboks-mini')],
      catalogue({ aboks: [special, vegg], 'aboks-mini': [stroem] }),
    )

    assert.deepEqual(slugsOf(result), ['aboks-special', 'aboks-vegg', 'aboks-lader'])
  })

  it('keeps the order configured in the admin within each cart item', () => {
    const a = product('a')
    const b = product('b')
    const c = product('c')

    const forwards = buildCartRecommendations([line('aboks')], catalogue({ aboks: [a, b, c] }))
    const backwards = buildCartRecommendations([line('aboks')], catalogue({ aboks: [c, b, a] }))

    assert.deepEqual(slugsOf(forwards), ['a', 'b', 'c'])
    assert.deepEqual(slugsOf(backwards), ['c', 'b', 'a'])
  })

  it('considers a product once however many lines of it are in the cart', () => {
    const special = product('aboks-special')
    const result = buildCartRecommendations(
      [line('aboks', 'sort'), line('aboks', 'olive'), line('aboks', 'bla')],
      catalogue({ aboks: [special] }),
    )
    assert.deepEqual(slugsOf(result), ['aboks-special'])
  })
})

describe('buildCartRecommendations — de-duplication', () => {
  it('shows a product recommended by two cart items only once, at its first position', () => {
    const shared = product('aboks-special')
    const vegg = product('aboks-vegg')

    const result = buildCartRecommendations(
      [line('aboks'), line('aboks-mini')],
      catalogue({ aboks: [shared, vegg], 'aboks-mini': [shared] }),
    )

    assert.deepEqual(slugsOf(result), ['aboks-special', 'aboks-vegg'])
  })

  it('treats the same id in two collections as two different documents', () => {
    // The polymorphic case the key format exists for: id 7 in each of two collections.
    const fromProducts = product('sort-boks', { id: '7', collection: 'products' })
    const fromAccessories = product('sort-lokk', { id: '7', collection: 'accessories' })

    assert.notEqual(fromProducts.key, fromAccessories.key)

    const result = buildCartRecommendations(
      [line('aboks')],
      catalogue({ aboks: [fromProducts, fromAccessories] }),
    )

    assert.deepEqual(slugsOf(result), ['sort-boks', 'sort-lokk'])
  })

  it('would collapse the two if only the id were keyed — guards the key format', () => {
    const fromProducts = product('sort-boks', { id: '7', collection: 'products' })
    const fromAccessories = product('sort-lokk', { id: '7', collection: 'accessories' })
    assert.equal(fromProducts.id, fromAccessories.id)
    assert.deepEqual(
      [fromProducts.key, fromAccessories.key],
      ['products:7', 'accessories:7'],
    )
  })
})

describe('buildCartRecommendations — a product already in the cart stays visible', () => {
  it('keeps recommending a product the customer has already added', () => {
    // The whole point of the change: owning one aBoks Vegg is a reason to be offered
    // another colour of it, not a reason to hide the card.
    const vegg = product('aboks-vegg')
    const special = product('aboks-special')

    const result = buildCartRecommendations(
      [line('aboks'), line('aboks-vegg')],
      catalogue({ aboks: [vegg, special], 'aboks-vegg': [] }),
    )

    assert.deepEqual(slugsOf(result), ['aboks-vegg', 'aboks-special'])
  })

  it('keeps a multi-variant recommendation visible after one colour has been added', () => {
    const multi = product('aboks-vegg', {
      variants: [variant({ id: 'v-sort', name: 'Sort' }), variant({ id: 'v-oliven', name: 'Oliven' })],
    })
    const data = catalogue({ aboks: [multi] })

    const before = buildCartRecommendations([line('aboks')], data)
    assert.deepEqual(slugsOf(before), ['aboks-vegg'])

    // The customer adds the Sort colour from the card.
    const after = buildCartRecommendations([line('aboks'), line('aboks-vegg', 'v-sort')], data)

    assert.deepEqual(slugsOf(after), ['aboks-vegg'])
    // …and the other colour is still there to be chosen and added.
    assert.deepEqual(
      after[0].variants.map((v) => v.id),
      ['v-sort', 'v-oliven'],
    )
    assert.equal(resolveRecommendationVariant(after[0], 'v-oliven')?.name, 'Oliven')
  })

  it('does not exclude a product because one of its variants is on a cart line', () => {
    const special = product('aboks-special', { variants: [variant({ id: 'variant-42' })] })

    const result = buildCartRecommendations(
      [line('aboks', 'variant-42')],
      catalogue({ aboks: [special] }),
    )

    assert.deepEqual(slugsOf(result), ['aboks-special'])
  })
})

describe('buildCartRecommendations — exclusions', () => {
  it('never recommends the source product itself', () => {
    const itself = product('aboks')
    const special = product('aboks-special')

    const result = buildCartRecommendations(
      [line('aboks')],
      catalogue({ aboks: [itself, special] }),
    )

    assert.deepEqual(slugsOf(result), ['aboks-special'])
  })

  it('drops the self-reference only for the product that made it', () => {
    // aboks recommends itself (dropped) and aboks-vegg; aboks-vegg recommends aboks — which
    // is in the cart but is not aboks-vegg's own slug, so it is shown.
    const aboks = product('aboks')
    const vegg = product('aboks-vegg')

    const result = buildCartRecommendations(
      [line('aboks'), line('aboks-vegg')],
      catalogue({ aboks: [aboks, vegg], 'aboks-vegg': [aboks] }),
    )

    assert.deepEqual(slugsOf(result), ['aboks-vegg', 'aboks'])
  })

  it('skips a recommendation that is no longer in the catalogue', () => {
    // Deleted or unpublished: the key is still configured, the document is not sent.
    const present = product('aboks-vegg')
    const base = catalogue({ aboks: [present] })
    base.recommendationsBySlug.aboks = ['products:deleted', ...base.recommendationsBySlug.aboks]

    assert.deepEqual(slugsOf(buildCartRecommendations([line('aboks')], base)), ['aboks-vegg'])
  })

  it('skips products without a usable price or an addable variant', () => {
    const free = product('uten-pris', { price: 0 })
    const soldOut = product('utsolgt', { variants: [] })
    const fine = product('ok')

    const result = buildCartRecommendations(
      [line('aboks')],
      catalogue({ aboks: [free, soldOut, fine] }),
    )

    assert.deepEqual(slugsOf(result), ['ok'])
  })

  it('keeps a product that merely has no image — the card has a placeholder', () => {
    const noImage = product('uten-bilde', { image: '' })
    const result = buildCartRecommendations([line('aboks')], catalogue({ aboks: [noImage] }))
    assert.deepEqual(slugsOf(result), ['uten-bilde'])
  })
})

describe('buildCartRecommendations — limit and empty results', () => {
  it('shows at most four, in order', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((slug) => product(slug))

    const result = buildCartRecommendations([line('aboks')], catalogue({ aboks: six }))

    assert.equal(CART_RECOMMENDATION_LIMIT, 4)
    assert.equal(result.length, 4)
    assert.deepEqual(slugsOf(result), ['a', 'b', 'c', 'd'])
  })

  it('stops at the limit across several cart items', () => {
    const first = ['a', 'b', 'c'].map((slug) => product(slug))
    const second = ['d', 'e'].map((slug) => product(slug))

    const result = buildCartRecommendations(
      [line('aboks'), line('aboks-mini')],
      catalogue({ aboks: first, 'aboks-mini': second }),
    )

    assert.deepEqual(slugsOf(result), ['a', 'b', 'c', 'd'])
  })

  it('returns nothing for an empty cart, so the block is not rendered', () => {
    assert.deepEqual(buildCartRecommendations([], catalogue({ aboks: [product('x')] })), [])
  })

  it('returns nothing when the field is empty, or the catalogue missing', () => {
    assert.deepEqual(buildCartRecommendations([line('aboks')], catalogue({ aboks: [] })), [])
    assert.deepEqual(buildCartRecommendations([line('aboks')], null), [])
    assert.deepEqual(buildCartRecommendations([line('ukjent')], catalogue({ aboks: [product('x')] })), [])
  })

  it('reflects a change in cart contents on the next call', () => {
    const vegg = product('aboks-vegg')
    const special = product('aboks-special')
    const data = catalogue({ aboks: [vegg, special], 'aboks-vegg': [special] })

    const before = buildCartRecommendations([line('aboks')], data)
    assert.deepEqual(slugsOf(before), ['aboks-vegg', 'aboks-special'])

    // The customer adds aboks-vegg from the block — the card stays exactly where it was.
    const afterAdd = buildCartRecommendations([line('aboks'), line('aboks-vegg')], data)
    assert.deepEqual(slugsOf(afterAdd), ['aboks-vegg', 'aboks-special'])

    // Removing the source product is what retires its suggestions: aboks-vegg is gone from
    // the list because nothing in the cart recommends it any more, while aboks-special
    // survives — the remaining cart product recommends it too.
    const afterRemove = buildCartRecommendations([line('aboks-vegg')], data)
    assert.deepEqual(slugsOf(afterRemove), ['aboks-special'])
  })

  it('retires a recommendation only when no cart product still suggests it', () => {
    const special = product('aboks-special')
    const data = catalogue({ aboks: [special], 'aboks-mini': [special] })

    // Both cart products suggest it; removing one is not enough to retire it.
    assert.deepEqual(
      slugsOf(buildCartRecommendations([line('aboks'), line('aboks-mini')], data)),
      ['aboks-special'],
    )
    assert.deepEqual(slugsOf(buildCartRecommendations([line('aboks-mini')], data)), ['aboks-special'])
    // With neither left, it is gone.
    assert.deepEqual(buildCartRecommendations([line('annet')], data), [])
  })
})

describe('resolveRecommendationVariant', () => {
  it('resolves a single-variant product without a choice', () => {
    const single = product('aboks-vegg', { variants: [variant({ id: 'only' })] })
    assert.equal(resolveRecommendationVariant(single)?.id, 'only')
  })

  it('refuses to guess when a product has several variants', () => {
    const many = product('aboks', {
      variants: [variant({ id: 'sort' }), variant({ id: 'olive', name: 'Oliven' })],
    })
    assert.equal(resolveRecommendationVariant(many), null)
  })

  it('uses the customer’s pick, and ignores one that no longer exists', () => {
    const many = product('aboks', {
      variants: [variant({ id: 'sort' }), variant({ id: 'olive', name: 'Oliven' })],
    })
    assert.equal(resolveRecommendationVariant(many, 'olive')?.name, 'Oliven')
    assert.equal(resolveRecommendationVariant(many, 'borte'), null)
  })

  it('honours an explicit default variant', () => {
    const many = product('aboks', {
      variants: [variant({ id: 'sort' }), variant({ id: 'olive' })],
      defaultVariantId: 'olive',
    })
    assert.equal(resolveRecommendationVariant(many)?.id, 'olive')
  })
})

describe('isAddableRecommendation / cartRecommendationSlugs', () => {
  it('rejects missing, priceless, nameless and sold-out products', () => {
    assert.equal(isAddableRecommendation(null), false)
    assert.equal(isAddableRecommendation(product('a', { price: 0 })), false)
    assert.equal(isAddableRecommendation(product('a', { price: Number.NaN })), false)
    assert.equal(isAddableRecommendation(product('a', { title: '' })), false)
    assert.equal(isAddableRecommendation(product('a', { variants: [] })), false)
    assert.equal(isAddableRecommendation(product('a')), true)
  })

  it('lists the cart’s product slugs once each, in cart order', () => {
    assert.deepEqual(
      cartRecommendationSlugs([line('aboks', 'a'), line('aboks-vegg'), line('aboks', 'b')]),
      ['aboks', 'aboks-vegg'],
    )
    assert.deepEqual(cartRecommendationSlugs([]), [])
  })
})
