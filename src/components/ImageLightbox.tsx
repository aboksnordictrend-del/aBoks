'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

interface LightboxImage {
  src: string
  alt: string
}

interface Props {
  images: LightboxImage[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function ImageLightbox({ images, index, onClose, onNavigate }: Props) {
  const n = images.length
  const current = images[index]

  const [pinchScale, setPinchScale] = useState(1)
  const pinchRef = useRef({ dist: 0, scale: 1 })

  // Always-current refs — lets stable callbacks read latest values without
  // being recreated on every render (avoids the stale-closure/effect churn
  // that caused arrows to stop responding after re-open).
  const indexRef = useRef(index)
  indexRef.current = index

  const nRef = useRef(n)
  nRef.current = n

  const onNavigateRef = useRef(onNavigate)
  onNavigateRef.current = onNavigate

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Stable callbacks — empty deps, always read latest values from refs.
  const prev = useCallback(() => {
    const i = indexRef.current
    onNavigateRef.current(i <= 0 ? nRef.current - 1 : i - 1)
  }, [])

  const next = useCallback(() => {
    const i = indexRef.current
    onNavigateRef.current(i >= nRef.current - 1 ? 0 : i + 1)
  }, [])

  // Keyboard: runs once on mount, never again (callbacks are stable).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  // Scroll-lock: runs once on mount.
  useEffect(() => {
    const saved = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = saved }
  }, [])

  // Reset pinch when image changes.
  useEffect(() => {
    setPinchScale(1)
    pinchRef.current = { dist: 0, scale: 1 }
  }, [index])

  const getDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    return Math.hypot(dx, dy)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current.dist = getDist(e)
      pinchRef.current.scale = pinchScale
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = getDist(e)
      if (pinchRef.current.dist > 0) {
        const ratio = d / pinchRef.current.dist
        setPinchScale(Math.max(1, Math.min(4, pinchRef.current.scale * ratio)))
      }
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current.dist = 0
      if (pinchScale < 1.1) {
        setPinchScale(1)
        pinchRef.current.scale = 1
      } else {
        pinchRef.current.scale = pinchScale
      }
    }
  }

  if (!current) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(14,12,9,0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      {/* ── Close ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onCloseRef.current()}
        aria-label="Lukk"
        style={{
          position: 'absolute',
          top: '18px',
          right: '18px',
          width: '44px',
          height: '44px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          transition: 'background 0.18s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.20)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* ── Counter ───────────────────────────────────── */}
      {n > 1 && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '26px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.38)',
            letterSpacing: '0.08em',
            userSelect: 'none',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {index + 1} / {n}
        </div>
      )}

      {/* ── Image + arrows ───────────────────────────── */}
      {/*
        Wrapper has the same dimensions as the image so that arrow
        top: calc(50% - 25px) is relative to the image height, not the
        full overlay height. Without this, the thumbnail strip below the
        image shifts the image upward from the viewport center, making
        arrows positioned at 50% of the overlay land below the image center.
      */}
      <div
        style={{
          position: 'relative',
          width: 'min(90vw, calc(100vh - 196px))',
          maxWidth: '860px',
          aspectRatio: '1 / 1',
          flexShrink: 0,
        }}
      >
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <Image
            src={current.src}
            alt={current.alt}
            fill
            sizes="90vw"
            style={{
              objectFit: 'contain',
              transform: `scale(${pinchScale})`,
              transition: pinchScale === 1 ? 'transform 0.28s ease' : 'none',
              transformOrigin: 'center',
            }}
            priority
            draggable={false}
          />
        </motion.div>

        {/* ── Navigation arrows ─────────────────────────── */}
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Forrige bilde"
              style={{
                position: 'absolute',
                left: 'clamp(10px,2.5vw,36px)',
                top: 'calc(50% - 25px)',
                width: '50px',
                height: '50px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                transition: 'background 0.18s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={next}
              aria-label="Neste bilde"
              style={{
                position: 'absolute',
                right: 'clamp(10px,2.5vw,36px)',
                top: 'calc(50% - 25px)',
                width: '50px',
                height: '50px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                transition: 'background 0.18s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* ── Thumbnails ────────────────────────────────── */}
      {n > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
            flexShrink: 0,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '90vw',
          }}
        >
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onNavigateRef.current(i)}
              aria-label={img.alt}
              aria-current={i === index ? 'true' : undefined}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: i === index
                  ? '2px solid rgba(255,255,255,0.85)'
                  : '2px solid rgba(255,255,255,0.18)',
                cursor: 'pointer',
                background: 'transparent',
                padding: 0,
                position: 'relative',
                opacity: i === index ? 1 : 0.52,
                transition: 'opacity 0.18s ease, border-color 0.18s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { if (i !== index) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
              onMouseLeave={(e) => { if (i !== index) (e.currentTarget as HTMLButtonElement).style.opacity = '0.52' }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="54px"
                style={{ objectFit: 'cover' }}
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
