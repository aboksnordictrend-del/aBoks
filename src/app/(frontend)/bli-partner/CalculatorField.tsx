'use client'

import { useId } from 'react'
import { BORDER_WARM, CREAM, INK, MUTED, SANS } from '../bedrifter/theme'
import styles from './bliPartner.module.css'

/**
 * One calculator input on /bli-partner: a labelled text field for exact values and a range
 * slider for quick ones, bound to the same value. Shared by the Promokode calculator and the
 * Bedriftssalg / Forhandlersalg calculators.
 *
 * The value is held as the string the visitor typed, so a half-typed number never jumps; on
 * blur the field snaps to `sliderValue`, which the caller passes as the normalised input it
 * actually calculated with.
 */

/** «50 000», «50000», «1 299,5» → number; anything else → NaN (the calculator then clamps). */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.')
  return cleaned === '' ? Number.NaN : Number(cleaned)
}

export function Field({
  label,
  hint,
  suffix,
  value,
  onChange,
  slider,
  sliderValue,
  formatSlider,
}: {
  label: string
  hint: string
  suffix?: string
  value: string
  onChange: (value: string) => void
  slider: { min: number; max: number; step: number }
  sliderValue: number
  formatSlider: (n: number) => string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const clamped = Math.min(Math.max(sliderValue, slider.min), slider.max)
  const fill = ((clamped - slider.min) / (slider.max - slider.min)) * 100

  return (
    <div style={{ marginBottom: '22px' }}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <label htmlFor={id} style={{ fontFamily: SANS, fontWeight: 700, fontSize: '14.5px', color: INK }}>
          {label}
          <span id={hintId} style={{ display: 'block', fontWeight: 500, fontSize: '12.5px', color: MUTED, marginTop: '2px' }}>
            {hint}
          </span>
        </label>
        <span
          className="flex items-center"
          style={{ border: `1px solid ${BORDER_WARM}`, borderRadius: '12px', background: CREAM, paddingRight: suffix ? '12px' : 0 }}
        >
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={hintId}
            style={{
              width: suffix === 'kr' ? '120px' : '84px',
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: '16px',
              color: INK,
              textAlign: 'right',
              outline: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
            onBlur={() => {
              // Snap to what was actually calculated, so the field never shows a value the
              // result does not reflect (e.g. «0» orders, or 90 % corporate discount).
              // `sliderValue` is the calculator's normalised input, not the slider's range.
              if (parseNumber(value) !== sliderValue) onChange(String(sliderValue))
            }}
          />
          {suffix && (
            <span aria-hidden="true" style={{ fontFamily: SANS, fontWeight: 600, fontSize: '14px', color: MUTED }}>
              {suffix}
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        className={`${styles.range} mt-3`}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={clamped}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}, glidebryter`}
        aria-valuetext={formatSlider(clamped)}
        style={{ ['--fill' as string]: `${fill}%` } as React.CSSProperties}
      />
    </div>
  )
}
