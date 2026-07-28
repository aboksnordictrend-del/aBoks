import { PAYOUT_METHOD_OPTIONS } from '@/lib/partner/constants'
import { formatDateNo } from '@/lib/receiptPdf'
import type { PartnerPayoutRow } from '@/lib/partner/statistics'
import { money } from './PartnerSalesTable'
import styles from './partner.module.css'

/**
 * Registered payouts, newest first. Read-only by design — this stage adds no way to create,
 * edit or delete a payout; the ledger itself is the place for that.
 */

/** Reuses the collection's own option labels so the two can never drift apart. */
const METHOD_LABEL = new Map(PAYOUT_METHOD_OPTIONS.map((o) => [o.value as string, o.label]))

export default function PartnerPayoutTable({ rows }: { rows: PartnerPayoutRow[] }) {
  if (rows.length === 0) {
    return <div className={styles.empty}>Ingen utbetalinger registrert.</div>
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dato</th>
            <th className={styles.numeric}>Beløp</th>
            <th>Metode</th>
            <th>Referanse</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.payoutId}>
              <td>{row.payoutDate ? formatDateNo(row.payoutDate) || '—' : '—'}</td>
              <td className={styles.numeric}>{money(row.amount)}</td>
              <td>{(row.paymentMethod && METHOD_LABEL.get(row.paymentMethod)) ?? '—'}</td>
              <td>{row.reference ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
