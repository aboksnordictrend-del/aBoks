import type { UIFieldServerComponent } from 'payload'
import { formatInt, formatNOK } from '@/lib/analytics/money'
import { oereToKr } from '@/lib/money'
import {
  REFERRAL_COMMISSION_STATUS_OPTIONS,
  REFERRED_CUSTOMER_STATUS_OPTIONS,
  SALE_PAYMENT_STATUS_OPTIONS,
} from '@/lib/partner/referral'
import {
  SALES_SHOWN_PER_CATEGORY,
  loadReferralOverview,
  type OverviewCategory,
  type ReferralOverview,
} from '@/lib/partner/referralOverview'
import { dateNo } from './ReferralPayoutModalBody'
import styles from './partner.module.css'

/**
 * «Henviste kunder – oversikt» on a regular partner: companies and physical stores separately,
 * with their sales and commission. Server-rendered, read-only; the list below it («Henviste
 * kunder») is where customers are added, and each sale is registered on its customer.
 */

const label = (options: { label: string; value: string }[]) => {
  const map = new Map(options.map((o) => [o.value, o.label]))
  return (value: string | null) => (value && map.get(value)) ?? '—'
}
const customerStatus = label(REFERRED_CUSTOMER_STATUS_OPTIONS)
const paymentStatus = label(SALE_PAYMENT_STATUS_OPTIONS)
const commissionStatus = label(REFERRAL_COMMISSION_STATUS_OPTIONS)
const nok = (kr: number | null) => (kr == null ? '—' : formatNOK(kr, 2))

function Card({ title, value, help }: { title: string; value: string; help?: string }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>{value}</div>
      {help && <div className={styles.cardHelp}>{help}</div>}
    </div>
  )
}

export function OverviewCards({ overview }: { overview: ReferralOverview }) {
  const b = overview.businessSale
  const r = overview.retailStore
  const sum = (pick: (c: OverviewCategory) => number) => oereToKr(pick(b) + pick(r))
  const earnedUnpaid = (c: OverviewCategory) => c.totals.earnedUnpaidOere.businessSale + c.totals.earnedUnpaidOere.retailStore

  return (
    <div className={`${styles.cards} ${styles.overviewCards}`}>
      <Card title="Bedrifter" value={formatInt(b.customers.length)} help={`${formatInt(b.saleCount)} salg`} />
      <Card title="Fysiske butikker" value={formatInt(r.customers.length)} help={`${formatInt(r.saleCount)} salg`} />
      <Card title="Opptjent – Bedriftssalg" value={formatNOK(oereToKr(b.totals.earnedTotalOere.businessSale), 2)} help="Betalte salg, inkl. utbetalt" />
      <Card title="Opptjent – Forhandlersalg" value={formatNOK(oereToKr(r.totals.earnedTotalOere.retailStore), 2)} help="Betalte salg, inkl. utbetalt" />
      <Card title="Venter på betaling" value={formatNOK(sum((c) => c.totals.pendingOere), 2)} help="Opptjenes når salget er betalt" />
      <Card title="Ikke utbetalt" value={formatNOK(sum(earnedUnpaid), 2)} help="Opptjent, ikke utbetalt ennå" />
      <Card title="Utbetalt" value={formatNOK(sum((c) => c.totals.paidOutOere), 2)} />
      <Card title="Tilbakeført" value={formatNOK(sum((c) => c.totals.reversedOere), 2)} help="Kansellerte og refunderte salg" />
    </div>
  )
}

export function CategorySection({ title, empty, category }: { title: string; empty: string; category: OverviewCategory }) {
  return (
    <>
      <h4 className={styles.subheading}>{title}</h4>
      {category.customers.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Kunde</th>
                <th>Status</th>
                <th className={styles.numeric}>Salg</th>
                <th className={styles.numeric}>Betalt omsetning</th>
                <th className={styles.numeric}>Opptjent</th>
                <th className={styles.numeric}>Venter</th>
                <th className={styles.numeric}>Utbetalt</th>
                <th className={styles.numeric}>Tilbakeført</th>
              </tr>
            </thead>
            <tbody>
              {category.customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/admin/collections/referred-customers/${c.id}`}>{c.name}</a>
                  </td>
                  <td>{customerStatus(c.status)}</td>
                  <td className={styles.numeric}>{formatInt(c.saleCount)}</td>
                  <td className={styles.numeric}>{nok(c.paidRevenue)}</td>
                  <td className={styles.numeric}>{nok(c.earned)}</td>
                  <td className={styles.numeric}>{nok(c.pending)}</td>
                  <td className={styles.numeric}>{nok(c.paidOut)}</td>
                  <td className={styles.numeric}>{nok(c.reversed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {category.sales.length > 0 && (
        <>
          <div className={styles.tableWrap} style={{ marginTop: '0.75rem' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Salgsdato</th>
                  <th>Kunde</th>
                  <th className={styles.numeric}>Fakturert</th>
                  <th className={styles.numeric}>Provisjon</th>
                  <th>Betaling</th>
                  <th>Provisjonsstatus</th>
                </tr>
              </thead>
              <tbody>
                {category.sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <a href={`/admin/collections/referral-sales/${s.id}`}>{dateNo(s.saleDate)}</a>
                    </td>
                    <td>{s.customerName}</td>
                    <td className={styles.numeric}>{nok(s.invoicedTotal)}</td>
                    <td className={styles.numeric}>{nok(s.commissionAmount)}</td>
                    <td>{paymentStatus(s.paymentStatus)}</td>
                    <td>{commissionStatus(s.commissionStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {category.saleCount > category.sales.length && (
            <p className={styles.tableNote}>
              Viser de {SALES_SHOWN_PER_CATEGORY} siste av {formatInt(category.saleCount)} salg. Alle salg finnes under
              hver kunde og i «Henvisningssalg».
            </p>
          )}
        </>
      )}
    </>
  )
}

const ReferredCustomersOverview: UIFieldServerComponent = async ({ id, payload, req }) => {
  if (!id) return null

  let overview: ReferralOverview
  try {
    overview = await loadReferralOverview(payload, id, { req })
  } catch (err) {
    console.error(
      JSON.stringify({
        scope: 'referred-customers-overview',
        event: 'load-failed',
        partnerId: String(id),
        error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      }),
    )
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>Henviste kunder – oversikt</h3>
        <div className={styles.empty}>Kunne ikke hente oversikten akkurat nå.</div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Henviste kunder – oversikt</h3>
      <p className={styles.intro}>
        Bedrifter og fysiske butikker partneren har henvist, med salg og provisjon. Legg til kunder i listen «Henviste
        kunder» nedenfor, og registrer salg på hver kunde. Promokode-provisjon vises på hver rabattkode.
      </p>

      <OverviewCards overview={overview} />

      <CategorySection
        title="Bedrifter – Bedriftssalg"
        empty="Ingen henviste bedrifter."
        category={overview.businessSale}
      />
      <CategorySection
        title="Fysiske butikker – Forhandlersalg"
        empty="Ingen henviste fysiske butikker."
        category={overview.retailStore}
      />
    </div>
  )
}

export default ReferredCustomersOverview
