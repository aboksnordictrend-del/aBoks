'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { STEPS } from '@/lib/content'

type Step = (typeof STEPS)[number]

function StepVideoCard({ step }: { step: Step }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  function ensureSrc() {
    const v = videoRef.current
    if (!v || !step.videoUrl) return false
    if (!v.src || v.src === window.location.href) {
      v.src = step.videoUrl
      v.loop = true
      v.load()
    }
    return true
  }

  function isHoverDevice() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  }

  function handleMouseEnter() {
    if (!isHoverDevice()) return
    if (!ensureSrc()) return
    videoRef.current!.play().catch(() => {})
  }

  function handleMouseLeave() {
    if (!isHoverDevice()) return
    videoRef.current?.pause()
  }

  function handleClick() {
    const v = videoRef.current
    if (!v || !step.videoUrl) return

    if (!v.src || v.src === window.location.href) {
      v.src = step.videoUrl
      v.loop = true
      v.load()
    }

    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onEnded = () => {
      v.currentTime = 0
      v.play().catch(() => {})
    }
    v.addEventListener('ended', onEnded)
    return () => v.removeEventListener('ended', onEnded)
  }, [])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        aspectRatio: '4/5',
        borderRadius: '18px',
        overflow: 'hidden',
        background: '#e3dcd1',
        position: 'relative',
        boxShadow: '0 4px 20px -6px rgba(42,36,24,.14)',
        cursor: step.videoUrl ? 'pointer' : 'default',
        width: '100%',
      }}
    >
      {step.posterUrl && !step.videoUrl && (
        <Image src={step.posterUrl} alt={step.title} fill style={{ objectFit: 'cover' }} />
      )}
      {step.videoUrl && (
        <video
          ref={videoRef}
          muted
          playsInline
          poster={step.posterUrl || undefined}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      <div
        className="step-play-btn"
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          opacity: isPlaying ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(250,246,238,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
            <path d="M1.5 1.5L12.5 8L1.5 14.5V1.5Z" fill="#3a3f33" />
          </svg>
        </div>
      </div>
    </div>
  )
}

/**
 * The "Klar på få minutter" step process — shared by the home page section
 * (#slik) and /slik-fungerer-det so the two can't drift apart.
 *
 * Pass `descriptions` to render a per-step paragraph under the title. With
 * descriptions the mobile column puts the text above the video card (and the
 * timeline circle aligns with the title); without them the mobile layout is
 * the original card-then-title timeline used on the home page.
 */
export default function HowItWorksSteps({
  descriptions,
}: {
  descriptions?: Record<number, string>
}) {
  const hasText = Boolean(descriptions)

  return (
    <>
      <style>{`
        .slik-desktop { display: grid; }
        .slik-mobile  { display: none; }
        @media (max-width: 767px) {
          .slik-desktop { display: none; }
          .slik-mobile  { display: flex; flex-direction: column; }
          .slik-spacer  { height: calc((100vw - clamp(40px, 10vw, 96px) - 136px) * 0.625 - 22px); }
        }
        @media (hover: hover) and (pointer: fine) {
          .step-play-btn { display: none !important; }
        }
      `}</style>

      {/* ── DESKTOP: horizontal process ── */}
      <div className="slik-desktop" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(16px,2vw,28px)' }}>
        {STEPS.map((step, i) => (
          <div key={step.number} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {/* Number row with dashed connectors */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              {i > 0 && (
                <div style={{ position: 'absolute', top: '50%', left: 0, width: '50%', borderTop: '1.5px dashed #c0b49a', transform: 'translateY(-50%)' }} />
              )}
              {i < STEPS.length - 1 && (
                <div style={{ position: 'absolute', top: '50%', right: 0, width: '50%', borderTop: '1.5px dashed #c0b49a', transform: 'translateY(-50%)' }} />
              )}
              <div style={{ position: 'relative', zIndex: 1, width: '48px', height: '48px', borderRadius: '50%', background: '#faf6ee', border: '1.5px solid #c0b49a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontSize: '20px', fontWeight: 500, color: '#1a1d17', flexShrink: 0 }}>
                {step.number}
              </div>
            </div>
            {/* Video card */}
            <StepVideoCard step={step} />
            {/* Title */}
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 'clamp(13px,1.1vw,15px)', letterSpacing: '-0.01em', lineHeight: 1.3, color: '#1a1d17', margin: 0, textAlign: 'center' }}>
              {step.title}
            </p>
            {/* Description (only where the caller supplies one) */}
            {descriptions?.[step.number] && (
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', lineHeight: 1.6, color: '#6b6f63', margin: 0, textAlign: 'center' }}>
                {descriptions[step.number]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── MOBILE: vertical timeline ── */}
      <div className="slik-mobile" style={{ gap: 0 }}>
        {STEPS.map((step, i) => (
          <div key={step.number} style={{ display: 'flex', gap: '20px' }}>
            {/* Left: spacer + circle + connector — all in one flex column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '44px', flexShrink: 0 }}>
              {/* Spacer pushes circle to card center. With text above the card the
                  circle belongs next to the title instead, so it collapses to 0. */}
              <div
                className={hasText ? undefined : 'slik-spacer'}
                style={{
                  width: '2px',
                  flexShrink: 0,
                  background: i > 0
                    ? 'repeating-linear-gradient(to bottom, #c0b49a 0px, #c0b49a 5px, transparent 5px, transparent 10px)'
                    : 'transparent',
                }}
              />
              {/* Circle */}
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#faf6ee', border: '1.5px solid #c0b49a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontSize: '18px', fontWeight: 500, color: '#1a1d17', flexShrink: 0 }}>
                {step.number}
              </div>
              {/* Connector fills remaining height down to bottom of right column */}
              {i < STEPS.length - 1 && (
                <div style={{ flexGrow: 1, width: '2px', background: 'repeating-linear-gradient(to bottom, #c0b49a 0px, #c0b49a 5px, transparent 5px, transparent 10px)' }} />
              )}
            </div>

            {/* Right: card + title, or title + description + card when text is supplied */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: i < STEPS.length - 1 ? '28px' : 0 }}>
              {hasText ? (
                <>
                  <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', lineHeight: 1.3, color: '#1a1d17', margin: '10px 0 0' }}>
                    {step.title}
                  </p>
                  {descriptions?.[step.number] && (
                    <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.6, color: '#6b6f63', margin: '8px 0 14px' }}>
                      {descriptions[step.number]}
                    </p>
                  )}
                  <StepVideoCard step={step} />
                </>
              ) : (
                <>
                  <StepVideoCard step={step} />
                  <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', lineHeight: 1.3, color: '#1a1d17', margin: '14px 0 0' }}>
                    {step.title}
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
