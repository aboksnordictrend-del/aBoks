import { Fragment } from 'react'
import { PAYOUT_METHOD_OPTIONS, type PayoutMethod } from '@/lib/partner/constants'
import { formatInt, formatNOK } from '@/lib/analytics/money'
import styles from './partner.module.css'

/**
 * The presentational halves of the payout action, kept free of Payload's client providers.
 *
 * `RegisterPayoutButton` owns the behaviour — the drawer, the request, the toast, the refresh.
 * Everything that decides what an admin actually SEES lives here, so it can be rendered and
 * asserted directly instead of through a modal context that only exists in the browser.
 *
 * Buttons use Payload's own `btn` classes rather than its `Button` component, matching the
 * pattern already used by `ResendShippingEmail` and `SendReviewInvitation`.
 */

export interface PayoutSummary {
  promoCode: string
  partnerName: string
  validUsageCount: number
  revenueAfterDiscount: number
  earnedCommission: number
  availableToPay: number
}

/** A balance is payable only when there is something to pay. */
export const canRegisterPayout = (availableToPay: number): boolean =>
  Number.isFinite(availableToPay) && availableToPay > 0

/** The trigger and its caption, shown above the payout history. */
export function PayoutTriggerRow({
  availableToPay,
  onOpen,
}: {
  availableToPay: number
  onOpen: () => void
}) {
  const enabled = canRegisterPayout(availableToPay)

  return (
    <div className={styles.actionRow}>
      <button
        type="button"
        className="btn btn--style-primary btn--size-small"
        disabled={!enabled}
        onClick={onOpen}
      >
        Registrer utbetaling
      </button>
      {!enabled && <span className={styles.actionHint}>Ingen provisjon tilgjengelig.</span>}
    </div>
  )
}

export interface PayoutModalBodyProps {
  summary: PayoutSummary
  method: PayoutMethod
  reference: string
  note: string
  busy: boolean
  error: string
  onMethodChange: (value: PayoutMethod) => void
  onReferenceChange: (value: string) => void
  onNoteChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}

export default function PayoutModalBody({
  summary,
  method,
  reference,
  note,
  busy,
  error,
  onMethodChange,
  onReferenceChange,
  onNoteChange,
  onCancel,
  onSubmit,
}: PayoutModalBodyProps) {
  const enabled = canRegisterPayout(summary.availableToPay)

  const rows: { label: string; value: string }[] = [
    { label: 'Partner', value: summary.partnerName || '—' },
    { label: 'Rabattkode', value: summary.promoCode || '—' },
    { label: 'Gyldige kjøp', value: formatInt(summary.validUsageCount) },
    { label: 'Omsetning etter rabatt', value: formatNOK(summary.revenueAfterDiscount, 2) },
    { label: 'Opptjent provisjon', value: formatNOK(summary.earnedCommission, 2) },
    { label: 'Til utbetaling', value: formatNOK(summary.availableToPay, 2) },
  ]

  return (
    <div>
      <p className={styles.modalIntro}>
        Registrer en utbetaling som allerede er utført via bank, Vipps eller annen
        betalingsmåte. Systemet sender aldri penger selv.
      </p>

      {/* Same two-column read-only block the panel uses, so the modal reads identically. */}
      <div className={styles.details}>
        {rows.map((row) => (
          <Fragment key={row.label}>
            <div className={styles.detailLabel}>{row.label}</div>
            <div className={styles.detailValue}>{row.value}</div>
          </Fragment>
        ))}
      </div>

      {/* Stated, never entered: the whole accumulated balance is what gets paid. */}
      <div className={styles.payoutAmount}>
        <div className={styles.cardTitle}>Beløp som utbetales</div>
        <div className={styles.cardValue}>{formatNOK(summary.availableToPay, 2)}</div>
        <div className={styles.cardHelp}>
          Hele den opptjente saldoen utbetales. Beløpet kan ikke endres.
        </div>
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="partner-payout-method">
          Betalingsmåte
        </label>
        <select
          id="partner-payout-method"
          className={styles.select}
          value={method}
          disabled={busy}
          onChange={(e) => onMethodChange(e.target.value as PayoutMethod)}
        >
          {PAYOUT_METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="partner-payout-reference">
          Referanse
        </label>
        <input
          id="partner-payout-reference"
          className={styles.input}
          type="text"
          value={reference}
          disabled={busy}
          placeholder="Bankreferanse, Vipps-id e.l."
          onChange={(e) => onReferenceChange(e.target.value)}
        />
      </div>

      <div className="field-type">
        <label className="field-label" htmlFor="partner-payout-note">
          Notat
        </label>
        <textarea
          id="partner-payout-note"
          className={styles.textarea}
          rows={3}
          value={note}
          disabled={busy}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>

      {error && <div className={styles.modalError}>{error}</div>}

      <div className={styles.modalActions}>
        <button
          type="button"
          className="btn btn--style-secondary btn--size-small"
          disabled={busy}
          onClick={onCancel}
        >
          Avbryt
        </button>
        <button
          type="button"
          className="btn btn--style-primary btn--size-small"
          disabled={busy || !enabled}
          onClick={onSubmit}
        >
          {busy ? 'Registrerer …' : 'Registrer utbetaling'}
        </button>
      </div>
    </div>
  )
}
