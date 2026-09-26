'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { calculateRecommendation } from '@/lib/bedrifter/calculator/calculate'
import { CALCULATOR_FIELDS } from '@/lib/bedrifter/calculator/config'
import type {
  CalculatorAnswers,
  CalculatorOutcome,
  SolutionKind,
} from '@/lib/bedrifter/calculator/types'
import {
  trackCalculatorResultViewed,
  trackCalculatorSolutionClicked,
  trackCalculatorTypeSelected,
} from '@/lib/analytics'
import CalculatorFields, { isFieldVisible, type FieldValues } from './CalculatorFields'
import CalculatorResult from './CalculatorResult'
import CalculatorTypeSelector from './CalculatorTypeSelector'
import {
  ANCHOR_OFFSET,
  BEIGE,
  INK,
  MUTED,
  SANS,
  SECTION_PAD,
  SOFT,
  eyebrowStyle,
  h2Style,
  introStyle,
} from '../theme'
import type { RevealProps } from '../useReveal'

/** How long the numbers must stand still before a result counts as "viewed". */
const RESULT_EVENT_DELAY_MS = 1200

/**
 * The B2B solution calculator: pick a kind of workplace, answer a few numbers, get a
 * recommended quantity of each product and a link that carries those quantities into the
 * solution configurator.
 *
 * It owns nothing but its answers. The rules live in `@/lib/bedrifter/calculator`, the
 * products and prices stay in Payload and the configurator, and no recommendation ever
 * reaches the cart — the customer still chooses colours on the solution page.
 *
 * Answers are kept per kind, so switching from a borettslag with 48 apartments to an office
 * cannot silently turn into 48 employees.
 */
export default function BusinessCalculator({
  reveal,
  /** Live CMS titles by product slug, so the result names products as the shop does. */
  productTitles,
  anchorId = 'kalkulator',
}: {
  reveal: (delay?: number) => RevealProps
  productTitles: Record<string, string>
  anchorId?: string
}) {
  const [kind, setKind] = useState<SolutionKind | null>(null)
  const [valuesByKind, setValuesByKind] = useState<Partial<Record<SolutionKind, FieldValues>>>({})

  const values: FieldValues = (kind && valuesByKind[kind]) || {}

  const selectKind = (next: SolutionKind) => {
    setKind(next)
    trackCalculatorTypeSelected(next)
  }

  const setValue = (fieldId: string, value: string) => {
    if (!kind) return
    setValuesByKind((current) => ({
      ...current,
      [kind]: { ...(current[kind] ?? {}), [fieldId]: value },
    }))
  }

  const reset = () => {
    setKind(null)
    setValuesByKind({})
  }

  /**
   * The answers the rules see. Only digits count, only fields currently on screen are read
   * (so a hidden "antall bygg" from a previous choice cannot influence the result), and a
   * value beyond the field's ceiling is capped rather than trusted.
   */
  const answers: CalculatorAnswers = { numbers: {}, choices: {} }
  if (kind) {
    for (const field of CALCULATOR_FIELDS[kind]) {
      if (!isFieldVisible(field, values)) continue
      const raw = values[field.id]
      if (field.type === 'choice') {
        answers.choices[field.id] = raw
        continue
      }
      const digits = (raw ?? '').replace(/[^\d]/g, '')
      if (digits === '') continue
      const parsed = Number.parseInt(digits, 10)
      if (!Number.isFinite(parsed)) continue
      answers.numbers[field.id] = Math.min(parsed, field.max)
    }
  }

  const outcome: CalculatorOutcome | null = kind ? calculateRecommendation(kind, answers) : null

  // One `calculator_result_viewed` per settled recommendation — not one per keystroke. The
  // signature is what was recommended, so re-typing the same number reports nothing new.
  const lastReported = useRef('')
  const signature =
    outcome?.status === 'ready'
      ? `${outcome.recommendation.solutionSlug}:${outcome.recommendation.lines
          .map((line) => `${line.slug}=${line.quantity}`)
          .join(',')}`
      : ''

  useEffect(() => {
    if (!signature || signature === lastReported.current) return
    const timer = setTimeout(() => {
      lastReported.current = signature
      const [solutionSlug] = signature.split(':')
      trackCalculatorResultViewed(solutionSlug)
    }, RESULT_EVENT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [signature])

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-heading`}
      style={{ background: BEIGE, padding: SECTION_PAD, scrollMarginTop: ANCHOR_OFFSET }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <motion.div {...reveal()} style={{ maxWidth: '720px' }}>
          <p style={eyebrowStyle}>Finn riktig løsning</p>
          <h2 id={`${anchorId}-heading`} style={h2Style}>
            Hvor mange aBoks trenger dere?
          </h2>
          <p style={introStyle}>
            Svar på noen enkle spørsmål, så foreslår vi en løsning tilpasset virksomheten.
          </p>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: 1.6,
              color: MUTED,
              margin: '12px 0 0',
            }}
          >
            Anbefalingen er veiledende og kan justeres etter behov.
          </p>
        </motion.div>

        <motion.div
          {...reveal(0.06)}
          className="mt-[clamp(36px,4.5vw,56px)] grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]"
          style={{ gap: 'clamp(20px,2.6vw,32px)', alignItems: 'start' }}
        >
          {/* Questions */}
          <div
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: 'clamp(24px,2.8vw,34px)',
            }}
          >
            <h3
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: '16px',
                color: INK,
                margin: '0 0 16px',
              }}
            >
              Hva slags virksomhet gjelder det?
            </h3>
            <CalculatorTypeSelector selected={kind} onSelect={selectKind} />

            {kind && (
              <div
                style={{
                  marginTop: 'clamp(26px,3vw,34px)',
                  paddingTop: 'clamp(24px,2.8vw,30px)',
                  borderTop: '1px solid rgba(26,29,23,.10)',
                }}
              >
                <CalculatorFields kind={kind} values={values} onChange={setValue} />

                <button
                  type="button"
                  onClick={reset}
                  style={{
                    marginTop: 'clamp(22px,2.4vw,28px)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: '14px',
                    color: SOFT,
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Nullstill
                </button>
              </div>
            )}
          </div>

          {/* Recommendation — beside the questions on a wide screen, under them otherwise */}
          <div className="lg:sticky lg:top-[120px]">
            <CalculatorResult
              outcome={outcome}
              productTitles={productTitles}
              onSolutionClick={(target) => {
                if (outcome?.status !== 'ready') return
                trackCalculatorSolutionClicked(outcome.recommendation.solutionSlug, target)
              }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
