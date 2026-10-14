import Link from 'next/link'
import { CORPORATE_SEGMENTS } from '@/lib/partnerProgram/content'
import { formatNok } from '@/lib/partnerProgram/calculator'
import type { PriceTableRow } from '@/lib/quantityPricing'
import { BORDER_WARM, CREAM, INK, OLIVE, SANS, SERIF, SOFT, cardLabelStyle } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { Icon } from './ui'
import styles from './bliPartner.module.css'

/** One product's real quantity price table, resolved on the server from the CMS + tiers. */
export interface CorporateTierTable {
  title: string
  slug: string
  rows: PriceTableRow[]
}

/**
 * The Bedriftssalg tab's reference block: who the partner can sell to, the ready-made solution
 * packages from the `/bedrifter` registry, and the shop's real quantity price tables.
 *
 * The tables come from the shared quantity-pricing engine fed by the live CMS price, so this
 * restates no price and invents no tier — they are the volume discounts a business customer
 * gets in a Bedriftssalg.
 */
export default function BusinessSaleDetails({
  tiers,
  solutions,
}: {
  tiers: CorporateTierTable[]
  solutions: { slug: string; title: string }[]
}) {
  return (
    <Reveal>
      <div
        style={{
          background: '#fffdf8',
          border: `1px solid ${BORDER_WARM}`,
          borderRadius: '28px',
          padding: 'clamp(24px,3.4vw,40px)',
        }}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h4 style={{ ...cardLabelStyle, margin: '0 0 14px' }}>Aktuelle kunder</h4>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {CORPORATE_SEGMENTS.map((segment) => (
                <li key={segment} className="flex items-center gap-3" style={{ fontFamily: SANS, fontSize: '15px', color: SOFT }}>
                  <Icon name="check" size={17} color="#5f8253" strokeWidth={2.2} />
                  {segment}
                </li>
              ))}
            </ul>
          </div>

          {solutions.length > 0 && (
            <div>
              <h4 style={{ ...cardLabelStyle, margin: '0 0 14px' }}>Ferdige bedriftsløsninger</h4>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {solutions.map((solution) => (
                  <li key={solution.slug}>
                    <Link
                      href={`/bedrifter/${solution.slug}`}
                      data-btn
                      className="flex h-full items-center justify-between gap-3"
                      style={{
                        padding: '13px 16px',
                        minHeight: '48px',
                        borderRadius: '14px',
                        border: `1px solid ${BORDER_WARM}`,
                        background: CREAM,
                        color: INK,
                        textDecoration: 'none',
                        fontFamily: SANS,
                        fontWeight: 600,
                        fontSize: '14.5px',
                      }}
                    >
                      {solution.title}
                      <span className={styles.ctaArrow}>
                        <Icon name="arrow" size={16} color={OLIVE} strokeWidth={2} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {tiers.length > 0 && (
          <div className="mt-10" style={{ borderTop: `1px solid ${BORDER_WARM}`, paddingTop: '28px' }}>
            <h4 style={{ ...cardLabelStyle, margin: '0 0 6px' }}>Gjeldende mengdepriser</h4>
            <p style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.6, color: SOFT, margin: '0 0 20px', maxWidth: '70ch' }}>
              Mengderabatten gis som lavere stykkpris per produkt. Det er disse prisene bedriftskunden
              får ved et bedriftssalg, når antallet kvalifiserer.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {tiers.map((table) => (
                <table
                  key={table.slug}
                  style={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    background: CREAM,
                    border: `1px solid ${BORDER_WARM}`,
                    borderRadius: '18px',
                    overflow: 'hidden',
                    fontFamily: SANS,
                    fontSize: '14px',
                  }}
                >
                  <caption style={{ captionSide: 'top', textAlign: 'left', padding: '0 0 10px', fontFamily: SERIF, fontWeight: 600, fontSize: '22px', color: INK }}>
                    {table.title}
                  </caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Antall</th>
                      <th scope="col">Pris per stk.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, i) => {
                      const last = i === table.rows.length - 1
                      const cell = { padding: '11px 16px', borderBottom: last ? 'none' : `1px solid ${BORDER_WARM}` }
                      return (
                        <tr key={row.range}>
                          <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 500, color: SOFT }}>
                            {row.range}
                          </th>
                          <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                            {row.isQuoteRow ? 'Be om tilbud' : formatNok(Math.round(row.unitPrice * 100))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        )}
      </div>
    </Reveal>
  )
}
