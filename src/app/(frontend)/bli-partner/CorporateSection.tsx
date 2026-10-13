import Link from 'next/link'
import { CORPORATE_SEGMENTS } from '@/lib/partnerProgram/content'
import {
  CORPORATE_EXAMPLE,
  PARTNER_COMMISSION_PERCENT,
  PARTNER_DISCOUNT_PERCENT,
  calculatePartnerExample,
  formatNok,
  formatPercent,
} from '@/lib/partnerProgram/calculator'
import { indexableSolutions } from '@/lib/solutions'
import type { PriceTableRow } from '@/lib/quantityPricing'
import { BORDER_WARM, CREAM, GOLD, INK, MUTED, OLIVE, SANS, SECTION_PAD, SERIF, SOFT } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { Icon, SectionHeading } from './ui'
import styles from './bliPartner.module.css'

/** One product's real quantity price table, resolved on the server from the CMS + tiers. */
export interface CorporateTierTable {
  title: string
  slug: string
  rows: PriceTableRow[]
}

const CORPORATE = calculatePartnerExample(CORPORATE_EXAMPLE)
const CORPORATE_PCT = formatPercent(CORPORATE.input.corporateDiscountPercent)
const PARTNER_PCT = formatPercent(PARTNER_DISCOUNT_PERCENT)
const COMMISSION_PCT = formatPercent(PARTNER_COMMISSION_PERCENT)

/**
 * «Større bestillinger. Større muligheter.» — introducing aBoks to organisations.
 *
 * The solution packages come from the `/bedrifter` solution registry and the price tables
 * from the shared quantity-pricing engine, fed by the live CMS price, so nothing here restates
 * a price or invents a tier. The 50 000 kr comparison is the page's worked example, computed
 * by the same calculator as everything else, and labelled as an illustration.
 */
export default function CorporateSection({ tiers }: { tiers: CorporateTierTable[] }) {
  const solutions = indexableSolutions()

  return (
    <section
      aria-labelledby="bedrift-title"
      style={{ background: '#1f231a', padding: SECTION_PAD, color: CREAM }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <Reveal>
            <SectionHeading
              id="bedrift-title"
              eyebrow="Bedriftssalg"
              title="Større bestillinger. Større muligheter."
              intro="Mange virksomheter trenger en trygg og ryddig måte å samle brukte batterier på. Som partner kan du introdusere aBoks for organisasjoner i nettverket ditt – og kunden får partnerrabatten i tillegg til gjeldende mengderabatt."
              light
            />
            <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2" style={{ listStyle: 'none', padding: 0 }}>
              {CORPORATE_SEGMENTS.map((segment) => (
                <li key={segment} className="flex items-center gap-3" style={{ fontFamily: SANS, fontSize: '15px', color: 'rgba(250,246,238,.88)' }}>
                  <Icon name="check" size={17} color={GOLD} strokeWidth={2.2} />
                  {segment}
                </li>
              ))}
            </ul>

            {solutions.length > 0 && (
              <div className="mt-10">
                <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: '11.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, margin: '0 0 14px' }}>
                  Ferdige bedriftsløsninger
                </p>
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {solutions.map((solution) => (
                    <li key={solution.slug}>
                      <Link
                        href={`/bedrifter/${solution.slug}`}
                        data-btn
                        className="flex h-full items-center justify-between gap-3"
                        style={{
                          padding: '14px 16px',
                          borderRadius: '14px',
                          border: '1px solid rgba(250,246,238,.16)',
                          background: 'rgba(250,246,238,.04)',
                          color: CREAM,
                          textDecoration: 'none',
                          fontFamily: SANS,
                          fontWeight: 600,
                          fontSize: '14.5px',
                        }}
                      >
                        {solution.title}
                        <span className={styles.ctaArrow}>
                          <Icon name="arrow" size={16} color={GOLD} strokeWidth={2} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>

          <Reveal delay={0.08}>
            <ComparisonCard />
          </Reveal>
        </div>

        {tiers.length > 0 && (
          <Reveal>
            <div className="mt-14">
              <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: '11.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, margin: '0 0 6px' }}>
                Gjeldende mengdepriser i nettbutikken
              </p>
              <p style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.6, color: 'rgba(250,246,238,.72)', margin: '0 0 20px', maxWidth: '70ch' }}>
                Mengderabatten gis som lavere stykkpris per produkt. Partnerkoden trekkes deretter
                fra den rabatterte prisen i kassen.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {tiers.map((table) => (
                  <table
                    key={table.slug}
                    style={{
                      width: '100%',
                      borderCollapse: 'separate',
                      borderSpacing: 0,
                      background: 'rgba(250,246,238,.04)',
                      border: '1px solid rgba(250,246,238,.14)',
                      borderRadius: '18px',
                      overflow: 'hidden',
                      fontFamily: SANS,
                      fontSize: '14px',
                    }}
                  >
                    <caption style={{ captionSide: 'top', textAlign: 'left', padding: '0 0 10px', fontFamily: SERIF, fontWeight: 600, fontSize: '22px', color: CREAM }}>
                      {table.title}
                    </caption>
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">Antall</th>
                        <th scope="col">Pris per stk.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row) => (
                        <tr key={row.range}>
                          <th scope="row" style={{ textAlign: 'left', fontWeight: 500, padding: '11px 16px', borderBottom: '1px solid rgba(250,246,238,.08)', color: 'rgba(250,246,238,.78)' }}>
                            {row.range}
                          </th>
                          <td style={{ textAlign: 'right', padding: '11px 16px', borderBottom: '1px solid rgba(250,246,238,.08)', fontWeight: 700, color: CREAM, fontVariantNumeric: 'tabular-nums' }}>
                            {row.isQuoteRow ? 'Be om tilbud' : formatNok(Math.round(row.unitPrice * 100))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        <Reveal>
          <div className="mt-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between" style={{ borderTop: '1px solid rgba(250,246,238,.14)', paddingTop: '28px' }}>
            <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.65, color: 'rgba(250,246,238,.8)', margin: 0, maxWidth: '68ch' }}>
              <strong style={{ color: CREAM }}>Egne bedriftstilbud:</strong> Når en større bestilling
              avtales direkte med ABOKS AS, må partnerkoden og partnerrabatten være med i det
              avtalte tilbudet eller bekreftes av ABOKS AS for at salget skal knyttes til deg.
            </p>
            <Link
              href="/bedrifter"
              data-btn
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-8"
              style={{ minHeight: '54px', background: CREAM, color: INK, fontFamily: SANS, fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
            >
              Se løsninger for bedrifter
              <span className={styles.ctaArrow}>
                <Icon name="arrow" size={18} color={INK} strokeWidth={2} />
              </span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function ComparisonCard() {
  const o = CORPORATE.perOrder
  const withoutCode = o.afterCorporateOere
  return (
    <div style={{ background: CREAM, color: INK, borderRadius: '28px', padding: 'clamp(24px,3.6vw,40px)' }}>
      <p style={{ fontFamily: SANS, fontWeight: 700, fontSize: '11.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: OLIVE, margin: 0 }}>
        Eksempel · bedriftsbestilling
      </p>
      <p style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.6, color: MUTED, margin: '6px 0 22px' }}>
        {formatNok(o.originalOere)} før rabatt, med {CORPORATE_PCT} bedriftsrabatt som illustrasjon.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div style={{ border: `1px solid ${BORDER_WARM}`, borderRadius: '18px', padding: '16px' }}>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: SOFT, margin: 0 }}>Uten partnerkode</p>
          <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(26px,3vw,36px)', margin: '6px 0 0', fontVariantNumeric: 'tabular-nums' }}>
            {formatNok(withoutCode)}
          </p>
        </div>
        <div style={{ background: OLIVE, color: CREAM, borderRadius: '18px', padding: '16px' }}>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(250,246,238,.78)', margin: 0 }}>Med partnerkode</p>
          <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(26px,3vw,36px)', margin: '6px 0 0', color: '#ecdcb8', fontVariantNumeric: 'tabular-nums' }}>
            {formatNok(o.customerPaysOere)}
          </p>
        </div>
      </div>

      <dl className="mt-5" style={{ fontFamily: SANS, fontSize: '14.5px' }}>
        {[
          ['Opprinnelig pris', formatNok(o.originalOere)],
          [`Bedriftsrabatt ${CORPORATE_PCT}`, `− ${formatNok(o.corporateDiscountOere)}`],
          ['Pris etter bedriftsrabatt', formatNok(o.afterCorporateOere)],
          [`Partnerrabatt ${PARTNER_PCT} av ${formatNok(o.afterCorporateOere)}`, `− ${formatNok(o.partnerDiscountOere)}`],
          ['Kunden betaler', formatNok(o.customerPaysOere)],
          [`Partnerens provisjon, ${COMMISSION_PCT}`, formatNok(o.commissionOere)],
          ['ABOKS AS beholder før kostnader', formatNok(o.retainedOere)],
        ].map(([label, value], i) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4"
            style={{
              padding: '10px 0',
              borderTop: `1px solid ${BORDER_WARM}`,
              fontWeight: i === 4 || i === 5 ? 700 : 500,
            }}
          >
            <dt style={{ color: i === 5 ? OLIVE : SOFT }}>{label}</dt>
            <dd style={{ margin: 0, color: INK, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{value}</dd>
          </div>
        ))}
      </dl>
      <p style={{ fontFamily: SANS, fontSize: '12.5px', lineHeight: 1.6, color: MUTED, margin: '12px 0 0' }}>
        Illustrasjon, ikke et tilbud. Provisjonen beregnes av det kunden betaler for varene, uten frakt.
      </p>
    </div>
  )
}
