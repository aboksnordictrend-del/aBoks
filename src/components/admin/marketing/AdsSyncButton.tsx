'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatNOK } from '@/lib/analytics/money'
import {
  callAdsSync,
  type AdsSyncMode,
  type AdsSyncOutcome,
  type AdsSyncResult,
} from '@/lib/marketing/adsSync'
import styles from './metaSync.module.css'

// Provider-neutral sync actions for an ad channel (Meta Ads, Google Ads, …). The user never
// picks dates here: the server decides the window from the mode (incremental = trailing
// 14-day overlap, full = entire history). Viewing periods are a separate concern, owned by
// the page filter and by Analyse.
//
// The POST + response classification lives in @/lib/marketing/adsSync (callAdsSync), shared
// with the quick "Oppdater" action on a channel card so the two can never drift apart. This
// component owns the detail-page UI: confirm → submitting → done/conflict/error, focus trap,
// Escape, double-click guard.

// Re-exported for existing importers (MetaSyncButton, GoogleMarketingClient, …).
export type { AdsSyncMode, AdsSyncOutcome } from '@/lib/marketing/adsSync'

type Phase = 'idle' | 'confirmFull' | 'submitting' | 'done' | 'conflict' | 'error'

export interface AdsSyncButtonProps {
  /** POST endpoint that accepts `{ mode }` and returns the shared sync-result shape. */
  endpoint: string
  /** Short provider name used in dialog copy, e.g. 'Meta' or 'Google Ads'. */
  providerName: string
  /** Channel name used when naming conflicting manual rows, e.g. 'Meta Ads'. */
  channelLabel: string
  /** Prefix for the dialog's element ids — must be unique per provider on a page. */
  idPrefix: string
  /** Drives the primary button label: first-run vs "Oppdater". */
  hasData?: boolean
  /** Primary button label before anything has been imported. */
  primaryLabel?: string
  /** Primary button label once data exists. */
  primaryLabelHasData?: string
  /** Secondary (full re-import) button label. */
  fullLabel?: string
  onSynced?: (outcome: AdsSyncOutcome) => void
}

/** YYYY-MM-DD → DD.MM.YYYY, else the raw string. */
function formatDay(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

function periodLabel(period: AdsSyncResult['period']): string {
  if (!period.since && !period.until) return 'hele den tilgjengelige perioden'
  return `${formatDay(period.since)}–${formatDay(period.until)}`
}

export default function AdsSyncButton({
  endpoint,
  providerName,
  channelLabel,
  idPrefix,
  hasData = false,
  primaryLabel = 'Synkroniser',
  primaryLabelHasData = 'Oppdater',
  fullLabel = 'Full synkronisering',
  onSynced,
}: AdsSyncButtonProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<AdsSyncResult | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const submitting = phase === 'submitting'
  const dialogOpen = phase !== 'idle'
  const titleId = `${idPrefix}-sync-title`

  const close = useCallback(() => {
    if (submitting) return
    setPhase('idle')
    setError('')
    setResult(null)
    primaryRef.current?.focus()
  }, [submitting])

  // Escape closes + a minimal focus trap keeps keyboard users inside the dialog.
  useEffect(() => {
    if (!dialogOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialogOpen, close])

  const runSync = async (mode: AdsSyncMode) => {
    setPhase('submitting')
    setError('')
    setResult(null)

    const call = await callAdsSync(endpoint, mode)

    if (call.kind === 'conflict') {
      setResult(call.result)
      setPhase('conflict')
      return
    }
    if (call.kind === 'error') {
      setPhase('error')
      setError(call.message)
      return
    }

    setResult(call.result)
    setPhase('done')
    // Refresh the page's data for its *current* display filter — the filter itself is
    // never changed by a sync.
    onSynced?.({ created: call.result.created, updated: call.result.updated })
    router.refresh()
  }

  const heading = (() => {
    if (!result) return ''
    if (result.initialSync) return 'Første synkronisering fullført'
    if (result.mode === 'full') return 'Full synkronisering fullført'
    return 'Synkronisering fullført'
  })()

  const lead = (() => {
    if (!result) return ''
    if (result.initialSync) return 'Hele den tilgjengelige historikken ble importert.'
    if (result.mode === 'full') return 'Hele historikken ble kontrollert og oppdatert.'
    return ''
  })()

  return (
    <div className={styles.wrap}>
      <button
        ref={primaryRef}
        type="button"
        className="btn btn--style-primary btn--size-small"
        disabled={submitting}
        onClick={() => runSync('incremental')}
      >
        {submitting ? 'Synkroniserer …' : hasData ? primaryLabelHasData : primaryLabel}
      </button>

      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        disabled={submitting}
        onClick={() => {
          setError('')
          setResult(null)
          setPhase('confirmFull')
        }}
      >
        {fullLabel}
      </button>

      {dialogOpen && (
        <div className={styles.backdrop} onMouseDown={close}>
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {phase === 'confirmFull' && (
              <>
                <h2 id={titleId} className={styles.title}>
                  Full synkronisering
                </h2>
                <p className={styles.hint}>
                  Full synkronisering henter hele den tilgjengelige historikken på nytt.
                  Eksisterende {providerName} API-poster oppdateres uten å opprette duplikater.
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="btn btn--style-secondary btn--size-small"
                    onClick={close}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className="btn btn--style-primary btn--size-small"
                    onClick={() => runSync('full')}
                  >
                    Fortsett
                  </button>
                </div>
              </>
            )}

            {phase === 'submitting' && (
              <>
                <h2 id={titleId} className={styles.title}>
                  Synkroniserer …
                </h2>
                <p className={styles.hint}>Henter data fra {providerName}. Dette kan ta litt tid.</p>
              </>
            )}

            {phase === 'error' && (
              <>
                <h2 id={titleId} className={styles.title}>
                  Synkronisering feilet
                </h2>
                <p className={styles.error} role="alert">
                  {error}
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="btn btn--style-secondary btn--size-small"
                    onClick={close}
                  >
                    Lukk
                  </button>
                </div>
              </>
            )}

            {phase === 'conflict' && result && (
              <>
                <h2 id={titleId} className={styles.title}>
                  Synkronisering stoppet
                </h2>
                <div className={styles.result} role="alert">
                  <p>
                    Det finnes manuelle {channelLabel}-kostnader som overlapper perioden. Fjern eller
                    korriger disse før du synkroniserer, slik at kostnadene ikke telles dobbelt.
                  </p>
                  <ul className={styles.conflicts}>
                    {result.conflicts?.map((c) => (
                      <li key={c.id}>
                        #{c.id}
                        {c.description ? ` – ${c.description}` : ''}
                        {c.periodFrom || c.periodTo
                          ? ` (${formatDay(c.periodFrom)}${c.periodTo ? `–${formatDay(c.periodTo)}` : ''})`
                          : ''}
                        {typeof c.amount === 'number' ? ` – ${formatNOK(c.amount, 2)}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="btn btn--style-secondary btn--size-small"
                    onClick={close}
                  >
                    Lukk
                  </button>
                </div>
              </>
            )}

            {phase === 'done' && result && (
              <>
                <h2 id={titleId} className={styles.title}>
                  {heading}
                </h2>
                <div className={styles.result}>
                  {lead && <p>{lead}</p>}
                  <ul className={styles.summary}>
                    {!result.initialSync && result.mode === 'incremental' && (
                      <li>Modus: Oppdatering</li>
                    )}
                    <li>
                      {result.initialSync || result.mode === 'full' ? 'Periode: ' : 'Periode oppdatert: '}
                      {periodLabel(result.period)}
                    </li>
                    <li>Opprettet: {result.created}</li>
                    <li>Oppdatert: {result.updated}</li>
                    <li>Uendret: {result.unchanged}</li>
                    {result.skipped > 0 && <li>Hoppet over: {result.skipped}</li>}
                    <li>Behandlet: {result.fetchedDays} dager</li>
                    <li className={styles.secondaryLine}>
                      Sum i perioden: {formatNOK(result.totalSpend, 2)}
                    </li>
                  </ul>
                  {result.warnings && result.warnings.length > 0 && (
                    <ul className={styles.warnings}>
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="btn btn--style-secondary btn--size-small"
                    onClick={close}
                  >
                    Lukk
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
