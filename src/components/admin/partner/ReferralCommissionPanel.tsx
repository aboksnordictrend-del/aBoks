import { Fragment } from 'react'
import type { UIFieldServerComponent } from 'payload'
import { formatNOK } from '@/lib/analytics/money'
import { oereToKr } from '@/lib/money'
import { loadReferralPayoutState } from '@/lib/partner/referralPayoutState'
import RegisterReferralPayoutButton from './RegisterReferralPayoutButton'
import { ReferralAdjustmentTable, ReferralPayoutTable } from './ReferralHistoryTables'
import styles from './partner.module.css'

/**
 * «Henvisningsprovisjon» on a regular partner: what is payable from Bedriftssalg and
 * Forhandlersalg, the payout action, the referral payout history and the adjustments.
 *
 * A server component, like `PartnerStatistics`: the figures are loaded during the page render, so
 * no read endpoint exists. Promo-code commission is NOT part of any figure here; it keeps its own
 * balance and payout action on each promo code.
 */

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const ReferralCommissionPanel: UIFieldServerComponent = async ({ id, data, payload, req }) => {
  if (!id) return null

  let state
  try {
    state = await loadReferralPayoutState(payload, id, { req })
  } catch (err) {
    console.error(
      JSON.stringify({
        scope: 'referral-commission-panel',
        event: 'load-failed',
        partnerId: String(id),
        error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      }),
    )
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>Henvisningsprovisjon</h3>
        <div className={styles.empty}>Kunne ikke hente henvisningsprovisjon akkurat nå.</div>
      </div>
    )
  }

  const doc = data as { name?: unknown; bankAccount?: unknown; accountOwner?: unknown } | undefined
  const { totals } = state
  const earnedUnpaid = totals.earnedUnpaidOere.businessSale + totals.earnedUnpaidOere.retailStore

  const rows = [
    { label: 'Opptjent, ikke utbetalt', value: formatNOK(oereToKr(earnedUnpaid), 2) },
    { label: 'Utestående justeringer', value: formatNOK(oereToKr(-totals.outstandingClawbackOere), 2) },
    { label: 'Til utbetaling nå', value: formatNOK(oereToKr(totals.payableOere), 2) },
    { label: 'Utbetalt totalt', value: formatNOK(oereToKr(totals.paidOutOere), 2) },
  ]

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Henvisningsprovisjon</h3>
      <p className={styles.intro}>
        Provisjon fra Bedriftssalg og Forhandlersalg. Promokode-provisjon vises og utbetales separat på hver rabattkode.
      </p>
      <p className={styles.note}>
        En registrert utbetaling er bare en regnskapsføring av en overføring som allerede er gjort i bank, Vipps e.l.
        Systemet setter aldri i gang en betaling.
      </p>

      <div className={styles.details}>
        {rows.map((row) => (
          <Fragment key={row.label}>
            <div className={styles.detailLabel}>{row.label}</div>
            <div className={styles.detailValue}>{row.value}</div>
          </Fragment>
        ))}
      </div>

      <RegisterReferralPayoutButton
        partnerId={String(id)}
        partnerName={text(doc?.name) ?? ''}
        bankAccount={text(doc?.bankAccount)}
        accountOwner={text(doc?.accountOwner)}
        sales={state.payableSales}
        adjustments={state.outstandingAdjustments}
      />

      <h4 className={styles.subheading}>Utbetalinger av henvisningsprovisjon</h4>
      <ReferralPayoutTable rows={state.payouts} />

      <h4 className={styles.subheading}>Provisjonsjusteringer</h4>
      <ReferralAdjustmentTable rows={state.adjustments} />
    </div>
  )
}

export default ReferralCommissionPanel
