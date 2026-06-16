'use client'

import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import Image from 'next/image'

interface CarouselItem {
  src: string
  alt: string
}

export interface CarouselHandle {
  scrollPrev: () => void
  scrollNext: () => void
}

interface CarouselProps {
  items: CarouselItem[]
  aspectRatio?: string
  itemWidth?: string
  background?: string
  gap?: number
  arrowBg?: string
  arrowBgHover?: string
  arrowBorder?: string
}

const Carousel = forwardRef<CarouselHandle, CarouselProps>(function Carousel(
  {
    items,
    aspectRatio = '4/3',
    itemWidth = 'min(78vw, 460px)',
    background = '#f2e7d7',
    gap = 20,
    arrowBg = '#fff',
    arrowBgHover = '#f2e7d7',
    arrowBorder = '#d6cfbd',
  },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollBy = useCallback((dir: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.min(540, el.clientWidth * 0.85), behavior: 'smooth' })
  }, [])

  useImperativeHandle(ref, () => ({
    scrollPrev: () => scrollBy(-1),
    scrollNext: () => scrollBy(1),
  }))

  useEffect(() => {
    const el = scrollRef.current
    if (!el || (el as HTMLDivElement & { _dragBound?: boolean })._dragBound) return
    ;(el as HTMLDivElement & { _dragBound?: boolean })._dragBound = true

    let down = false
    let startX = 0
    let startLeft = 0
    let lastX = 0
    let lastT = 0
    let vx = 0
    let raf = 0
    let moved = false

    const settle = () => {
      el.style.scrollSnapType = 'x mandatory'
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
      el.style.scrollSnapType = 'none'
      el.style.scrollBehavior = 'auto'
      el.style.cursor = 'grabbing'
      try { el.setPointerCapture(e.pointerId) } catch {}
    }

    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - startX
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

    const onClick = (e: MouseEvent) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('lostpointercapture', onUp)
    el.addEventListener('dragstart', (e) => e.preventDefault())
    el.addEventListener('click', onClick, true)

    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('lostpointercapture', onUp)
    }
  }, [])

  return (
    <div
      ref={scrollRef}
      data-carousel
      style={{
        display: 'flex',
        gap: `${gap}px`,
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollBehavior: 'smooth',
        padding: `0 clamp(20px,5vw,48px) 8px`,
        scrollPaddingLeft: 'clamp(20px,5vw,48px)',
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            flex: 'none',
            width: itemWidth,
            aspectRatio,
            borderRadius: '22px',
            overflow: 'hidden',
            scrollSnapAlign: 'start',
            background,
            boxShadow: '0 2px 6px rgba(42,36,24,.05)',
            position: 'relative',
          }}
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            sizes="(max-width: 768px) 82vw, 520px"
            style={{ objectFit: 'cover', pointerEvents: 'none' }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  )
})

export default Carousel

export function CarouselArrows({
  onPrev,
  onNext,
  bg = '#fff',
  bgHover = '#f2e7d7',
  border = '#d6cfbd',
}: {
  onPrev: () => void
  onNext: () => void
  bg?: string
  bgHover?: string
  border?: string
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
      {[
        { onClick: onPrev, label: 'Forrige', d: 'M15 18l-6-6 6-6' },
        { onClick: onNext, label: 'Neste', d: 'M9 18l6-6-6-6' },
      ].map((btn) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          aria-label={btn.label}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '999px',
            border: `1.5px solid ${border}`,
            background: bg,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1a1d17',
            transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = bgHover }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = bg }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={btn.d} />
          </svg>
        </button>
      ))}
    </div>
  )
}
