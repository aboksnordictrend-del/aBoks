'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'

export interface SquareCarouselImage {
  src: string
  alt: string
}

interface Props {
  images: SquareCarouselImage[]
  /** next/image `sizes` — the carousel is always square and always fills its column. */
  sizes: string
  /** Accessible name of the carousel region, e.g. the product name. */
  label: string
  background?: string
  radius?: number
}

const SWIPE_DISTANCE = 56
const SWIPE_VELOCITY = 380

/**
 * Square (1:1) image carousel: arrows, dots, swipe and keyboard control.
 *
 * Deliberately separate from ProductImageCarousel, which is tuned for the product page
 * (thumbnail strip, overlaid controls, `priority` on the first image). This one lives
 * below the fold, so nothing is marked priority and slides other than the first are
 * only mounted once the carousel scrolls near the viewport.
 */
export default function SquareImageCarousel({
  images,
  sizes,
  label,
  background = '#e7d9bd',
  radius = 26,
}: Props) {
  const n = images.length
  const [current, setCurrent] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  // Slides beyond the first are clipped by `overflow: hidden`, so native lazy-loading
  // would never fire for them. We mount the neighbours ourselves once the section is
  // near the viewport — that keeps the initial page load light without blank slides.
  const [mounted, setMounted] = useState<number[]>([0])
  const [nearViewport, setNearViewport] = useState(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(0)
  const currentRef = useRef(0)
  currentRef.current = current
  const nRef = useRef(n)
  nRef.current = n

  const dragActive = useRef(false)
  const dragStartX = useRef(0)
  const dragBase = useRef(0)
  const lastPointer = useRef<{ x: number; t: number }>({ x: 0, t: 0 })

  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)

  // Track width drives the transform, so it has to follow container resizes.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const sync = () => {
      widthRef.current = el.clientWidth
      x.set(-currentRef.current * el.clientWidth)
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [x])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || nearViewport) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearViewport(true)
      },
      { rootMargin: '300px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [nearViewport])

  useEffect(() => {
    if (!nearViewport) return
    setMounted((prev) => {
      const next = new Set(prev)
      for (const i of [current - 1, current, current + 1]) {
        if (i >= 0 && i < n) next.add(i)
      }
      return next.size === prev.length ? prev : [...next]
    })
  }, [nearViewport, current, n])

  const goTo = useCallback(
    (index: number) => {
      const i = Math.max(0, Math.min(nRef.current - 1, index))
      const jump = Math.abs(i - currentRef.current) > 1
      currentRef.current = i
      setCurrent(i)
      const target = -i * widthRef.current
      // Sliding across several unmounted slides would just sweep past empty space, so a
      // jump from the indicator lands directly. Neighbour steps get the spring.
      if (reduceMotion || jump) x.set(target)
      else animate(x, target, { type: 'spring', stiffness: 240, damping: 32, restDelta: 0.4 })
    },
    [reduceMotion, x],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (nRef.current < 2) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragActive.current = true
      dragStartX.current = e.clientX
      dragBase.current = x.get()
      lastPointer.current = { x: e.clientX, t: performance.now() }
      setIsDragging(true)
    },
    [x],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActive.current) return
      const width = widthRef.current
      const min = -(nRef.current - 1) * width
      let next = dragBase.current + (e.clientX - dragStartX.current)
      // Rubber-band past the first/last slide instead of hard-stopping.
      if (next > 0) next *= 0.35
      else if (next < min) next = min + (next - min) * 0.35
      x.set(next)
      lastPointer.current = { x: e.clientX, t: performance.now() }
    },
    [x],
  )

  const endDrag = useCallback(
    (clientX: number | null) => {
      if (!dragActive.current) return
      dragActive.current = false
      setIsDragging(false)

      const cur = currentRef.current
      if (clientX === null) {
        goTo(cur)
        return
      }
      const offset = clientX - dragStartX.current
      const dt = performance.now() - lastPointer.current.t
      const velocity = dt > 4 ? (clientX - lastPointer.current.x) / (dt / 1000) : 0

      if (offset < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) goTo(cur + 1)
      else if (offset > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) goTo(cur - 1)
      else goTo(cur)
    },
    [goTo],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (nRef.current < 2) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(currentRef.current - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(currentRef.current + 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(nRef.current - 1)
      }
    },
    [goTo],
  )

  if (!n) return null

  const multiple = n > 1

  return (
    <div>
      <div
        ref={viewportRef}
        role="group"
        aria-roledescription="karusell"
        aria-label={label}
        tabIndex={multiple ? 0 : -1}
        onKeyDown={onKeyDown}
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          borderRadius: `${radius}px`,
          overflow: 'hidden',
          background,
          boxShadow: '0 18px 44px -20px rgba(42,36,24,.24)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'pan-y',
          cursor: multiple ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <motion.div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e.clientX)}
          onPointerCancel={() => endDrag(null)}
          style={{ x, display: 'flex', height: '100%', width: '100%' }}
        >
          {images.map((img, i) => (
            <div
              key={img.src}
              aria-hidden={i !== current}
              style={{ position: 'relative', flex: '0 0 100%', height: '100%', background }}
            >
              {mounted.includes(i) && (
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes={sizes}
                  // The first slide is server-rendered and visible when the section is
                  // reached, so it can lazy-load. The rest are only mounted once we are
                  // near the viewport, and being clipped they need an explicit eager load.
                  loading={i === 0 ? 'lazy' : 'eager'}
                  style={{ objectFit: 'cover', pointerEvents: 'none' }}
                  draggable={false}
                />
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {multiple && (
        <div style={{ marginTop: '18px' }}>
          {/* Segmented indicator — each slide gets an equal share of the width, so a long
              gallery never wraps or overflows on narrow screens. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Vis bilde ${i + 1} av ${n}`}
                aria-current={i === current}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  height: '26px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <motion.span
                  animate={{
                    backgroundColor: i === current ? '#39402c' : 'rgba(57,64,44,0.18)',
                  }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
                  style={{ width: '100%', height: '3px', borderRadius: '999px', display: 'block' }}
                />
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginTop: '10px',
            }}
          >
            <span
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-manrope)',
                fontWeight: 600,
                fontSize: '12.5px',
                letterSpacing: '0.08em',
                color: '#6b6f63',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {String(current + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
            </span>

            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              {[
                { dir: -1, label: 'Forrige bilde', d: 'M15 18l-6-6 6-6', disabled: current === 0 },
                { dir: 1, label: 'Neste bilde', d: 'M9 18l6-6-6-6', disabled: current === n - 1 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => goTo(current + btn.dir)}
                  aria-label={btn.label}
                  disabled={btn.disabled}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '999px',
                    border: '1.5px solid rgba(57,64,44,0.22)',
                    background: 'transparent',
                    color: '#39402c',
                    cursor: btn.disabled ? 'default' : 'pointer',
                    opacity: btn.disabled ? 0.3 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s ease, opacity 0.2s ease, transform 0.15s ease',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={btn.d} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
