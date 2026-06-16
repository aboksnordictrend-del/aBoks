'use client'

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from 'react'
import Image from 'next/image'
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion'

export interface CarouselImage {
  src: string
  alt: string
}

export interface ProductImageCarouselHandle {
  goTo: (index: number) => void
}

interface Props {
  images: CarouselImage[]
  onIndexChange?: (index: number) => void
  initialIndex?: number
  onZoom?: (index: number) => void
}

const SNAP_OFFSET = 55
const SNAP_VEL   = 380
const FLY_DIST   = 440

const ProductImageCarousel = forwardRef<ProductImageCarouselHandle, Props>(
  function ProductImageCarousel({ images, onIndexChange, initialIndex = 0, onZoom }, ref) {
    const n = images.length
    const [current, setCurrent]       = useState(initialIndex)
    const [bgIdx,   setBgIdx]         = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const transitioning = useRef(false)
    const bgIdxRef      = useRef<number | null>(null)

    // Mirror current in a ref so pointer callbacks always read the latest value
    // without needing to be recreated on every current change.
    const currentRef   = useRef(current)
    currentRef.current = current
    const nRef         = useRef(n)
    nRef.current       = n

    // Manual drag tracking — no Framer Motion drag prop so there is no
    // drag-system/animate-system handoff stutter on release.
    const dragActive  = useRef(false)
    const dragStartX  = useRef(0)
    const lastPointer = useRef<{ x: number; t: number }>({ x: 0, t: 0 })

    const x = useMotionValue(0)

    const fgScale   = useTransform(x, [-FLY_DIST, 0, FLY_DIST], [0.88, 1, 0.88])
    const fgOpacity = useTransform(x, [-FLY_DIST * 0.7, 0, FLY_DIST * 0.7], [0.45, 1, 0.45])
    const bgScale   = useTransform(x, [-FLY_DIST, 0, FLY_DIST], [1, 0.9, 1])

    const commitTo = useCallback(
      (targetIdx: number, flyDir: 'left' | 'right', releaseVelocity = 0) => {
        if (transitioning.current) return
        transitioning.current = true
        bgIdxRef.current = targetIdx
        setBgIdx(targetIdx)
        animate(x, flyDir === 'left' ? -FLY_DIST : FLY_DIST, {
          type: 'spring',
          stiffness: 280,
          damping: 34,
          velocity: releaseVelocity,
          restDelta: 0.5,
          onComplete() {
            // Foreground is fully offscreen — swap src while invisible.
            // Background (same image) covers any blank frame during the React re-render.
            setCurrent(targetIdx)
            onIndexChange?.(targetIdx)
            // Two rAFs let Next Image paint the new src before snapping back.
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                x.set(0)
                bgIdxRef.current = null
                setBgIdx(null)
                transitioning.current = false
              })
            })
          },
        })
      },
      [onIndexChange, x],
    )

    const snapBack = useCallback((releaseVelocity = 0) => {
      bgIdxRef.current = null
      setBgIdx(null)
      animate(x, 0, { type: 'spring', stiffness: 500, damping: 44, velocity: releaseVelocity })
    }, [x])

    const goTo = useCallback(
      (index: number) => {
        const i = Math.max(0, Math.min(nRef.current - 1, index))
        if (i === currentRef.current || transitioning.current) return
        commitTo(i, i > currentRef.current ? 'left' : 'right')
      },
      [commitTo],
    )

    useImperativeHandle(ref, () => ({ goTo }), [goTo])

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (transitioning.current) return
      e.currentTarget.setPointerCapture(e.pointerId)
      dragActive.current  = true
      dragStartX.current  = e.clientX
      lastPointer.current = { x: e.clientX, t: performance.now() }
      setIsDragging(true)
    }, [])

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActive.current) return
      const offset = e.clientX - dragStartX.current
      x.set(offset)

      const cur  = currentRef.current
      const len  = nRef.current
      const next = offset < -8 && cur < len - 1 ? cur + 1
                 : offset >  8 && cur > 0        ? cur - 1
                 : null
      if (next !== bgIdxRef.current) {
        bgIdxRef.current = next
        setBgIdx(next)
      }
      lastPointer.current = { x: e.clientX, t: performance.now() }
    }, [x])

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActive.current) return
      dragActive.current = false
      setIsDragging(false)
      if (transitioning.current) return

      const cur    = currentRef.current
      const len    = nRef.current
      const offset = x.get()
      const dt     = performance.now() - lastPointer.current.t
      // Velocity in px/s between the last pointermove and pointerup
      const vel    = dt > 4 ? (e.clientX - lastPointer.current.x) / (dt / 1000) : 0

      if ((offset < -SNAP_OFFSET || vel < -SNAP_VEL) && cur < len - 1) {
        commitTo(cur + 1, 'left', vel)
      } else if ((offset > SNAP_OFFSET || vel > SNAP_VEL) && cur > 0) {
        commitTo(cur - 1, 'right', vel)
      } else {
        snapBack(vel)
      }
    }, [commitTo, snapBack, x])

    const onPointerCancel = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActive.current) return
      dragActive.current = false
      setIsDragging(false)
      snapBack(0)
    }, [snapBack])

    if (!n) return null

    const bgImage = bgIdx !== null ? images[bgIdx] : null

    // Prev/next images held in DOM (invisible) so Next Image decodes them ahead of time.
    const prevIdx = current > 0 ? current - 1 : null
    const nextIdx = current < n - 1 ? current + 1 : null
    const preloadIndices: number[] = []
    if (prevIdx !== null && prevIdx !== bgIdx) preloadIndices.push(prevIdx)
    if (nextIdx !== null && nextIdx !== bgIdx) preloadIndices.push(nextIdx)

    return (
      <div>
        {/* ── Viewport ─────────────────────────────────── */}
        <div
          style={{
            aspectRatio: '1/1',
            borderRadius: '24px',
            overflow: 'hidden',
            position: 'relative',
            background: '#e7d9bd',
            boxShadow: '0 18px 44px -20px rgba(42,36,24,.24)',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {/* Invisible preload layer for adjacent images */}
          {preloadIndices.map((i) => (
            <div
              key={i}
              aria-hidden
              style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none', zIndex: 0 }}
            >
              <Image
                src={images[i].src}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
                draggable={false}
              />
            </div>
          ))}

          {/* Background — incoming image grows into view */}
          {bgImage && (
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                scale: bgScale,
                transformOrigin: 'center',
                zIndex: 1,
              }}
            >
              <Image
                src={bgImage.src}
                alt={bgImage.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover', pointerEvents: 'none' }}
                draggable={false}
              />
            </motion.div>
          )}

          {/* Foreground — current image, pointer-driven (no Framer Motion drag prop) */}
          <motion.div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            style={{
              x,
              scale: fgScale,
              opacity: fgOpacity,
              position: 'absolute',
              inset: 0,
              transformOrigin: 'center',
              zIndex: 2,
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'pan-y',
            }}
          >
            <Image
              src={images[current].src}
              alt={images[current].alt}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              style={{ objectFit: 'cover', pointerEvents: 'none' }}
              draggable={false}
              priority
            />
          </motion.div>

          {/* Dot indicators */}
          {n > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: '6px',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              {images.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === current ? 22 : 7,
                    background:
                      i === current
                        ? 'rgba(250,246,238,1)'
                        : 'rgba(250,246,238,0.42)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  style={{ height: '7px', borderRadius: '999px', flexShrink: 0 }}
                />
              ))}
            </div>
          )}

          {/* Prev arrow */}
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            aria-label="Forrige bilde"
            className="flex"
            style={{
              position: 'absolute',
              left: '14px',
              top: 'calc(50% - 20px)',
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: 'rgba(250,246,238,.9)',
              border: 'none',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,.14)',
              opacity: current > 0 ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a1d17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Next arrow */}
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            aria-label="Neste bilde"
            className="flex"
            style={{
              position: 'absolute',
              right: '14px',
              top: 'calc(50% - 20px)',
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: 'rgba(250,246,238,.9)',
              border: 'none',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,.14)',
              opacity: current < n - 1 ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a1d17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          {/* Zoom button */}
          {onZoom && (
            <button
              onClick={(e) => { e.stopPropagation(); onZoom(current) }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Forstørr bilde"
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                background: 'rgba(250,246,238,0.88)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 30,
                boxShadow: '0 2px 12px rgba(0,0,0,.16)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.transform = 'scale(1.12)'
                b.style.boxShadow = '0 4px 18px rgba(0,0,0,.24)'
                b.style.background = 'rgba(250,246,238,1)'
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.transform = ''
                b.style.boxShadow = '0 2px 12px rgba(0,0,0,.16)'
                b.style.background = 'rgba(250,246,238,0.88)'
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a1d17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7.5" />
                <path d="M21 21l-3.8-3.8" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Thumbnail strip ───────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginTop: '14px',
          }}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={img.alt}
              style={{
                width: '100%',
                aspectRatio: '1/1',
                borderRadius: '14px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: current === i ? '2px solid #39402c' : '2px solid transparent',
                background: '#f2e7d7',
                padding: 0,
                boxShadow: current === i ? 'none' : 'inset 0 0 0 1px #e7e2d4',
                position: 'relative',
                transition: 'border-color 0.2s ease',
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="100px"
                style={{ objectFit: 'cover' }}
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    )
  },
)

export default ProductImageCarousel
