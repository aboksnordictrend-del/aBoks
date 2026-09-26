'use client'

import { useState } from 'react'
import {
  SOLUTION_QTY_MAX,
  SOLUTION_QTY_MIN,
  normalizeQuantity,
} from '@/lib/solutions/quantity'
import { INK } from '../theme'

/**
 * The range and the parsing rule live in `@/lib/solutions/quantity`, so the server route can
 * apply the same limits to a quantity handed over in a URL. Re-exported here because this is
 * where the configurator's callers already look for them.
 */
export { SOLUTION_QTY_MAX, SOLUTION_QTY_MIN, normalizeQuantity }

/**
 * Minus / editable quantity / plus, in the pill the product page uses.
 *
 * The middle is a real input, because a workplace ordering 300 units cannot click a plus
 * button 300 times. It is a text field with a numeric input mode rather than
 * `type="number"`: that brings up the numeric keyboard on a phone, brings no spinner arrows
 * to fight the pill, and makes a minus sign or an "e" impossible to type in the first place.
 *
 * Unlike the product page's stepper this one goes down to 0, which is how a configurator
 * says "not this product", and up to 9999. It is not bounded by inventory either: a solution
 * page is quoting a workplace, not selling from today's shelf, and the cart and checkout
 * enforce what they always have.
 */
export default function QuantityStepper({
  value,
  onChange,
  min = SOLUTION_QTY_MIN,
  max = SOLUTION_QTY_MAX,
  label,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  /** Names the control for a screen reader — "Antall aBoks Office". */
  label: string
}) {
  /**
   * What the field shows while it is being edited, or null when it simply mirrors `value`.
   *
   * This is what lets the field be empty mid-edit: clearing it to type a new number must not
   * snap to 0 under the customer's fingers. The committed state stays a valid integer the
   * whole time — an empty field is worth `min` to everything outside this component.
   */
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(value)

  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  /** A button press ends any edit in progress, so the field follows the new value. */
  const step = (next: number) => {
    setDraft(null)
    onChange(clamp(next))
  }

  const handleInput = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '')
    if (digits === '') {
      // Held, not committed: the customer is mid-edit.
      setDraft('')
      return
    }
    const next = normalizeQuantity(digits, min, max)
    setDraft(String(next))
    onChange(next)
  }

  /** Blur and Enter both land here: normalise what is there and hand the field back. */
  const commit = () => {
    if (draft === null) return
    const next = normalizeQuantity(draft, min, max)
    setDraft(null)
    onChange(next)
  }

  const atMin = value <= min
  const atMax = value >= max

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
        onClick={() => step(value - 1)}
        disabled={atMin}
        aria-label={`Færre – ${label}`}
        style={{
          width: '48px',
          height: '50px',
          background: 'none',
          border: 'none',
          cursor: atMin ? 'not-allowed' : 'pointer',
          fontSize: '22px',
          color: atMin ? '#b3ab9a' : INK,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        value={shown}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            e.currentTarget.blur()
          }
        }}
        // Tapping the number offers it for replacement rather than for the caret.
        onFocus={(e) => e.currentTarget.select()}
        style={{
          // Four digits plus breathing room; the pill keeps its shape from 0 to 9999.
          width: '62px',
          height: '50px',
          padding: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          textAlign: 'center',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 700,
          // 16px keeps iOS from zooming the page when the field takes focus.
          fontSize: '16px',
          color: INK,
          MozAppearance: 'textfield',
        }}
      />

      <button
        type="button"
        onClick={() => step(value + 1)}
        disabled={atMax}
        aria-label={`Flere – ${label}`}
        style={{
          width: '48px',
          height: '50px',
          background: 'none',
          border: 'none',
          cursor: atMax ? 'not-allowed' : 'pointer',
          fontSize: '22px',
          color: atMax ? '#b3ab9a' : INK,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        +
      </button>

      {/* The buttons change a field nobody is focused on, which a screen reader would not
          otherwise announce. This says the new count. */}
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {`${label}: ${value}`}
      </span>
    </div>
  )
}
