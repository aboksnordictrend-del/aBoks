'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatNOK } from '@/lib/analytics/money'
import { STATUS, type MarketingChannelCard as Card } from '@/lib/marketing/channels'
import styles from './marketing.module.css'

// Presentational only — every value comes from props. Accent colours are a purely visual
// lookup here (never part of the API payload), so adding a channel needs no data change.

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

export default function MarketingChannelCard({ card }: { card: Card }) {
  const openable = Boolean(card.href)
  const { summary } = card

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
        {openable ? (
          // Stretched link (::after covers the card) — the whole card is clickable while
          // remaining a single, focusable control.
          <Link className={styles.chOpen} href={card.href!}>
            Åpne
            <ArrowIcon />
          </Link>
        ) : (
          <button type="button" className={styles.chOpenDisabled} disabled aria-disabled="true">
            Åpne
          </button>
        )}
      </footer>
    </article>
  )
}
