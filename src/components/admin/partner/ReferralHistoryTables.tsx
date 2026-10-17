import { PAYOUT_METHOD_OPTIONS } from '@/lib/partner/constants'
import { ADJUSTMENT_REASON_OPTIONS } from '@/lib/partner/referral'
import { formatNOK } from '@/lib/analytics/money'
import type { AdjustmentRow, ReferralPayoutRow } from '@/lib/partner/referralPayoutState'
import { dateNo } from './ReferralPayoutModalBody'
import styles from './partner.module.css'

/**
 * Read-only history for the «Henvisningsprovisjon» panel: referral payouts, and the negative
 * adjustments with whether each is still outstanding or which payout deducted it. Each row links
 * to its record. Promo-code payouts are not listed here; they stay on each promo code.
 */

const METHOD_LABEL = new Map(PAYOUT_METHOD_OPTIONS.map((o) => [o.value as string, o.label]))
const REASON_LABEL = new Map(ADJUSTMENT_REASON_OPTIONS.map((o) => [o.value as string, o.label]))

export function ReferralPayoutTable({ rows }: { rows: ReferralPayoutRow[] }) {
  if (rows.length === 0) return <div className={styles.empty}>Ingen utbetalinger av henvisningsprovisjon registrert.</div>
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dato</th>
            <th className={styles.numeric}>Opptjent</th>
            <th className={styles.numeric}>Trukket</th>
            <th className={styles.numeric}>Utbetalt</th>
            <th className={styles.numeric}>Salg</th>
            <th>Metode</th>
            <th>Referanse</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <a href={`/admin/collections/partner-payouts/${row.id}`}>{dateNo(row.payoutDate)}</a>
              </td>
              <td className={styles.numeric}>{row.grossAmount == null ? '—' : formatNOK(row.grossAmount, 2)}</td>
              <td className={styles.numeric}>{row.deductedAmount ? formatNOK(-row.deductedAmount, 2) : '—'}</td>
              <td className={styles.numeric}>{formatNOK(row.amount, 2)}</td>
              <td className={styles.numeric}>{row.saleCount}</td>
              <td>{(row.paymentMethod && METHOD_LABEL.get(row.paymentMethod)) ?? '—'}</td>
              <td>{row.reference ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReferralAdjustmentTable({ rows }: { rows: AdjustmentRow[] }) {
  if (rows.length === 0) return <div className={styles.empty}>Ingen provisjonsjusteringer.</div>
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Registrert</th>
            <th>Justering</th>
            <th>Årsak</th>
            <th className={styles.numeric}>Beløp</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{dateNo(row.createdAt)}</td>
              <td>
                <a href={`/admin/collections/referral-commission-adjustments/${row.id}`}>{row.title}</a>
              </td>
              <td>{(row.reason && REASON_LABEL.get(row.reason)) ?? '—'}</td>
              <td className={styles.numeric}>{formatNOK(row.amount, 2)}</td>
              <td>
                {row.settledByPayoutId ? (
                  <span className={`${styles.badge} ${styles.badgeCounted}`}>
                    Trukket {dateNo(row.settledAt)}{' '}
                    <a href={`/admin/collections/partner-payouts/${row.settledByPayoutId}`}>(utbetaling)</a>
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeExcluded}`}>Utestående – trekkes fra neste utbetaling</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
