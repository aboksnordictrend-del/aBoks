'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCartStore } from '@/store/cart'
import { trackAddToCart } from '@/lib/analytics'
import RecommendationCard from './RecommendationCard'
import {
  buildCartRecommendations,
  cartRecommendationSlugs,
  needsVariantChoice,
  recommendationCartItem,
  resolveRecommendationVariant,
  type CartRecommendationCatalogue,
  type RecommendationProduct,
} from '@/lib/cart/recommendations'

/**
 * «Passer godt sammen med» — the cross-sell block under the cart lines.
 *
 * Renders nothing at all unless there is something to show: no cart, no catalogue, or an
 * empty result all produce `null`, so the cart looks exactly as it did before whenever no
 * recommendations are configured in Payload.
 *
 * Adding goes through the ordinary cart store — the same `addItem` the product page calls,
 * with the same `CartItem` shape — so the summary, the free-shipping threshold and the promo
 * revalidation all update by themselves, with no page reload and no second cart format.
 *
 * A card stays put after it is used. It confirms with «Lagt til», returns to «Legg til», and
 * remains available — so a customer can add a second colour of the same product, or simply a
 * second one, straight from the block. What makes a card leave the list is the cart product
 * that suggested it leaving, or the product itself becoming unsellable; never the customer's
 * own click on it.
 *
 * Nothing renders on the server (the list is empty until the effect below has run), so the
 * client-only cart state cannot produce a hydration mismatch here.
 */

export const CART_RECOMMENDATIONS_HEADING = 'Passer godt sammen med'

const ENDPOINT = '/api/cart/recommendations'

/**
 * How long the button reads «Lagt til» before returning to «Legg til».
 *
 * Long enough to register as confirmation, short enough that a customer who wants a second
 * colour is not left waiting on a disabled button. The card itself never goes anywhere.
 */
const CONFIRMATION_MS = 1400

/** Cheap shape check on the response — a malformed body degrades to "no recommendations". */
function isCatalogue(value: unknown): value is CartRecommendationCatalogue {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CartRecommendationCatalogue>
  return (
    !!candidate.recommendationsBySlug &&
    typeof candidate.recommendationsBySlug === 'object' &&
    !!candidate.products &&
    typeof candidate.products === 'object'
  )
}

export default function CartRecommendations() {
  const items = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)

  const [catalogue, setCatalogue] = useState<CartRecommendationCatalogue | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [busyKeys, setBusyKeys] = useState<string[]>([])

  /**
   * Synchronous double-click guard. `busyKeys` drives the button's disabled state, but React
   * state is applied asynchronously, so two clicks inside one tick would both pass a state
   * check and add the item twice. This ref is updated immediately and is what actually decides.
   */
  const inFlight = useRef<Set<string>>(new Set())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const slugs = useMemo(() => cartRecommendationSlugs(items), [items])
  const slugKey = slugs.join(',')

  // Fetch only once there is a cart, and only when the set of products in it changes —
  // quantity changes and promo edits do not re-request. An empty cart never fetches at all.
  useEffect(() => {
    if (!slugKey) {
      setCatalogue(null)
      return
    }

    const controller = new AbortController()

    fetch(`${ENDPOINT}?slugs=${encodeURIComponent(slugKey)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        // The previous catalogue is kept on failure rather than cleared, so a flaky request
        // never makes a block that is already on screen flicker away.
        if (isCatalogue(body)) setCatalogue(body)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [slugKey])

  const visible = useMemo(() => buildCartRecommendations(items, catalogue), [items, catalogue])

  /**
   * Ends a card's confirmation window early, and re-arms it.
   *
   * Called when the customer picks a different colour on a card they have just used: that is
   * a fresh, deliberate intent, not the accidental second click the guard exists to absorb,
   * so making them wait out the timer would be pure friction.
   */
  const clearConfirmation = useCallback((key: string) => {
    inFlight.current.delete(key)
    setBusyKeys((keys) => (keys.includes(key) ? keys.filter((busy) => busy !== key) : keys))
  }, [])

  const handleAdd = useCallback(
    (product: RecommendationProduct) => {
      if (inFlight.current.has(product.key)) return

      const variant = resolveRecommendationVariant(product, selectedVariants[product.key])
      // A colour is still owed only when the product has colours. One that has none adds
      // straight away, as itself — no placeholder variant is ever invented for it.
      if (needsVariantChoice(product, selectedVariants[product.key])) return

      inFlight.current.add(product.key)
      setBusyKeys((keys) => [...keys, product.key])

      // The one and only cart write — the store's ordinary add, quantity 1. Adding a line
      // that is already in the cart increments it, exactly as the product page does.
      addItem(recommendationCartItem(product, variant), 1)

      trackAddToCart({
        variantId: variant?.id ?? product.id,
        variantName: variant?.name ?? '',
        productTitle: product.title,
        price: product.price,
        quantity: 1,
      })

      // Back to «Legg til» afterwards — the card stays exactly where it is.
      const timer = setTimeout(() => clearConfirmation(product.key), CONFIRMATION_MS)
      timers.current.push(timer)
    },
    [addItem, clearConfirmation, selectedVariants],
  )

  if (visible.length === 0) return null

  return (
    <section
      aria-labelledby="cart-recommendations-heading"
      style={{
        marginTop: 'clamp(32px,4vw,44px)',
        paddingTop: 'clamp(24px,3vw,32px)',
        borderTop: '1px solid #e7e2d4',
      }}
    >
      <h2
        id="cart-recommendations-heading"
        style={{
          fontFamily: 'var(--font-cormorant)',
          fontWeight: 600,
          fontSize: 'clamp(24px,2.4vw,30px)',
          letterSpacing: '-0.015em',
          lineHeight: 1.1,
          color: '#1a1d17',
          margin: '0 0 18px',
        }}
      >
        {CART_RECOMMENDATIONS_HEADING}
      </h2>

      <div
        style={{
          display: 'grid',
          // One column on a phone, two once the cart column is wide enough. The
          // `min(100%, …)` floor keeps a narrow viewport from forcing a track wider than
          // the column — which is what would put a horizontal scrollbar on the page.
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 236px), 1fr))',
          gap: '14px',
        }}
      >
        {visible.map((product) => (
          <RecommendationCard
            key={product.key}
            product={product}
            selectedVariantId={selectedVariants[product.key]}
            busy={busyKeys.includes(product.key)}
            onSelectVariant={(variantId) => {
              // The pick is kept as the card's state; changing it also ends any confirmation
              // still showing, so the next colour can be added straight away.
              setSelectedVariants((current) => ({ ...current, [product.key]: variantId }))
              clearConfirmation(product.key)
            }}
            onAdd={() => handleAdd(product)}
          />
        ))}
      </div>
    </section>
  )
}
