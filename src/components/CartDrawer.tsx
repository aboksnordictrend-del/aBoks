'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { cartLineRef, useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/format'
import { trackBeginCheckout } from '@/lib/analytics'
import CartLine from '@/app/(frontend)/handlekurv/CartLine'
import CartRecommendations from '@/app/(frontend)/handlekurv/CartRecommendations'
import { type ProductTitlesBySlug } from '@/lib/cart/lineTitle'

/**
 * The slide-out cart — a second view of the one cart in @/store/cart, not a copy of it.
 *
 * Every line, quantity, price and total comes from that store, and the pieces that draw them
 * are the very components the /handlekurv page uses: `CartLine` for a line, and
 * `CartRecommendations` for «Passer godt sammen med». Nothing about the cart is re-implemented
 * here; this file owns the panel, its animation and its accessibility, and nothing else.
 *
 * Deliberately NOT here: the promo-code field. `usePromoCode` issues validation requests and
 * owns the applied code, and mounting a second copy of it on top of the cart page's would mean
 * two hooks racing over one code. An applied code is shown as a note instead and stays exactly
 * where it is applied — /handlekurv and the checkout, which is also where its trusted figures
 * are computed. The totals below are the cart's own, undiscounted, as they have always been
 * before a code is applied.
 *
 * Mounted once in the frontend layout. Its contents exist only while it is open, so a closed
 * drawer costs one boolean subscription and renders nothing at all — on the server too, which
 * is what keeps the client-only cart out of the hydrated HTML.
 */

interface Props {
  /** Slug → current product name, from the server. Same map the cart page is given. */
  productTitles?: ProductTitlesBySlug
}

/** Beyond this the release counts as "thrown", regardless of how far it travelled. */
const SWIPE_VELOCITY = 520
/** How far right the panel must be dragged to close on distance alone. Deliberately not twitchy. */
const SWIPE_DISTANCE = 120
/** A fast flick still has to have gone somewhere — this stops a stray tap from closing. */
const SWIPE_FLICK_DISTANCE = 44

/** Widest viewport that gets drag-to-close. Above it the drawer is a pointer surface. */
const TOUCH_MAX_WIDTH = '(max-width: 900px)'

const PANEL_BG = '#faf6ee'
const BORDER = '#e7e2d4'

export default function CartDrawer({ productTitles }: Props) {
  const open = useCartStore((s) => s.drawerOpen)
  const close = useCartStore((s) => s.closeCartDrawer)
  const items = useCartStore((s) => s.items)
  const promoCode = useCartStore((s) => s.promoCode)
  const removeItem = useCartStore((s) => s.removeItem)
  const incrementItem = useCartStore((s) => s.incrementItem)
  const decrementItem = useCartStore((s) => s.decrementItem)
  const subtotal = useCartStore((s) => s.subtotal)
  const shipping = useCartStore((s) => s.shipping)
  const orderTotal = useCartStore((s) => s.orderTotal)

  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  /** Whatever had focus when the drawer opened, so it can be handed back on close. */
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [canSwipe, setCanSwipe] = useState(false)

  // The store's computed helpers are read through the subscribed `items`, so these recompute
  // on every cart change — the same figures the cart page shows.
  const sub = subtotal()
  const shippingCost = shipping()
  const total = orderTotal()
  const hasCart = items.length > 0

  // Drag-to-close is a touch gesture. Enabled by viewport rather than by input type so a
  // desktop pointer never has to fight a draggable panel, and re-evaluated on rotation.
  useEffect(() => {
    const query = window.matchMedia(TOUCH_MAX_WIDTH)
    const sync = () => setCanSwipe(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Escape closes, from anywhere — the panel does not have to hold focus for it to work.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  /**
   * Scroll lock, with the scrollbar's width handed back as padding.
   *
   * Hiding the page's scrollbar widens the layout by its width, which on a desktop browser is
   * a visible jump of the whole page — exactly the shift the drawer's animation is supposed to
   * avoid. The fixed header is compensated too: it is out of flow, so body padding alone would
   * slide it out of step with the content beneath it. Both are restored verbatim on close.
   */
  useEffect(() => {
    if (!open) return
    const { body } = document
    const header = document.querySelector('header') as HTMLElement | null
    const gap = window.innerWidth - document.documentElement.clientWidth

    const savedOverflow = body.style.overflow
    const savedPadding = body.style.paddingRight
    const savedHeaderPadding = header?.style.paddingRight ?? ''

    body.style.overflow = 'hidden'
    if (gap > 0) {
      body.style.paddingRight = `${gap}px`
      if (header) header.style.paddingRight = `${gap}px`
    }

    return () => {
      body.style.overflow = savedOverflow
      body.style.paddingRight = savedPadding
      if (header) header.style.paddingRight = savedHeaderPadding
    }
  }, [open])

  // Focus: the close button on open, and back where it came from on close — but only if that
  // element is still on the page (a route change can take it away).
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const timer = setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 60)

    return () => {
      clearTimeout(timer)
      const previous = restoreFocusRef.current
      restoreFocusRef.current = null
      // preventScroll: closing must leave the page exactly where the customer left it — the
      // whole point of a drawer over a trip to the cart page.
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [open])

  // Following a link inside the drawer — «Gå til kassen», «Se handlekurven» — must leave the
  // drawer behind rather than land on the next page with it still open.
  useEffect(() => {
    close()
  }, [pathname, close])

  /** Tab and Shift+Tab stay inside the panel while it is modal. */
  const onPanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement)

    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const onDragEnd = useCallback(
    (_event: unknown, info: PanInfo) => {
      const far = info.offset.x > SWIPE_DISTANCE
      const flicked = info.velocity.x > SWIPE_VELOCITY && info.offset.x > SWIPE_FLICK_DISTANCE
      // Anything short of that and framer springs the panel back to x: 0 by itself.
      if (far || flicked) close()
    },
    [close],
  )

  return (
    <AnimatePresence>
      {open && (
        // Keyed so AnimatePresence tracks it as one presence: the backdrop and the panel
        // inside then run their own exit animations before the whole thing unmounts.
        <div key="cart-drawer" style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          {/* Backdrop — click closes. aria-hidden because the close button already says so
              to a screen reader, and an unlabelled clickable overlay would only add noise. */}
          <motion.div
            key="cart-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            onClick={close}
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, background: 'rgba(26,29,23,0.42)' }}
          />

          <motion.div
            key="cart-drawer-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Handlekurv"
            onKeyDown={onPanelKeyDown}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            // Horizontal only, and only rightwards: `dragConstraints` pins the left edge at
            // its resting place, `dragElastic` lets it follow the finger to the right. Framer
            // sets touch-action: pan-y for a horizontal drag, so vertical scrolling inside the
            // list is still the browser's own — the two gestures never compete.
            drag={canSwipe ? 'x' : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.9 }}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(440px, 100vw)',
              maxWidth: '100vw',
              background: PANEL_BG,
              boxShadow: '-18px 0 48px -22px rgba(42,36,24,.45)',
              display: 'flex',
              flexDirection: 'column',
              // The panel owns the full viewport height; only the list inside it scrolls.
              height: '100%',
            }}
          >
            {/* ── Header ─────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '20px 20px 16px',
                borderBottom: `1px solid ${BORDER}`,
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 600,
                  fontSize: '26px',
                  letterSpacing: '-0.015em',
                  color: '#1a1d17',
                  margin: 0,
                }}
              >
                Handlekurv
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Lukk handlekurven"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '999px',
                  background: '#fff',
                  border: `1px solid ${BORDER}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1a1d17',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* ── Lines + recommendations (the only scrolling area) ── */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                // `pan-y` gives the browser the vertical scroll and nothing else. Without it
                // this scroller allows horizontal panning it cannot perform, and Chrome turns
                // that into its own overscroll gesture: a swipe started over the list went
                // *back in history* instead of closing the drawer. `contain` keeps a scroll
                // that reaches the end of the list from chaining out to the page behind.
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                padding: '0 20px',
              }}
            >
              {hasCart ? (
                <>
                  {items.map((item) => {
                    const ref = cartLineRef(item)
                    return (
                      <CartLine
                        key={ref}
                        item={item}
                        productTitles={productTitles}
                        onDecrement={() => decrementItem(ref)}
                        onIncrement={() => incrementItem(ref)}
                        onRemove={() => removeItem(ref)}
                      />
                    )
                  })}

                  {/* The same cross-sell block as the cart page: same endpoint, same rules,
                      same ordinary `addItem`. Adding from here updates the lines above it in
                      place — the drawer never closes and reopens for it. Only the layout is
                      the drawer's own: `cartGrid` packs compact cards two to a row, so the
                      block costs a fraction of the height a column of full-width cards did
                      and the totals below stay a short scroll away. */}
                  <CartRecommendations layout="cartGrid" />

                  <div style={{ height: '20px' }} />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '56px 8px' }}>
                  <div
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '999px',
                      background: '#f2e7d7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px',
                      color: '#a99a76',
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="9" cy="20" r="1.1" />
                      <circle cx="18" cy="20" r="1.1" />
                      <path d="M2.2 3.2h2.1l2.3 11.8a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 6.3H5.3" />
                    </svg>
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-cormorant)',
                      fontWeight: 600,
                      fontSize: '24px',
                      color: '#1a1d17',
                      margin: '0 0 8px',
                    }}
                  >
                    Handlekurven din er tom
                  </p>
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63', margin: '0 0 24px' }}>
                    Finn din aBoks i favorittfargen.
                  </p>
                  <Link
                    href="/produkter"
                    data-btn
                    onClick={close}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '14px 30px',
                      borderRadius: '999px',
                      background: '#39402c',
                      color: '#faf6ee',
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 600,
                      fontSize: '15px',
                      textDecoration: 'none',
                    }}
                  >
                    Se produktene
                  </Link>
                </div>
              )}
            </div>

            {/* ── Summary + checkout ─────────────────────────── */}
            {hasCart && (
              <div
                style={{
                  flexShrink: 0,
                  borderTop: `1px solid ${BORDER}`,
                  background: '#fff',
                  padding: '18px 20px calc(18px + env(safe-area-inset-bottom))',
                  boxShadow: '0 -6px 20px -14px rgba(42,36,24,.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6f63' }}>Delsum</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', fontWeight: 600, color: '#1a1d17' }}>
                    {formatPrice(sub)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6f63' }}>Frakt</span>
                  {shippingCost === 0 ? (
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', fontWeight: 600, color: '#5f8253' }}>Gratis</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', fontWeight: 600, color: '#1a1d17' }}>
                      {formatPrice(shippingCost)}
                    </span>
                  )}
                </div>

                {shippingCost > 0 && (
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#6b6057', margin: '-6px 0 12px' }}>
                    Gratis frakt ved kjøp over kr 650
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    paddingTop: '12px',
                    borderTop: `1px solid ${BORDER}`,
                    marginBottom: '14px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', fontWeight: 700, color: '#1a1d17' }}>Totalt</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '19px', fontWeight: 700, color: '#1a1d17' }}>
                    {formatPrice(total)}
                  </span>
                </div>

                {/* An applied code is named, never recalculated here: the discount is a server
                    figure, and this panel has no trusted one to show. */}
                {promoCode && (
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12.5px', color: '#5f8253', margin: '-6px 0 12px' }}>
                    Rabattkode {promoCode} trekkes fra i kassen.
                  </p>
                )}

                <Link
                  href="/kasse"
                  data-btn
                  // The same event the cart page's own checkout button fires, from the same
                  // deliberate click. One click, one begin_checkout — the two buttons are
                  // alternatives to each other and are never pressed together.
                  onClick={() => trackBeginCheckout(items, total)}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    borderRadius: '999px',
                    background: '#39402c',
                    color: '#faf6ee',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    fontSize: '15px',
                    textDecoration: 'none',
                  }}
                >
                  Gå til kassen
                </Link>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginTop: '12px',
                  }}
                >
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-manrope)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: '#39402c',
                    }}
                  >
                    Fortsett å handle
                  </button>
                  <Link
                    href="/handlekurv"
                    style={{
                      fontFamily: 'var(--font-manrope)',
                      fontSize: '13.5px',
                      color: '#6b6f63',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                    }}
                  >
                    Se handlekurven
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
