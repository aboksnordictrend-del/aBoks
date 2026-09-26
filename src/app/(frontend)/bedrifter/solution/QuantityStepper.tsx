'use client'

import { INK } from '../theme'

/**
 * Minus / value / plus, in the pill the product page uses.
 *
 * Unlike the product page's stepper this one goes down to 0, which is how a configurator
 * says "not this product" — the caller decides what a zero line means. It is not bounded by
 * inventory either: a solution page is quoting a workplace, not selling from today's shelf,
 * and the cart and checkout enforce what they always have.
 */
export default function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  /** Names the control for a screen reader — "Antall aBoks Office". */
  label: string
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1.5px solid #d6cfbd',
        borderRadius: '999px',
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`Færre – ${label}`}
        style={{
          width: '48px',
          height: '50px',
          background: 'none',
          border: 'none',
          cursor: value <= min ? 'not-allowed' : 'pointer',
          fontSize: '22px',
          color: value <= min ? '#b3ab9a' : INK,
          lineHeight: 1,
        }}
      >
        −
      </button>
      {/* aria-live so a screen reader hears the new count without moving focus. */}
      <span
        aria-live="polite"
        style={{
          minWidth: '42px',
          textAlign: 'center',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 700,
          fontSize: '16px',
          color: INK,
        }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`Flere – ${label}`}
        style={{
          width: '48px',
          height: '50px',
          background: 'none',
          border: 'none',
          cursor: value >= max ? 'not-allowed' : 'pointer',
          fontSize: '22px',
          color: value >= max ? '#b3ab9a' : INK,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  )
}
