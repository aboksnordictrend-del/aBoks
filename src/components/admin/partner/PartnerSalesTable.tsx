import { formatNOK } from '@/lib/analytics/money'
import { formatDateNo } from '@/lib/receiptPdf'
import type { PartnerRowStatus, PartnerSalesRow } from '@/lib/partner/statistics'
import styles from './partner.module.css'

/**
 * One row per registered partner usage, newest first.
 *
 * Deliberately carries no customer data: no name, e-mail, phone, address, shipping or
 * internal id — only the order number and the money that decides the commission.
 */

export const STATUS_LABEL: Record<PartnerRowStatus, string> = {
  confirmed: 'Bekreftet',
  shipped: 'Sendt',
  delivered: 'Levert',
  cancelled: 'Kansellert',
  order_missing: 'Manglende ordre',
  legacy: 'Eldre registrering',
  excluded: 'Ikke medregnet',
}

/** An unavailable amount is shown as a dash — never as 0, which would read as "earned nothing". */
export const money = (value: number | null): string =>
  value == null ? '—' : formatNOK(value, 2)

const date = (value: string | null): string => (value ? formatDateNo(value) || '—' : '—')

export function StatusBadge({ status, counted }: { status: PartnerRowStatus; counted: boolean }) {
  return (
    <span
      className={`${styles.badge} ${counted ? styles.badgeCounted : styles.badgeExcluded}`}
      title={counted ? 'Regnes med i totalene' : 'Regnes ikke med i totalene'}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export default function PartnerSalesTable({ rows }: { rows: PartnerSalesRow[] }) {
  if (rows.length === 0) {
    return <div className={styles.empty}>Ingen registrerte partnerkjøp ennå.</div>
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dato</th>
            <th>Ordre</th>
            <th className={styles.numeric}>Omsetning før rabatt</th>
            <th className={styles.numeric}>Rabatt</th>
            <th className={styles.numeric}>Grunnlag for provisjon</th>
            <th className={styles.numeric}>Provisjon</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.usageId} className={row.counted ? undefined : styles.rowMuted}>
              <td>{date(row.usedAt)}</td>
              <td>{row.orderNumber ?? '—'}</td>
              <td className={styles.numeric}>{money(row.orderAmountBeforeDiscount)}</td>
              <td className={styles.numeric}>{money(row.discountAmount)}</td>
              <td className={styles.numeric}>{money(row.commissionBasis)}</td>
              <td className={styles.numeric}>{money(row.commissionAmount)}</td>
              <td>
                <StatusBadge status={row.status} counted={row.counted} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
