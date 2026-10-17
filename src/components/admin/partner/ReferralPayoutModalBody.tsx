import { Fragment } from 'react'
import { PAYOUT_METHOD_OPTIONS, type PayoutMethod } from '@/lib/partner/constants'
import { REFERRAL_CATEGORY_OPTIONS } from '@/lib/partner/referral'
import { oereToKr, toOere } from '@/lib/money'
import { formatNOK } from '@/lib/analytics/money'
import type { AdjustmentRow, PayableSaleRow } from '@/lib/partner/referralPayoutState'
import styles from './partner.module.css'

/**
 * The visible half of «Registrer utbetaling av henvisningsprovisjon», free of Payload's client
 * providers so it can be rendered and asserted directly. `RegisterReferralPayoutButton` owns the
 * drawer, the request and the refresh.
 *
 * The administrator ticks which earned, unpaid sales the transfer covered. Every outstanding
 * adjustment is listed and always deducted — it cannot be unticked, so none can be skipped. The
 * total shown is what the server must arrive at from the locked rows; if anything changed in the
 * meantime the server refuses instead of paying a different amount.
 */

const CATEGORY_LABEL = new Map(REFERRAL_CATEGORY_OPTIONS.map((o) => [o.value as string, o.label]))

export const dateNo = (iso: string | null): string => {
  if (!iso) return '—'
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export interface ReferralPayoutFigures {
  grossOere: number
  deductedOere: number
  netOere: number
}

/** The running total for a selection, in exact øre. */
export function referralPayoutFigures(
  sales: readonly PayableSaleRow[],
  selected: ReadonlySet<string>,
  adjustments: readonly AdjustmentRow[],
): ReferralPayoutFigures {
  const grossOere = sales.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + toOere(s.commissionAmount), 0)
  const deductedOere = adjustments.reduce((sum, a) => sum + -toOere(a.amount), 0)
  return { grossOere, deductedOere, netOere: grossOere - deductedOere }
}

export interface ReferralPayoutModalBodyProps {
  partnerName: string
  bankAccount?: string
  accountOwner?: string
  sales: PayableSaleRow[]
  adjustments: AdjustmentRow[]
  selected: ReadonlySet<string>
  payoutDate: string
  method: PayoutMethod
  reference: string
  note: string
  busy: boolean
  error: string
  onToggle: (saleId: string) => void
  onToggleAll: (on: boolean) => void
  onPayoutDateChange: (value: string) => void
  onMethodChange: (value: PayoutMethod) => void
  onReferenceChange: (value: string) => void
  onNoteChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}

export default function ReferralPayoutModalBody(props: ReferralPayoutModalBodyProps) {
  const { sales, adjustments, selected, busy } = props
  const figures = referralPayoutFigures(sales, selected, adjustments)
  const canSubmit = !busy && selected.size > 0 && figures.netOere > 0
  const allSelected = sales.length > 0 && sales.every((s) => selected.has(s.id))

  const rows = [
    { label: 'Partner', value: props.partnerName || '—' },
    ...(props.bankAccount ? [{ label: 'Kontonummer', value: props.bankAccount }] : []),
    ...(props.accountOwner ? [{ label: 'Kontoeier', value: props.accountOwner }] : []),
  ]

  return (
    <div>
      <p className={styles.modalIntro}>
        Registrer en utbetaling av henvisningsprovisjon (Bedriftssalg og Forhandlersalg) som allerede er utført via
        bank, Vipps eller annen betalingsmåte. Systemet sender aldri penger selv. Promokode-provisjon utbetales
        separat fra hver rabattkode.
      </p>

      <div className={styles.details}>
        {rows.map((row) => (
          <Fragment key={row.label}>
            <div className={styles.detailLabel}>{row.label}</div>
            <div className={styles.detailValue}>{row.value}</div>
          </Fragment>
        ))}
      </div>

      <h4 className={styles.subheading}>Opptjent, ikke utbetalt provisjon</h4>
      {sales.length === 0 ? (
        <div className={styles.empty}>Ingen opptjent provisjon å utbetale.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Velg alle salg"
                    checked={allSelected}
                    disabled={busy}
                    onChange={(e) => props.onToggleAll(e.target.checked)}
                  />
                </th>
                <th>Salg</th>
                <th>Kategori</th>
                <th>Dato</th>
                <th className={styles.numeric}>Provisjon</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Velg ${sale.title}`}
                      checked={selected.has(sale.id)}
                      disabled={busy}
                      onChange={() => props.onToggle(sale.id)}
                    />
                  </td>
                  <td>{sale.title}</td>
                  <td>{(sale.category && CATEGORY_LABEL.get(sale.category)) ?? '—'}</td>
                  <td>{dateNo(sale.saleDate)}</td>
                  <td className={styles.numeric}>{formatNOK(sale.commissionAmount, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustments.length > 0 && (
        <>
          <h4 className={styles.subheading}>Justeringer som trekkes</h4>
          <p className={styles.intro}>
            Provisjon som er utbetalt for salg som senere er refundert eller kansellert. Alle utestående justeringer
            trekkes fra denne utbetalingen.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td className={styles.numeric}>{formatNOK(a.amount, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className={styles.details}>
        <div className={styles.detailLabel}>Valgt provisjon</div>
        <div className={styles.detailValue}>{formatNOK(oereToKr(figures.grossOere), 2)}</div>
        <div className={styles.detailLabel}>Trekk for justeringer</div>
        <div className={styles.detailValue}>{formatNOK(oereToKr(-figures.deductedOere), 2)}</div>
      </div>

      <div className={styles.payoutAmount}>
        <div className={styles.cardTitle}>Beløp som utbetales</div>
        <div className={styles.cardValue}>{formatNOK(oereToKr(Math.max(figures.netOere, 0)), 2)}</div>
        <div className={styles.cardHelp}>
          {selected.size > 0 && figures.netOere <= 0
            ? 'Justeringene er like store som eller større enn valgt provisjon. Velg flere salg, eller vent til mer provisjon er opptjent.'
            : 'Beregnes av valgte salg minus justeringer. Kontrolleres på nytt av serveren før registrering.'}
        </div>
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="referral-payout-date">
          Utbetalingsdato
        </label>
        <input
          id="referral-payout-date"
          className={styles.input}
          type="date"
          value={props.payoutDate}
          disabled={busy}
          onChange={(e) => props.onPayoutDateChange(e.target.value)}
        />
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="referral-payout-method">
          Betalingsmåte
        </label>
        <select
          id="referral-payout-method"
          className={styles.select}
          value={props.method}
          disabled={busy}
          onChange={(e) => props.onMethodChange(e.target.value as PayoutMethod)}
        >
          {PAYOUT_METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="referral-payout-reference">
          Referanse
        </label>
        <input
          id="referral-payout-reference"
          className={styles.input}
          type="text"
          value={props.reference}
          disabled={busy}
          placeholder="Bankreferanse, Vipps-id e.l."
          onChange={(e) => props.onReferenceChange(e.target.value)}
        />
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="referral-payout-note">
          Notat
        </label>
        <textarea
          id="referral-payout-note"
          className={styles.textarea}
          rows={3}
          value={props.note}
          disabled={busy}
          onChange={(e) => props.onNoteChange(e.target.value)}
        />
      </div>

      {props.error && <div className={styles.modalError}>{props.error}</div>}

      <div className={styles.modalActions}>
        <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={props.onCancel}>
          Avbryt
        </button>
        <button type="button" className="btn btn--style-primary btn--size-small" disabled={!canSubmit} onClick={props.onSubmit}>
          {busy ? 'Registrerer …' : 'Registrer utbetaling'}
        </button>
      </div>
    </div>
  )
}
