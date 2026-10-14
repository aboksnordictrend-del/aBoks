'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  formatNok,
  formatPercent,
  type PartnerExampleResult,
} from '@/lib/partnerProgram/calculator'
import { BORDER_WARM, INK, MUTED, OLIVE, SANS, SOFT } from '../bedrifter/theme'

/**
 * Chart B — one order, step by step, as a horizontal waterfall on a single scale (the
 * original price).
 *
 * Two labelled stages, on the same base throughout — the amount the customer pays:
 *
 *   1. The price the customer pays: original price, minus the corporate discount, minus the
 *      partner discount.
 *   2. How that payment divides: the partner's commission, and what ABOKS AS keeps. The two
 *      add up to exactly what the customer paid, because the commission engine takes its
 *      share of that amount (shipping excluded).
 *
 * Every row carries its own name and amount, so nothing is identified by colour alone. Two
 * fills only: the brand olive for amounts, and a warm amber for what is taken away.
 */

const AMOUNT = OLIVE
const DEDUCTION = '#c98f2e'

interface Row {
  label: string
  note?: string
  /** Where the bar starts and ends, in øre on the shared scale. */
  from: number
  to: number
  value: number
  kind: 'amount' | 'deduction'
  sign?: '−' | '='
}

export default function OrderBreakdown({ result }: { result: PartnerExampleResult }) {
  const reduceMotion = useReducedMotion()
  const o = result.perOrder
  const { corporateDiscountPercent, partnerDiscountPercent, commissionPercent } = result.input
  const scale = Math.max(o.originalOere, 1)

  const priceRows: Row[] = [
    { label: 'Opprinnelig pris', note: 'før rabatt', from: 0, to: o.originalOere, value: o.originalOere, kind: 'amount' },
    ...(o.corporateDiscountOere > 0
      ? [
          {
            label: `Bedriftsrabatt ${formatPercent(corporateDiscountPercent)}`,
            from: o.afterCorporateOere,
            to: o.originalOere,
            value: o.corporateDiscountOere,
            kind: 'deduction' as const,
            sign: '−' as const,
          },
        ]
      : []),
    {
      label: `Promokode-rabatt ${formatPercent(partnerDiscountPercent)}`,
      note: o.corporateDiscountOere > 0 ? 'av prisen etter bedriftsrabatt' : undefined,
      from: o.customerPaysOere,
      to: o.afterCorporateOere,
      value: o.partnerDiscountOere,
      kind: 'deduction',
      sign: '−',
    },
    { label: 'Kunden betaler', note: 'for varene, uten frakt', from: 0, to: o.customerPaysOere, value: o.customerPaysOere, kind: 'amount', sign: '=' },
  ]

  const splitRows: Row[] = [
    {
      label: `Provisjon ${formatPercent(commissionPercent)}`,
      note: 'av beløpet kunden betaler',
      from: o.retainedOere,
      to: o.customerPaysOere,
      value: o.commissionOere,
      kind: 'deduction',
      sign: '−',
    },
    { label: 'ABOKS AS beholder', note: 'før produksjon og driftskostnader', from: 0, to: o.retainedOere, value: o.retainedOere, kind: 'amount', sign: '=' },
  ]

  let index = 0
  const renderRows = (rows: Row[]) =>
    rows.map((row) => {
      const i = index++
      const fill = row.kind === 'deduction' ? DEDUCTION : AMOUNT
      return (
        <li
          key={row.label}
          className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-[minmax(170px,30%)_1fr_auto] sm:items-center"
          style={{ padding: '9px 0' }}
        >
          <span style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.35, color: INK }}>
            <span style={{ fontWeight: 600 }}>
              {row.sign && <span aria-hidden="true" style={{ color: MUTED, marginRight: '6px' }}>{row.sign}</span>}
              {row.label}
            </span>
            {row.note && (
              <span style={{ display: 'block', fontSize: '12.5px', color: MUTED }}>{row.note}</span>
            )}
          </span>
          <span aria-hidden="true" className="relative block" style={{ height: '18px' }}>
            <motion.span
              className="absolute inset-y-0 block"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.7, delay: 0.08 * i, ease: [0.22, 0.61, 0.36, 1] }}
              style={{
                left: `${(row.from / scale) * 100}%`,
                width: `${Math.max(((row.to - row.from) / scale) * 100, 0.6)}%`,
                background: fill,
                borderRadius: '4px',
                transformOrigin: row.kind === 'deduction' ? 'right' : 'left',
              }}
            />
          </span>
          <span
            className="sm:text-right"
            style={{ fontFamily: SANS, fontWeight: 700, fontSize: '15px', color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
          >
            {row.sign === '−' ? '− ' : ''}
            {formatNok(row.value)}
          </span>
        </li>
      )
    })

  const stageTitle = (text: string) => (
    <p
      style={{
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: '11.5px',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: OLIVE,
        margin: '0 0 4px',
      }}
    >
      {text}
    </p>
  )

  return (
    <figure style={{ margin: 0 }} aria-labelledby="breakdown-title">
      <figcaption>
        <p id="breakdown-title" style={{ fontFamily: SANS, fontWeight: 700, fontSize: '16px', color: INK, margin: 0 }}>
          Slik fordeles én ordre
        </p>
        <p style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.6, color: MUTED, margin: '6px 0 0' }}>
          Per ordre, med verdiene i kalkulatoren. Alle stolper bruker samme skala.
        </p>
      </figcaption>

      <div className="mt-5" style={{ borderTop: `1px solid ${BORDER_WARM}`, paddingTop: '16px' }}>
        {stageTitle('1 · Kundens pris')}
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>{renderRows(priceRows)}</ol>
      </div>
      <div className="mt-4" style={{ borderTop: `1px solid ${BORDER_WARM}`, paddingTop: '16px' }}>
        {stageTitle(`2 · Slik fordeles ${formatNok(o.customerPaysOere)}`)}
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>{renderRows(splitRows)}</ol>
      </div>

      <p style={{ fontFamily: SANS, fontSize: '13px', lineHeight: 1.6, color: SOFT, margin: '14px 0 0' }}>
        Provisjonen beregnes av det kunden faktisk betaler for varene etter alle rabatter. Frakt
        regnes ikke med.
      </p>
    </figure>
  )
}
