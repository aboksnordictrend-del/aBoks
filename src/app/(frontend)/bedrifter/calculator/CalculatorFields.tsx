'use client'

import { useId } from 'react'
import { CALCULATOR_FIELDS } from '@/lib/bedrifter/calculator/config'
import type { CalculatorField, SolutionKind } from '@/lib/bedrifter/calculator/types'
import { BORDER_WARM, INK, MUTED, OLIVE, SANS, SOFT } from '../theme'

/** The raw state of one kind's answers: field id → what is in the field right now. */
export type FieldValues = Record<string, string>

/** Is this field shown, given what else has been answered? */
export function isFieldVisible(field: CalculatorField, values: FieldValues): boolean {
  if (!field.showWhen) return true
  return values[field.showWhen.field] === field.showWhen.equals
}

/**
 * Step two: the few numbers the recommendation needs.
 *
 * Text inputs with a numeric input mode rather than `type="number"` — the same choice the
 * quantity stepper makes, and for the same reasons: the numeric keyboard on a phone, no
 * spinner arrows, and a minus sign that cannot be typed. Values are held as strings so a
 * field can be genuinely empty rather than silently zero.
 */
export default function CalculatorFields({
  kind,
  values,
  onChange,
}: {
  kind: SolutionKind
  values: FieldValues
  onChange: (fieldId: string, value: string) => void
}) {
  const scope = useId()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px,2vw,22px)' }}>
      {CALCULATOR_FIELDS[kind].filter((field) => isFieldVisible(field, values)).map((field) => {
        const fieldId = `${scope}-${field.id}`

        if (field.type === 'choice') {
          return (
            <fieldset key={field.id} style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: '14.5px',
                  color: INK,
                  padding: 0,
                  marginBottom: '10px',
                }}
              >
                {field.label}
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {field.options.map((option) => {
                  const active = values[field.id] === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onChange(field.id, option.value)}
                      style={{
                        fontFamily: SANS,
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '10px 18px',
                        borderRadius: '999px',
                        color: active ? '#faf6ee' : '#4a4e41',
                        background: active ? OLIVE : '#fff',
                        border: active ? `1.5px solid ${OLIVE}` : `1.5px solid ${BORDER_WARM}`,
                      }}
                    >
                      {active && (
                        <span aria-hidden="true" style={{ marginRight: '7px', fontSize: '12px' }}>
                          ✓
                        </span>
                      )}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )
        }

        return (
          <div key={field.id}>
            <label
              htmlFor={fieldId}
              style={{
                display: 'block',
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: '14.5px',
                color: INK,
                marginBottom: '8px',
              }}
            >
              {field.label}
            </label>
            {field.help && (
              <p
                id={`${fieldId}-help`}
                style={{
                  fontFamily: SANS,
                  fontSize: '13px',
                  lineHeight: 1.55,
                  color: MUTED,
                  margin: '0 0 10px',
                  maxWidth: '52ch',
                }}
              >
                {field.help}
              </p>
            )}
            <input
              id={fieldId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="0"
              aria-describedby={field.help ? `${fieldId}-help` : undefined}
              value={values[field.id] ?? ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              style={{
                width: '100%',
                maxWidth: '180px',
                height: '50px',
                padding: '0 18px',
                borderRadius: '14px',
                border: `1.5px solid ${BORDER_WARM}`,
                background: '#fff',
                fontFamily: SANS,
                fontWeight: 600,
                // 16px keeps iOS from zooming the page when the field takes focus.
                fontSize: '16px',
                color: SOFT,
                outlineColor: OLIVE,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
