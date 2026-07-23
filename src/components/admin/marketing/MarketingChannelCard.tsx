'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { formatNOK } from '@/lib/analytics/money'
import { STATUS, type MarketingChannelCard as Card } from '@/lib/marketing/channels'
import { callAdsSync } from '@/lib/marketing/adsSync'
import styles from './marketing.module.css'

// Every displayed value comes from props (accent colours are a purely visual lookup, never
// part of the API payload). The one piece of behaviour the card owns is the quick "Oppdater"
// action: it posts an incremental sync via the shared callAdsSync — the exact same call the
// detail page makes — and asks the parent to refresh only this card's data on success.

const ACCENTS: Record<string, string> = {
  meta: '#3b6fd4',
  google: '#c08a2e',
  pinterest: '#c0455b',
  tiktok: '#2f9c93',
}

/** Badge colour per status. Text always carries the meaning; colour only reinforces it. */
function badgeColor(status: string): string {
  if (status === STATUS.connected) return 'var(--theme-success-500)'
  if (status === STATUS.notConfigured) return 'var(--theme-warning-500)'
  return 'var(--theme-elevation-400)'
}

/** Short line under the channel name, derived from its status. */
function tagline(status: string): string {
  if (status === STATUS.connected) return 'Synkronisering aktiv'
  if (status === STATUS.notConfigured) return 'Mangler oppsett'
  return 'Ikke tilgjengelig ennå'
}

function formatDay(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/** Date plus time when the value carries one (lastSyncedAt is a full timestamp). */
function formatDayTime(iso?: string | null): string {
  if (!iso) return '—'
  const day = formatDay(iso)
  const t = /T(\d{2}):(\d{2})/.exec(iso)
  return t ? `${day} ${t[1]}:${t[2]}` : day
}

/** Square monogram tile — no external assets, no emoji. */
function ChannelIcon({ title }: { title: string }) {
  return (
    <span className={styles.chIcon} aria-hidden="true">
      {title.charAt(0).toUpperCase()}
    </span>
  )
}

function ChannelStatusBadge({ status }: { status: string }) {
  return (
    <span className={styles.chBadge} style={{ ['--badge' as string]: badgeColor(status) }}>
      <span className={styles.chBadgeDot} aria-hidden="true" />
      {status}
    </span>
  )
}

function ChannelMetric({
  value,
  label,
  wide = false,
}: {
  value: ReactNode
  label: string
  wide?: boolean
}) {
  return (
    <div className={`${styles.chMetric} ${wide ? styles.chMetricWide : ''}`}>
      <span className={styles.chMetricValue}>{value}</span>
      <span className={styles.chMetricLabel}>{label}</span>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 8h9M8.5 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Spinning ring shown while a quick sync is running. */
function SpinnerIcon() {
  return (
    <svg className={styles.chSpin} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Quick "Oppdater" phase for a single card. Kept local so only this card re-renders. */
type QuickPhase = 'idle' | 'syncing' | 'success' | 'error'

const SUCCESS_MS = 2000

export default function MarketingChannelCard({
  card,
  onRefresh,
}: {
  card: Card
  /** Refreshes just this card's data (by id) after a successful quick sync. */
  onRefresh?: (id: string) => Promise<void>
}) {
  const openable = Boolean(card.href)
  const canQuickSync = Boolean(card.syncEndpoint)
  const { summary } = card

  const [phase, setPhase] = useState<QuickPhase>('idle')
  const [message, setMessage] = useState('')
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear a pending "back to idle" timer if the card unmounts mid-success.
  useEffect(() => () => {
    if (successTimer.current) clearTimeout(successTimer.current)
  }, [])

  const handleOppdater = useCallback(async () => {
    if (!card.syncEndpoint || phase === 'syncing') return
    if (successTimer.current) clearTimeout(successTimer.current)
    setMessage('')
    setPhase('syncing')

    const call = await callAdsSync(card.syncEndpoint, 'incremental')

    if (call.kind === 'success') {
      // Pull this card's fresh totals before flipping to the success state, so the numbers
      // and the ✓ appear together.
      try {
        await onRefresh?.(card.id)
      } catch {
        // A failed refresh must not turn a successful sync into an error — the data is
        // already written; the card just keeps its previous figures until the next load.
      }
      setPhase('success')
      successTimer.current = setTimeout(() => setPhase('idle'), SUCCESS_MS)
      return
    }

    // Conflict and error both restore the normal button and surface a short message.
    setPhase('error')
    setMessage(
      call.kind === 'conflict'
        ? 'Manuelle kostnader overlapper perioden. Åpne kanalen for detaljer.'
        : call.message,
    )
  }, [card.syncEndpoint, card.id, onRefresh, phase])

  const quickLabel =
    phase === 'syncing' ? 'Oppdaterer …' : phase === 'success' ? 'Oppdatert' : 'Oppdater'

  return (
    <article
      className={`${styles.chCard} ${openable ? styles.chCardActive : styles.chCardDisabled}`}
      // Accent only on active cards — the disabled variant keeps its muted class accent.
      style={openable ? { ['--accent' as string]: ACCENTS[card.id] ?? '#3b6fd4' } : undefined}
    >
      <header className={styles.chHead}>
        <ChannelIcon title={card.title} />
        <div className={styles.chHeadText}>
          <h3 className={styles.chTitle}>{card.title}</h3>
          <p className={styles.chTagline}>{tagline(card.status)}</p>
        </div>
        <ChannelStatusBadge status={card.status} />
      </header>

      <div className={styles.chBody}>
        {openable ? (
          <>
            <div className={styles.chPrimary}>
              <span className={styles.chPrimaryLabel}>Totale kostnader</span>
              <span className={styles.chPrimaryValue}>{formatNOK(summary.totalSpend, 2)}</span>
            </div>
            <div className={styles.chMetrics}>
              <ChannelMetric value={summary.days} label="Importerte dager" />
              <ChannelMetric value={formatDayTime(summary.lastSyncedAt)} label="Sist oppdatert" />
              <ChannelMetric
                wide
                value={
                  summary.firstDate && summary.lastDate
                    ? `${formatDay(summary.firstDate)}–${formatDay(summary.lastDate)}`
                    : '—'
                }
                label="Historikk i databasen"
              />
            </div>
          </>
        ) : (
          <>
            <p className={styles.chNote}>{card.description}</p>
            <p className={styles.chNote}>Integrasjonen blir tilgjengelig senere.</p>
          </>
        )}
      </div>

      <footer className={styles.chFoot}>
        {/* Absolutely positioned above the footer so a failure never changes card height. */}
        {phase === 'error' && message && (
          <p className={styles.chQuickError} role="alert">
            {message}
          </p>
        )}

        {canQuickSync ? (
          // Raised above the stretched Åpne link (z-index) so this stays independently
          // clickable. Width is driven by flex, not by the label, so the text can change
          // (Oppdater → Oppdaterer … → Oppdatert) without the button — or the row — resizing.
          <button
            type="button"
            className={`${styles.chQuick} ${phase === 'success' ? styles.chQuickSuccess : ''}`}
            onClick={handleOppdater}
            disabled={phase === 'syncing'}
            aria-busy={phase === 'syncing'}
            aria-label={
              phase === 'syncing'
                ? `Oppdaterer ${card.title}`
                : phase === 'success'
                  ? `${card.title} oppdatert`
                  : `Oppdater ${card.title}`
            }
          >
            {phase === 'syncing' ? <SpinnerIcon /> : phase === 'success' ? <CheckIcon /> : <RefreshIcon />}
            <span>{quickLabel}</span>
          </button>
        ) : (
          <button type="button" className={styles.chQuickDisabled} disabled aria-disabled="true">
            <RefreshIcon />
            <span>Oppdater</span>
          </button>
        )}

        {openable ? (
          // Stretched link (::after covers the card) — clicking the card opens the detail
          // page. The quick button above sits over this overlay and is unaffected.
          <Link className={styles.chOpen} href={card.href!}>
            Åpne
            <ArrowIcon />
          </Link>
        ) : (
          <button type="button" className={styles.chOpenDisabled} disabled aria-disabled="true">
            Åpne
          </button>
        )}

        {/* Announce success to assistive tech (the error uses role="alert" above). */}
        <span className={styles.srOnly} role="status" aria-live="polite">
          {phase === 'success' ? `${card.title} oppdatert` : ''}
        </span>
      </footer>
    </article>
  )
}
