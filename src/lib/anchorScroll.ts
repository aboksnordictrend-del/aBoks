/**
 * In-page anchor scrolling that stays accurate while the fixed header changes state.
 *
 * `html { scroll-behavior: smooth }` in `globals.css` means a plain `<a href="#id">` is
 * scrolled by the browser. A native smooth scroll picks its destination once, when the
 * click happens, and then flies to that frozen number no matter what moves underneath it.
 *
 * On a hero-top route the header is transparent and (from `lg`) still showing its trust
 * bar at the moment of the click, and flips into the shorter blurred sticky bar a frame
 * later — see `HERO_TOP_ROUTES` in `Header.tsx`. So the first click computes its landing
 * against a header that no longer exists by the time the scroll ends, and stops short. The
 * second click looks fixed only because the header had already settled before it started.
 *
 * This runs the scroll itself and re-reads the target's position *and the header's live
 * height* on every frame, so the destination follows the header while it settles instead
 * of being guessed up front. The same re-reading absorbs any other late layout change
 * above the target, so it needs no fixed offset, no delay and no second scroll.
 *
 * The easing and duration match `rafScrollTo` in `Header.tsx`, so an anchor started here
 * feels identical to one started from the navigation.
 */

import type { MouseEvent } from 'react'

/** Breathing room between the bottom of the settled header and the top of the section. */
const HEADER_GAP = 20

/** Matches the header's own anchor scroll, so the whole site scrolls at one speed. */
const DURATION = 560

/** easeInOutQuad — the curve `Header.tsx` uses. */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

/**
 * Height of the sticky header right now, plus the gap.
 *
 * `body > header` is the site header specifically: article pages render their own
 * `<header>` inside `<main>`, and a bare `header` selector would eventually pick one of
 * those up. A `translateY` from the auto-hide does not change the measured height, so a
 * hidden header still reserves its space and the landing position is stable either way.
 */
function headerOffset(): number {
  const header = document.querySelector('body > header')
  return (header?.getBoundingClientRect().height ?? 0) + HEADER_GAP
}

/** Where the page should end up for `el`, measured against the layout as it is right now. */
function destinationFor(el: Element): number {
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset()
  const max = document.documentElement.scrollHeight - window.innerHeight
  return Math.max(0, Math.min(top, max))
}

let frame = 0

/** Tears down the in-flight scroll: stops the loop and unbinds its listeners. */
let stopActive: (() => void) | null = null

/**
 * Scrolls to the element with `id`, easing there over {@link DURATION} while keeping the
 * destination in sync with the header.
 *
 * Returns `false` when the target is not on the page, so the caller can leave the click
 * to the browser rather than swallowing it.
 */
export function scrollToAnchor(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) return false

  // A click during an in-flight scroll replaces it instead of racing it.
  stopActive?.()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({ top: destinationFor(el), behavior: 'instant' })
    return true
  }

  const start = window.scrollY
  const t0 = performance.now()

  // Any real scroll input hands control straight back to the user — the animation never
  // fights a wheel, a swipe or a page-down.
  const abort = () => {
    cancelAnimationFrame(frame)
    detach()
  }
  const detach = () => {
    window.removeEventListener('wheel', abort)
    window.removeEventListener('touchstart', abort)
    window.removeEventListener('keydown', abort)
    stopActive = null
  }
  window.addEventListener('wheel', abort, { passive: true, once: true })
  window.addEventListener('touchstart', abort, { passive: true, once: true })
  window.addEventListener('keydown', abort, { once: true })
  stopActive = abort

  const step = (now: number) => {
    const progress = Math.min((now - t0) / DURATION, 1)
    // Re-read rather than cache: the header is mid-transition for the whole first half of
    // this animation, and the destination has to follow it. It drifts by the header's own
    // 0.3s transition, well inside this 0.56s scroll, so the movement stays smooth and is
    // over long before the easing reaches full weight — no visible jump at the end.
    const target = destinationFor(el)
    window.scrollTo({ top: start + (target - start) * ease(progress), behavior: 'instant' })
    if (progress < 1) frame = requestAnimationFrame(step)
    else detach()
  }
  frame = requestAnimationFrame(step)
  return true
}

/**
 * `onClick` for an in-page anchor. The element keeps its real `href="#id"` — middle-click,
 * "open in new tab" and the no-JS case all still work — and only a plain left click is
 * taken over. `before` runs first for side effects the click also has to perform.
 */
export function anchorClick(
  id: string,
  before?: () => void,
): (e: MouseEvent<HTMLAnchorElement>) => void {
  return (e) => {
    before?.()
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (!scrollToAnchor(id)) return
    e.preventDefault()
    // Keeps the URL deep-linkable, as the native jump would have. `replaceState` rather
    // than a hash assignment: assigning `location.hash` would re-trigger the browser's own
    // scroll on top of this one.
    window.history.replaceState(null, '', `#${id}`)
  }
}
