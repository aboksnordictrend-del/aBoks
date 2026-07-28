import { Fragment } from 'react'
import type { UIFieldServerComponent } from 'payload'
import { formatInt, formatNOK } from '@/lib/analytics/money'
import { formatDateNo } from '@/lib/receiptPdf'
import { loadPartnerStatistics } from '@/lib/partner/statistics'
import PartnerSummaryCards from './PartnerSummaryCards'
import PartnerSalesTable from './PartnerSalesTable'
import PartnerPayoutTable from './PartnerPayoutTable'
import RegisterPayoutButton from './RegisterPayoutButton'
import styles from './partner.module.css'

/**
 * «Partnerstatistikk» on the promo-code edit page.
 *
 * ── A server component, deliberately ──
 *
 * Payload renders a UI field's server component with `payload`, `req` and the document data
 * already in hand, so the figures are loaded on the server during the page render. That is
 * what lets this stage add no API route at all: nothing is fetched from the browser, so
 * there is no new endpoint to secure. Access is exactly the admin panel's own — reaching
 * this page already requires an authenticated Payload user.
 *
 * It also means there is no loading state and no layout shift: the section arrives with the
 * page, fully rendered, rather than popping in after a client fetch.
 *
 * ── Read-only ──
 *
 * No totals are computed here. `loadPartnerStatistics` returns finished figures derived from
 * the frozen Stage 4 accounting module, and these components only format them. There is no
 * payout button, form or edit control in this stage.
 */

const PartnerStatistics: UIFieldServerComponent = async ({ id, data, payload, req }) => {
  // Nothing to show before the document exists, or on an ordinary promo code — a code with
  // no partner has no commission, and an empty financial dashboard would only be confusing.
  if (!id) return null

  let stats
  try {
    // Payload renders field server components from a server action once the document view
    // mounts, and `data` is not guaranteed to be populated in every render context. So the
    // flag is read from the form data when it is there, and from the saved document when it
    // is not — the panel must not depend on which of the two Payload happens to supply.
    const fromData = (data as { isPartnerCode?: unknown })?.isPartnerCode
    let isPartner = fromData === true

    if (fromData === undefined || fromData === null) {
      const doc = await payload.findByID({
        collection: 'promo-codes',
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })
      isPartner = doc?.isPartnerCode === true
    }

    // An ordinary promo code has no commission, and an empty financial dashboard on it would
    // only be confusing.
    if (!isPartner) return null

    stats = await loadPartnerStatistics(payload, id, { req })
  } catch (err) {
    // A statistics panel must never take the edit page down with it.
    console.error(
      JSON.stringify({
        scope: 'partner-statistics',
        event: 'load-failed',
        promoCodeId: String(id),
        error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
      }),
    )
    return (
      <div className={styles.section}>
        <h3 className={styles.heading}>Partnerstatistikk</h3>
        <div className={styles.empty}>Kunne ikke hente partnerstatistikk akkurat nå.</div>
      </div>
    )
  }

  const partnerName = (data as { partnerName?: unknown })?.partnerName
  const promoCode = (data as { code?: unknown })?.code
  const lastPayout = stats.payouts[0]?.payoutDate

  const details: { label: string; value: string }[] = [
    { label: 'Gyldige partnerkjøp', value: formatInt(stats.counts.valid) },
    { label: 'Ekskluderte kjøp', value: formatInt(stats.counts.excluded) },
    { label: 'Kansellerte ordre', value: formatInt(stats.counts.cancelled) },
    { label: 'Mangler ordre', value: formatInt(stats.counts.missingOrder) },
    { label: 'Eldre registreringer', value: formatInt(stats.counts.legacy) },
    { label: 'Utbetalt provisjon', value: formatNOK(stats.balance.paidAmount, 2) },
    { label: 'Til utbetaling', value: formatNOK(stats.balance.availableToPay, 2) },
  ]

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Partnerstatistikk</h3>
      <p className={styles.intro}>Statistikk og historikk for denne samarbeidspartneren.</p>
      <p className={styles.note}>
        {typeof partnerName === 'string' && partnerName.trim()
          ? `${partnerName.trim()} — beregnet av varesum uten frakt, inkludert MVA. Kansellerte ordre og eldre registreringer uten beløpsdata regnes ikke med.`
          : 'Beregnet av varesum uten frakt, inkludert MVA. Kansellerte ordre og eldre registreringer uten beløpsdata regnes ikke med.'}
      </p>

      <PartnerSummaryCards stats={stats} />

      <h4 className={styles.subheading}>Detaljert statistikk</h4>
      <div className={styles.details}>
        {details.map((row) => (
          <Fragment key={row.label}>
            <div className={styles.detailLabel}>{row.label}</div>
            <div className={styles.detailValue}>{row.value}</div>
          </Fragment>
        ))}
      </div>

      <h4 className={styles.subheading}>Salgshistorikk</h4>
      <PartnerSalesTable rows={stats.sales} />

      <h4 className={styles.subheading}>Utbetalinger</h4>
      {/* The one action on this panel. Everything it shows is server-derived; the server
          recalculates the balance again before writing anything. */}
      <RegisterPayoutButton
        promoCodeId={String(id)}
        promoCode={typeof promoCode === 'string' ? promoCode : ''}
        partnerName={typeof partnerName === 'string' ? partnerName.trim() : ''}
        validUsageCount={stats.counts.valid}
        revenueAfterDiscount={stats.revenue}
        earnedCommission={stats.balance.earnedCommission}
        availableToPay={stats.balance.availableToPay}
      />
      <PartnerPayoutTable rows={stats.payouts} />
      {lastPayout && (
        <p className={styles.intro} style={{ marginTop: '0.5rem' }}>
          Siste utbetaling: {formatDateNo(lastPayout) || '—'}
        </p>
      )}
    </div>
  )
}

export default PartnerStatistics
