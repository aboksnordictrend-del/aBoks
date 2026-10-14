'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  EARNINGS_EXAMPLE,
  EARNINGS_ORDER_COUNTS,
  PARTNER_DISCOUNT_PERCENT,
  earningsSeries,
  formatNok,
  formatPercent,
} from '@/lib/partnerProgram/calculator'
import { BORDER_WARM, INK, MUTED, OLIVE, SANS, SOFT } from '../bedrifter/theme'

/**
 * Chart A — illustrative commission at 10, 25, 50 and 100 orders.
 *
 * Deliberately independent of the calculator, with its assumptions printed above the plot:
 * 800 kr per order, no corporate discount and the 10 % partner discount. Every bar comes from
 * `earningsSeries`, the same calculation as the calculator (whose commission step is the real
 * engine).
 *
 * Plain HTML bars rather than a chart library (recharts is only used in the admin, and this
 * keeps it out of the public bundle). The y-axis always starts at 0 and ends on a round value
 * just above the largest bar, so bar heights are honest proportions. A single series needs no
 * legend; every bar is direct-labelled and the same numbers are available as a table.
 */

const SERIES = earningsSeries(EARNINGS_EXAMPLE, EARNINGS_ORDER_COUNTS)

/** Round the axis up to 1, 2, 2.5 or 5 × a power of ten, split into four steps. */
export function niceAxisMax(maxValue: number): { max: number; step: number } {
  if (maxValue <= 0) return { max: 1, step: 0.25 }
  const raw = maxValue / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= maxValue) ?? 10 * pow
  return { max: step * 4, step }
}

export default function EarningsChart() {
  const reduceMotion = useReducedMotion()
  const maxOere = Math.max(...SERIES.map((p) => p.commissionOere))
  const { max, step } = niceAxisMax(maxOere)
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step)

  return (
    <figure style={{ margin: 0 }} aria-labelledby="earnings-chart-title">
      <figcaption>
        <p
          id="earnings-chart-title"
          style={{ fontFamily: SANS, fontWeight: 700, fontSize: '16px', color: INK, margin: 0 }}
        >
          Illustrert provisjon per måned
        </p>
        <p style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.6, color: MUTED, margin: '6px 0 0' }}>
          Forutsetninger: {formatNok(EARNINGS_EXAMPLE.orderValueKr * 100)} per ordre før rabatt, ingen
          bedriftsrabatt og {formatPercent(PARTNER_DISCOUNT_PERCENT)} rabatt med promokoden. Uavhengig av
          kalkulatoren.
        </p>
      </figcaption>

      <div aria-hidden="true" className="relative mt-6" style={{ height: '260px', marginLeft: '64px' }}>
        {/* Recessive grid and y-axis labels. */}
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0"
            style={{ bottom: `${(tick / max) * 100}%`, borderTop: `1px ${tick === 0 ? 'solid' : 'dashed'} ${BORDER_WARM}` }}
          >
            <span
              className="absolute"
              style={{
                right: 'calc(100% + 10px)',
                transform: 'translateY(-50%)',
                fontFamily: SANS,
                fontSize: '12px',
                color: MUTED,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatNok(tick)}
            </span>
          </div>
        ))}

        <div className="absolute inset-0 flex items-end justify-around gap-[6%] px-[4%]">
          {SERIES.map((point, i) => (
            <div key={point.orders} className="relative flex h-full flex-1 flex-col justify-end" style={{ maxWidth: '88px' }}>
              <motion.div
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.9, delay: 0.1 * i, ease: [0.22, 0.61, 0.36, 1] }
                }
                style={{
                  height: `${(point.commissionOere / max) * 100}%`,
                  background: OLIVE,
                  borderRadius: '4px 4px 0 0',
                  transformOrigin: 'bottom',
                }}
              />
              {/* A sibling of the bar, not a child, so the scale animation never squashes it. */}
              <motion.span
                className="absolute left-1/2 -translate-x-1/2"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.6 + 0.1 * i }}
                style={{
                  bottom: `calc(${(point.commissionOere / max) * 100}% + 6px)`,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: 'clamp(11.5px,1.4vw,13.5px)',
                  color: INK,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNok(point.commissionOere)}
              </motion.span>
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-around gap-[6%] px-[4%]" style={{ marginLeft: '64px' }}>
        {SERIES.map((point) => (
          <span
            key={point.orders}
            className="flex-1 text-center"
            style={{ maxWidth: '88px', fontFamily: SANS, fontSize: '12.5px', fontWeight: 600, color: SOFT }}
          >
            {point.orders} ordrer
          </span>
        ))}
      </div>

      <details className="mt-5">
        <summary style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 600, color: OLIVE, cursor: 'pointer' }}>
          Vis tallene som tabell
        </summary>
        <table className="mt-3 w-full" style={{ borderCollapse: 'collapse', fontFamily: SANS, fontSize: '14px', color: INK }}>
          <caption className="sr-only">Illustrert provisjon etter antall ordrer</caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 0', borderBottom: `1px solid ${BORDER_WARM}` }}>
                Antall ordrer
              </th>
              <th scope="col" style={{ textAlign: 'right', padding: '8px 0', borderBottom: `1px solid ${BORDER_WARM}` }}>
                Provisjon
              </th>
            </tr>
          </thead>
          <tbody>
            {SERIES.map((point) => (
              <tr key={point.orders}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 500, padding: '8px 0', borderBottom: `1px solid ${BORDER_WARM}` }}>
                  {point.orders}
                </th>
                <td style={{ textAlign: 'right', padding: '8px 0', borderBottom: `1px solid ${BORDER_WARM}`, fontVariantNumeric: 'tabular-nums' }}>
                  {formatNok(point.commissionOere)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
