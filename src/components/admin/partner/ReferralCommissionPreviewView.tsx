import { Fragment } from 'react'
import { formatNOK } from '@/lib/analytics/money'
import { oereToKr, toOere } from '@/lib/money'
import { DEFAULT_REFERRAL_RATE, computeSaleCommission, isReferralCategory, type SaleCommissionInput } from '@/lib/partner/referral'
import styles from './partner.module.css'

/**
 * The live commission preview on a referral sale — the pure half.
 *
 * `buildCommissionPreview` turns the form's current values into what the administrator sees. The
 * figures come from `computeSaleCommission`, the very function the server runs when the sale is
 * saved, so the preview and the stored commission cannot disagree. The client wrapper
 * (`ReferralCommissionPreview`) only collects the values; everything shown is decided here.
 */

export type PreviewTone = 'info' | 'ok' | 'warning' | 'error' | 'locked'

export interface CommissionPreview {
  tone: PreviewTone
  title: string
  lines: { label: string; value: string; strong?: boolean }[]
  notes: string[]
}

export interface PreviewInput extends SaleCommissionInput {
  /** Still fetching the chosen customer's category. */
  loadingCustomer?: boolean
  paymentStatus?: unknown
  /** The payment status as SAVED: anything but pending means the figures are locked. */
  savedPaymentStatus?: unknown
  savedCommissionBase?: unknown
  savedCommissionAmount?: unknown
  hasOrder?: boolean
}

const CATEGORY_NAME: Record<string, string> = { businessSale: 'Bedriftssalg', retailStore: 'Forhandlersalg' }

const kr = (oere: number) => formatNOK(oereToKr(oere), 2)
const pct = (rate: number) => `${String(rate).replace('.', ',')} %`
const krValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? toOere(value) : null

export const PREVIEW_FOOTNOTE = 'Forhåndsvisning – endelig beløp beregnes og låses når salget lagres.'

export function buildCommissionPreview(input: PreviewInput): CommissionPreview {
  // ── Locked: show what is stored, never a recalculation ──
  if (input.savedPaymentStatus != null && input.savedPaymentStatus !== 'pending') {
    const base = krValue(input.savedCommissionBase)
    const amount = krValue(input.savedCommissionAmount)
    return {
      tone: 'locked',
      title: 'Låst – lagret provisjon',
      lines: [
        { label: 'Provisjonsgrunnlag', value: base == null ? '—' : kr(base) },
        { label: 'Provisjon', value: amount == null ? '—' : kr(amount), strong: true },
      ],
      notes: ['Salget er betalt eller avsluttet, og beløpene kan ikke endres. Registrer en korreksjon ved behov.'],
    }
  }

  if (input.loadingCustomer) return { tone: 'info', title: 'Henter kunde …', lines: [], notes: [] }
  if (!isReferralCategory(input.category)) {
    return { tone: 'info', title: 'Velg henvist kunde for å se provisjonen.', lines: [], notes: [] }
  }
  const category = input.category
  const empty = (v: unknown) => v == null || v === ''
  if (empty(input.invoicedTotal) || empty(input.vatTreatment)) {
    return {
      tone: 'info',
      title: 'Fyll inn fakturert beløp og velg MVA-behandling.',
      lines: [],
      notes: [`${CATEGORY_NAME[category]}: standardsats ${pct(DEFAULT_REFERRAL_RATE[category])}.`],
    }
  }

  const result = computeSaleCommission(input)
  if (!result.ok) return { tone: 'error', title: 'Provisjonen kan ikke beregnes', lines: [], notes: [result.message] }

  // ── The calculation, line by line ──
  const lines: CommissionPreview['lines'] = [{ label: 'Fakturert beløp', value: kr(toOere(input.invoicedTotal as number)) }]
  const minus = (label: string, value: unknown) => {
    const o = krValue(value)
    if (o != null && o !== 0) lines.push({ label: `− ${label}`, value: kr(o) })
  }
  minus('Frakt', input.shippingAmount)
  minus('Andre tillegg', input.otherExcludedAmount)
  if (input.vatTreatment === 'vatDeducted') minus('MVA', input.vatAmount)
  lines.push({ label: '= Provisjonsgrunnlag', value: kr(result.baseOere) })
  lines.push({
    label: 'Sats',
    value: result.isOverride
      ? `${pct(result.rate)} (avviker fra standard ${pct(DEFAULT_REFERRAL_RATE[category])})`
      : `${pct(result.rate)} (standard ${CATEGORY_NAME[category]})`,
  })

  const notes: string[] = []
  if (input.vatTreatment === 'noVat') notes.push('Ingen MVA på salget – ABOKS AS er ikke MVA-registrert.')

  // ── Does not qualify ──
  if (result.eligibility === 'notEligible') {
    lines.push({ label: 'Provisjon', value: kr(0), strong: true })
    return {
      tone: 'warning',
      title: 'Gir ikke provisjon',
      lines,
      notes: [
        category === 'businessSale' && result.eligibilityIsDefault
          ? 'Bedriftssalg gir provisjon bare for avtalte salg. Velg «Gir provisjon» dersom dette salget skal gi provisjon.'
          : '«Gir ikke provisjon» er valgt for dette salget.',
        ...notes,
      ],
    }
  }

  lines.push({ label: 'Provisjon', value: kr(result.commissionOere), strong: true })

  if (input.paymentStatus === 'cancelled' || input.paymentStatus === 'refunded') {
    return {
      tone: 'warning',
      title: 'Ingen provisjon – salget er kansellert eller refundert',
      lines,
      notes: ['Provisjonen tilbakeføres når salget lagres.', ...notes],
    }
  }

  if (result.isOverride) notes.push('Avvikende sats krever begrunnelse.')
  if (input.hasOrder) notes.push('Koblet til nettbutikkordre: dobbel provisjon med promokode kontrolleres ved lagring.')
  notes.unshift(
    input.paymentStatus === 'paid'
      ? 'Opptjenes når salget lagres som «Betalt».'
      : 'Opptjenes først når salget settes til «Betalt».',
  )

  return { tone: 'ok', title: `Provisjon: ${kr(result.commissionOere)}`, lines, notes }
}

const TONE_CLASS: Record<PreviewTone, string> = {
  info: styles.previewInfo,
  ok: styles.previewOk,
  warning: styles.previewWarning,
  error: styles.previewError,
  locked: styles.previewLocked,
}

export default function ReferralCommissionPreviewView({ preview }: { preview: CommissionPreview }) {
  return (
    <div className={`${styles.preview} ${TONE_CLASS[preview.tone]}`} role="status" aria-live="polite">
      <div className={styles.previewTitle}>{preview.title}</div>
      {preview.lines.length > 0 && (
        <div className={styles.details}>
          {preview.lines.map((line) => (
            <Fragment key={line.label}>
              <div className={styles.detailLabel}>{line.label}</div>
              <div className={line.strong ? `${styles.detailValue} ${styles.previewStrong}` : styles.detailValue}>
                {line.value}
              </div>
            </Fragment>
          ))}
        </div>
      )}
      {preview.notes.map((note) => (
        <p key={note} className={styles.previewNote}>
          {note}
        </p>
      ))}
      {preview.tone !== 'locked' && <p className={styles.previewFootnote}>{PREVIEW_FOOTNOTE}</p>}
    </div>
  )
}
