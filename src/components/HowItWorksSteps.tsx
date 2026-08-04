'use client'

import Image from 'next/image'
import ClickToPlayVideo from '@/components/ClickToPlayVideo'
import { STEPS } from '@/lib/content'

type Step = (typeof STEPS)[number]

const CARD_STYLE = {
  aspectRatio: '4/5',
  borderRadius: '18px',
  overflow: 'hidden',
  background: '#e3dcd1',
  position: 'relative' as const,
  boxShadow: '0 4px 20px -6px rgba(42,36,24,.14)',
  width: '100%',
}

/**
 * The step clip only downloads once the visitor presses play — no hover start
 * and no autoplay, so a scroll past this section costs zero blob traffic.
 */
function StepVideoCard({ step }: { step: Step }) {
  if (!step.videoUrl) {
    return (
      <div style={{ ...CARD_STYLE, cursor: 'default' }}>
        {step.posterUrl && (
          <Image src={step.posterUrl} alt={step.title} fill style={{ objectFit: 'cover' }} />
        )}
      </div>
    )
  }

  return (
    <ClickToPlayVideo
      src={step.videoUrl}
      poster={step.posterUrl || undefined}
      label={`Spill av video: ${step.title}`}
      muted
      wrapperStyle={CARD_STYLE}
      videoStyle={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
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
