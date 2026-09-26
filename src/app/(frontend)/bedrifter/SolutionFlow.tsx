'use client'

import { motion } from 'framer-motion'
import { SOLUTION_FLOW } from '@/lib/bedrifterSolutions'
import { BORDER_WARM, CREAM, INK, MUTED, SANS, SERIF } from './theme'
import type { RevealProps } from './useReveal'

/**
 * The four steps of the system, from the workplace to the shared collection point.
 *
 * One row of steps from `lg` up, with the dashed connector running to the right of each
 * number — the same treatment the "Fra behov til forslag" steps use further down the page.
 * Below `lg` the row becomes a column and the connector turns into a short vertical dash
 * under each step, so the sequence still reads as one flow. Four columns only from `lg`:
 * on a tablet they would leave about eleven characters per line.
 */
export default function SolutionFlow({
  reveal,
  steps = SOLUTION_FLOW,
}: {
  reveal: (delay?: number) => RevealProps
  /** Defaults to the four steps of the system shown on /bedrifter. A solution page passes
   *  its own, so both read as the same flow in the same shape. */
  steps?: typeof SOLUTION_FLOW
}) {
  return (
    <ol
      className="grid grid-cols-1 lg:grid-cols-4"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        columnGap: 'clamp(20px,2.6vw,36px)',
        rowGap: '0',
      }}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        return (
          <motion.li key={step.number} {...reveal(i * 0.08)}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
              <span
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '999px',
                  background: CREAM,
                  border: '1.5px solid #c0b49a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: '21px',
                  color: INK,
                  flexShrink: 0,
                }}
              >
                {step.number}
              </span>
              {!last && (
                <span
                  aria-hidden="true"
                  className="hidden lg:block"
                  style={{ flexGrow: 1, marginLeft: '14px', borderTop: `1.5px dashed ${BORDER_WARM}` }}
                />
              )}
            </div>

            <h3
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: '17px',
                lineHeight: 1.35,
                color: INK,
                margin: '0 0 9px',
              }}
            >
              {step.title}
            </h3>
            <p
              style={{
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: 1.65,
                color: MUTED,
                margin: 0,
                maxWidth: '38ch',
              }}
            >
              {step.text}
            </p>

            {/* Vertical leg between two steps on a phone — the horizontal dash above is
                hidden there, and without this the column reads as four separate items. */}
            {!last && (
              <span
                aria-hidden="true"
                className="lg:hidden"
                style={{
                  display: 'block',
                  width: '1.5px',
                  height: '34px',
                  margin: '18px 0 18px 25px',
                  borderLeft: `1.5px dashed ${BORDER_WARM}`,
                }}
              />
            )}
          </motion.li>
        )
      })}
    </ol>
  )
}
