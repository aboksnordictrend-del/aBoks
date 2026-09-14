'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Mouse drag-to-scroll for a horizontal scroll container, shared by every carousel on the
 * site so they all feel the same. Lifted out of Carousel.tsx, where it first lived for the
 * homepage galleries, when the product carousel needed the same behaviour.
 *
 * Touch is deliberately left alone: a pointerdown that is not a mouse returns immediately,
 * so phones keep the browser's own swipe and momentum rather than a re-implementation.
 *
 * The container keeps ownership of its own CSS — the hook only toggles what a drag has to
 * change (snap, scroll-behaviour, cursor) and puts each back the way it found it.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let down = false
    let startX = 0
    let startLeft = 0
    let lastX = 0
    let lastT = 0
    let vx = 0
    let raf = 0
    /** Set once the pointer has travelled far enough to count as a drag, not a click. */
    let moved = false
    /** The element's own snap setting, restored when the drag comes to rest. */
    let snap = ''

    const settle = () => {
      el.style.scrollSnapType = snap
      el.style.scrollBehavior = 'smooth'
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      if (e.button != null && e.button !== 0) return
      down = true
      moved = false
      startX = e.clientX
      startLeft = el.scrollLeft
      lastX = e.clientX
      lastT = performance.now()
      vx = 0
      cancelAnimationFrame(raf)
      // Snap fights a drag — every pixel would be pulled back to the nearest card — so it
      // goes off for the duration and comes back once the row settles.
      snap = el.style.scrollSnapType
      el.style.scrollSnapType = 'none'
      el.style.scrollBehavior = 'auto'
      el.style.cursor = 'grabbing'
      try { el.setPointerCapture(e.pointerId) } catch {}
    }

    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
      // 3px of slack, so a click with a twitch in it still opens what was clicked.
      if (Math.abs(dx) > 3) moved = true
      el.scrollLeft = startLeft - dx
      const now = performance.now()
      const dt = now - lastT
      if (dt > 0) { vx = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now }
      e.preventDefault()
    }

    const onUp = (e: PointerEvent) => {
      if (!down) return
      down = false
      el.style.cursor = 'grab'
      try { el.releasePointerCapture(e.pointerId) } catch {}
      let v = vx * 16
      const step = () => {
        v *= 0.94
        el.scrollLeft -= v
        const max = el.scrollWidth - el.clientWidth
        if (el.scrollLeft <= 0 || el.scrollLeft >= max) { settle(); return }
        if (Math.abs(v) > 0.4) raf = requestAnimationFrame(step); else settle()
      }
      if (Math.abs(v) > 0.6) raf = requestAnimationFrame(step); else settle()
    }

    /**
     * Capture phase, so a drag that ends over a link never reaches it: the event is stopped
     * before it gets to the anchor and before React sees it bubble, which is what keeps a
     * dragged row from navigating away. A real click leaves `moved` false and passes through.
     */
    const onClick = (e: MouseEvent) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false }
    }

    /** Stops the browser from picking up an image and dragging it as a ghost. */
    const onDragStart = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('lostpointercapture', onUp)
    el.addEventListener('dragstart', onDragStart)
    el.addEventListener('click', onClick, true)

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('lostpointercapture', onUp)
      el.removeEventListener('dragstart', onDragStart)
      el.removeEventListener('click', onClick, true)
    }
  }, [ref])
}
