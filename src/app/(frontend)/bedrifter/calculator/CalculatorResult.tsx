'use client'

import Link from 'next/link'
import { recommendationHref } from '@/lib/bedrifter/calculator/calculate'
import type { CalculatorOutcome } from '@/lib/bedrifter/calculator/types'
import {
  BORDER_WARM,
  CREAM,
  GOLD,
  INK,
  MUTED,
  OLIVE,
  PALE_SAGE,
  SANS,
  SERIF,
  SOFT,
  cardLabelStyle,
  primaryButton,
  secondaryButton,
} from '../theme'

/**
 * The recommendation panel.
 *
 * Quantities only — no prices. What something costs depends on the colours and quantities
 * the customer settles on in the solution configurator, and duplicating pricing here would
 * be a second opinion about it. The two actions carry the recommended quantities to that
 * configurator in the URL.
 *
 * `aria-live="polite"` on the panel: the numbers change as the customer types, and a screen
 * reader is told the new recommendation without losing the field it is in.
 */
export default function CalculatorResult({
  outcome,
  /** Live CMS titles by product slug, so the panel names products as the shop does. */
  productTitles,
  onSolutionClick,
}: {
  outcome: CalculatorOutcome | null
  productTitles: Record<string, string>
  onSolutionClick?: (target: 'solution' | 'inquiry') => void
}) {
  const empty = outcome === null || outcome.status === 'incomplete'

  return (
    <div
      aria-live="polite"
      style={{
        background: empty ? '#fff' : PALE_SAGE,
        border: empty ? `1px dashed ${BORDER_WARM}` : 'none',
        borderRadius: '24px',
        padding: 'clamp(24px,2.8vw,34px)',
      }}
    >
      {empty ? (
        <>
          <p style={{ ...cardLabelStyle, margin: '0 0 12px' }}>Anbefalt løsning</p>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '15px',
              lineHeight: 1.65,
              color: SOFT,
              margin: 0,
            }}
          >
            {outcome?.status === 'incomplete'
              ? outcome.message
              : 'Velg type virksomhet for å se anbefalt løsning.'}
          </p>
        </>
      ) : (
        <>
          <p style={{ ...cardLabelStyle, margin: '0 0 12px' }}>Anbefalt løsning</p>
          <h3
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 'clamp(24px,2.4vw,32px)',
              letterSpacing: '-0.015em',
              lineHeight: 1.12,
              color: INK,
              margin: 0,
            }}
          >
            {outcome.recommendation.solutionName}
          </h3>

          <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
            {outcome.recommendation.lines.map((line) => (
              <li
                key={line.slug}
                style={{
                  padding: '14px 0',
                  borderTop: '1px solid rgba(26,29,23,.10)',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: '16px',
                    color: INK,
                  }}
                >
                  {line.quantity} × {productTitles[line.slug] ?? line.name}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontFamily: SANS,
                    fontSize: '13.5px',
                    lineHeight: 1.55,
                    color: MUTED,
                    marginTop: '3px',
                  }}
                >
                  {line.note}
                </span>
              </li>
            ))}
          </ul>

          {outcome.recommendation.basis && (
            <p
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: 1.6,
                color: SOFT,
                margin: '18px 0 0',
                paddingTop: '18px',
                borderTop: '1px solid rgba(26,29,23,.10)',
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: '20px', height: '1.5px', background: GOLD, flexShrink: 0, marginTop: '11px' }}
              />
              {outcome.recommendation.basis}
            </p>
          )}

          {outcome.recommendation.pending && (
            <p
              style={{
                fontFamily: SANS,
                fontSize: '14px',
                lineHeight: 1.6,
                color: OLIVE,
                margin: '14px 0 0',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,.6)',
              }}
            >
              {outcome.recommendation.pending}
            </p>
          )}

          <div className="mt-[22px] flex flex-wrap gap-3">
            <Link
              // Straight to the configurator, quantities and all: the recommendation is
              // already filled in there, so the top of the page has nothing to add.
              href={recommendationHref(outcome.recommendation, 'konfigurer')}
              data-btn
              onClick={() => onSolutionClick?.('solution')}
              className="w-full justify-center px-8 sm:w-auto"
              style={{ ...primaryButton, background: OLIVE, color: CREAM }}
            >
              Tilpass løsningen
            </Link>
            <Link
              href={recommendationHref(outcome.recommendation, 'foresporsel')}
              data-btn
              onClick={() => onSolutionClick?.('inquiry')}
              className="w-full justify-center px-8 sm:w-auto"
              style={secondaryButton}
            >
              Be om tilbud
            </Link>
          </div>

          <p
            style={{
              fontFamily: SANS,
              fontSize: '13px',
              lineHeight: 1.6,
              color: MUTED,
              margin: '16px 0 0',
            }}
          >
            Dette er en veiledende anbefaling. Antall og plassering kan tilpasses byggets
            utforming og behov.
          </p>
        </>
      )}
    </div>
  )
}
