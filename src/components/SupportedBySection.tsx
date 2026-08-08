'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { SUPPORTERS } from '@/lib/supporters'

/**
 * The two logos have very different proportions (Hitra ≈ 2.6:1, Thams ≈ 4.5:1), so a
 * shared height alone would make the wide Thams mark visually dominate. Capping both
 * a height *and* a width lets each logo scale down to whichever limit it hits first,
 * which lands them at a comparable optical size without forcing either to a fixed
 * width. Both limits are maxima on an auto-sized image, so the aspect ratio is always
 * the browser's to keep.
 */
const LOGO_MAX_HEIGHT = 'clamp(40px,7vw,64px)'
const LOGO_MAX_WIDTH = 'clamp(140px,26vw,232px)'

export default function SupportedBySection() {
  const reduceMotion = useReducedMotion()

  const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.6, ease: [0.22, 0.61, 0.36, 1] as const },
  }

  return (
    <section style={{ background: '#faf6ee', padding: 'clamp(64px,8vw,96px) 0 clamp(48px,6vw,64px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <motion.div {...reveal} style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#5e6a48',
              margin: '0 0 clamp(28px,3.5vw,40px)',
            }}
          >
            Utviklet med støtte fra
          </p>
          {/* Wraps to a stack on the narrowest phones, where the two logos at their
              minimum size no longer fit on one line — so the row never overflows. */}
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(24px,6vw,88px)',
            }}
          >
            {SUPPORTERS.map((supporter) => {
              const logo = (
                <Image
                  src={supporter.logoUrl}
                  alt={supporter.name}
                  width={supporter.width}
                  height={supporter.height}
                  sizes="(max-width: 640px) 45vw, 240px"
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxHeight: LOGO_MAX_HEIGHT,
                    maxWidth: LOGO_MAX_WIDTH,
                    objectFit: 'contain',
                  }}
                />
              )

              return (
                <li key={supporter.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {supporter.href ? (
                    <a
                      href={supporter.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      {logo}
                    </a>
                  ) : (
                    logo
                  )}
                </li>
              )
            })}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
