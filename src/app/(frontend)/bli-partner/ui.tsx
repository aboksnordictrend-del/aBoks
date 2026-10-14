'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'
import type { TermIcon } from '@/lib/partnerProgram/content'
import { SAGE, eyebrowStyle, h2Style, introStyle } from '../bedrifter/theme'

/**
 * Small pieces shared by the /bli-partner sections: the icon set, the animated figure and the
 * section heading. Typography and colours come from the /bedrifter theme module, which is the
 * site's shared type scale for the business pages — this page deliberately adds no new tokens.
 */

/* ────────────────────────────── icons ────────────────────────────── */

/** Stroke paths on a 24×24 grid, matching the line icons used elsewhere on the site. */
const ICON_PATHS: Record<TermIcon | 'check' | 'arrow' | 'lock', string> = {
  free: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.7 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  approval: 'M9 12.5l2 2 4-4.5M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6l7-3z',
  contract: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4',
  code: 'M4 7h16v10H4zM8 12h.01M12 12h.01M16 12h.01',
  discount: 'M19 5L5 19M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  commission: 'M4 19h16M7 15V10M12 15V6M17 15v-3',
  repeat: 'M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5',
  self: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5',
  map: 'M12 21s-6-5.4-6-11a6 6 0 1112 0c0 5.6-6 11-6 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  noStock: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8M4 4l16 16',
  service: 'M4 13a8 8 0 0116 0v4a2 2 0 01-2 2h-1v-6h3M4 13v4a2 2 0 002 2h1v-6H4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  check: 'M20 6L9 17l-5-5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
}

export function Icon({
  name,
  size = 22,
  color = SAGE,
  strokeWidth = 1.7,
}: {
  name: keyof typeof ICON_PATHS
  size?: number
  color?: string
  strokeWidth?: number
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

/* ────────────────────────────── animated figure ────────────────────────────── */

/**
 * A number that counts to its value — once when it first scrolls into view, then from the
 * previous value whenever `value` changes (the calculator).
 *
 * Hydration-safe: the server and the first client render both print the final formatted
 * value, so the markup always matches. The animated text is `aria-hidden`; screen readers get
 * the final value from a visually hidden twin, never the intermediate frames. Under reduced
 * motion the value is simply shown.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 0.9,
  countFromZero = false,
}: {
  value: number
  format: (n: number) => string
  duration?: number
  /** Start from 0 the first time the figure is seen (for headline figures). */
  countFromZero?: boolean
}) {
  const ref = useRef<HTMLSpanElement>(null)
  // Triggers just BEFORE the figure enters the viewport, so the reset to 0 for a count-up is
  // never seen — only the count itself.
  const inView = useInView(ref, { once: true, margin: '0px 0px 120px 0px' })
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(value)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    if (!inView) return
    const from = previous.current ?? (countFromZero ? 0 : value)
    previous.current = value
    if (reduceMotion || from === value) {
      setShown(value)
      return
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (latest) => setShown(latest),
    })
    return () => controls.stop()
  }, [value, inView, reduceMotion, countFromZero, duration])

  return (
    <span ref={ref}>
      <span aria-hidden="true" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {format(inView ? shown : value)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

/* ────────────────────────────── headings ────────────────────────────── */

/** An h3 block heading inside a method tab: the section's h2 already sits above it. */
export function SubHeading({
  eyebrow,
  title,
  intro,
  id,
}: {
  eyebrow?: string
  title: React.ReactNode
  intro?: React.ReactNode
  id?: string
}) {
  return (
    <div>
      {eyebrow && <p style={{ ...eyebrowStyle, margin: '0 0 12px' }}>{eyebrow}</p>}
      <h3
        id={id}
        style={{
          ...h2Style,
          fontSize: 'clamp(28px,3vw,40px)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      {intro && <p style={{ ...introStyle, fontSize: 'clamp(15.5px,1.3vw,17px)', marginTop: '12px' }}>{intro}</p>}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
  light = false,
  center = false,
}: {
  eyebrow?: string
  title: React.ReactNode
  intro?: React.ReactNode
  /** id for the h2, so the section can be `aria-labelledby` it. */
  id: string
  /** For headings on a dark background. */
  light?: boolean
  center?: boolean
}) {
  return (
    <div style={center ? { textAlign: 'center', marginInline: 'auto', maxWidth: '760px' } : undefined}>
      {eyebrow && (
        <p style={{ ...eyebrowStyle, ...(light ? { color: '#c9d1b8' } : null) }}>{eyebrow}</p>
      )}
      <h2 id={id} style={{ ...h2Style, ...(light ? { color: '#faf6ee' } : null) }}>
        {title}
      </h2>
      {intro && (
        <p
          style={{
            ...introStyle,
            ...(light ? { color: 'rgba(250,246,238,.82)' } : null),
            ...(center ? { marginInline: 'auto' } : null),
          }}
        >
          {intro}
        </p>
      )}
    </div>
  )
}
