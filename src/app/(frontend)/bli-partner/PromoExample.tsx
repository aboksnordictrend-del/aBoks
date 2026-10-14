import {
  CORPORATE_EXAMPLE,
  PARTNER_COMMISSION_PERCENT,
  PARTNER_DISCOUNT_PERCENT,
  STANDARD_EXAMPLE,
  calculatePartnerExample,
  formatNok,
  formatPercent,
} from '@/lib/partnerProgram/calculator'
import { BORDER_WARM, CREAM, INK, MUTED, OLIVE, SANS, SERIF, SOFT, cardLabelStyle } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'

const STANDARD = calculatePartnerExample(STANDARD_EXAMPLE)
const CORPORATE = calculatePartnerExample(CORPORATE_EXAMPLE)
const CORPORATE_PCT = formatPercent(CORPORATE.input.corporateDiscountPercent)
const PARTNER_PCT = formatPercent(PARTNER_DISCOUNT_PERCENT)
const COMMISSION_PCT = formatPercent(PARTNER_COMMISSION_PERCENT)

/**
 * The Promokode tab's worked examples: an ordinary order, and the stacked corporate order
 * (volume discount, then the code's 10 % of the reduced price). Both are the page's named
 * scenarios from `@/lib/partnerProgram/calculator`, whose commission step is the real engine,
 * so the figures are pinned by its tests rather than typed here.
 */
export default function PromoExample() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Reveal style={{ height: '100%' }}>
        <StandardCard />
      </Reveal>
      <Reveal delay={0.06} style={{ height: '100%' }}>
        <ComparisonCard />
      </Reveal>
    </div>
  )
}

function StandardCard() {
  const o = STANDARD.perOrder
  return (
    <div
      className="flex h-full flex-col"
      style={{ background: '#fffdf8', border: `1px solid ${BORDER_WARM}`, borderRadius: '28px', padding: 'clamp(24px,3.6vw,40px)' }}
    >
      <h4 style={{ ...cardLabelStyle, color: OLIVE, margin: 0 }}>Eksempel · vanlig kjøp</h4>
      <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.7, color: SOFT, margin: '14px 0 0' }}>
        En kunde handler for {formatNok(o.originalOere)} med koden din og får {PARTNER_PCT} rabatt.
        Kunden betaler {formatNok(o.customerPaysOere)} for varene.
      </p>
      <p className="mt-auto" style={{ paddingTop: '22px', margin: 0 }}>
        <span style={{ display: 'block', fontFamily: SANS, fontSize: '13px', color: MUTED }}>
          Din provisjon, {COMMISSION_PCT}
        </span>
        <span style={{ display: 'block', fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(40px,4.4vw,56px)', lineHeight: 1.05, color: OLIVE }}>
          {formatNok(o.commissionOere)}
        </span>
      </p>
    </div>
  )
}

function ComparisonCard() {
  const o = CORPORATE.perOrder
  const withoutCode = o.afterCorporateOere
  return (
    <div style={{ background: '#fffdf8', border: `1px solid ${BORDER_WARM}`, color: INK, borderRadius: '28px', padding: 'clamp(24px,3.6vw,40px)' }}>
      <h4 style={{ ...cardLabelStyle, color: OLIVE, margin: 0 }}>Eksempel · bedriftsbestilling med promokode</h4>
      <p style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.6, color: MUTED, margin: '6px 0 22px' }}>
        {formatNok(o.originalOere)} før rabatt, med {CORPORATE_PCT} bedriftsrabatt som illustrasjon.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div style={{ border: `1px solid ${BORDER_WARM}`, borderRadius: '18px', padding: '16px' }}>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: SOFT, margin: 0 }}>Uten promokode</p>
          <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(24px,3vw,34px)', margin: '6px 0 0', fontVariantNumeric: 'tabular-nums' }}>
            {formatNok(withoutCode)}
          </p>
        </div>
        <div style={{ background: OLIVE, color: CREAM, borderRadius: '18px', padding: '16px' }}>
          <p style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(250,246,238,.78)', margin: 0 }}>Med promokode</p>
          <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(24px,3vw,34px)', margin: '6px 0 0', color: '#ecdcb8', fontVariantNumeric: 'tabular-nums' }}>
            {formatNok(o.customerPaysOere)}
          </p>
        </div>
      </div>

      <dl className="mt-5" style={{ fontFamily: SANS, fontSize: '14.5px', margin: '20px 0 0' }}>
        {[
          ['Opprinnelig pris', formatNok(o.originalOere)],
          [`Bedriftsrabatt ${CORPORATE_PCT}`, `− ${formatNok(o.corporateDiscountOere)}`],
          ['Pris etter bedriftsrabatt', formatNok(o.afterCorporateOere)],
          [`Promokode ${PARTNER_PCT} av ${formatNok(o.afterCorporateOere)}`, `− ${formatNok(o.partnerDiscountOere)}`],
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
        Illustrasjon, ikke et tilbud. For bedriftstilbud som avtales direkte med ABOKS AS, må
        promokoden og rabatten være med i det avtalte tilbudet eller bekreftes av ABOKS AS.
      </p>
    </div>
  )
}
