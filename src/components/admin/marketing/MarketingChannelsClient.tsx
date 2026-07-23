'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MARKETING_API, MARKETING_ROUTES, type MarketingChannelCard as Card } from '@/lib/marketing/channels'
import MarketingChannelCard from './MarketingChannelCard'
import styles from './marketing.module.css'

type Phase = 'loading' | 'ready' | 'error'

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5.5 4h8M5.5 8h8M5.5 12h8" strokeLinecap="round" />
      <circle cx="2.75" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.75" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="2.75" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6.4v4.2M10 13.4v.2" strokeLinecap="round" />
    </svg>
  )
}

/** Placeholder cards while the catalog loads — steadier than a bare "Laster …" line. */
function SkeletonGrid() {
  return (
    <div className={styles.catalogGrid} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${styles.skeleton} ${styles.skelCard}`} />
      ))}
    </div>
  )
}

/**
 * Catalog of marketing-channel integrations (the collection's list view). Fetches channel
 * cards from the admin-only endpoint — connection status and totals are computed
 * server-side, never here.
 */
export default function MarketingChannelsClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [cards, setCards] = useState<Card[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPhase('loading')
      try {
        const res = await fetch(MARKETING_API.channels, { credentials: 'include' })
        const body = (await res.json().catch(() => ({}))) as { channels?: Card[]; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setError(body.error ?? `Kunne ikke hente kanaler (${res.status}).`)
          setPhase('error')
          return
        }
        setCards(body.channels ?? [])
        setPhase('ready')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Nettverksfeil.')
        setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Re-fetch the catalog and replace only the one card that was just synced. The endpoint
  // recomputes every card, but merging a single entry keeps the others' data untouched — so
  // a quick "Oppdater" refreshes exactly its own card, never the whole page.
  const refreshCard = useCallback(async (id: string) => {
    const res = await fetch(MARKETING_API.channels, { credentials: 'include' })
    if (!res.ok) throw new Error(`Kunne ikke oppdatere kanal (${res.status}).`)
    const body = (await res.json().catch(() => ({}))) as { channels?: Card[] }
    const fresh = body.channels?.find((c) => c.id === id)
    if (!fresh) return
    setCards((prev) => prev.map((c) => (c.id === id ? fresh : c)))
  }, [])

  return (
    <div className={styles.catalogRoot}>
      <header className={styles.catalogHeader}>
        <div>
          <h1 className={styles.catalogTitle}>Markedsføringskanaler</h1>
          <p className={styles.catalogSubtitle}>
            Koble til og synkroniser annonseringskostnader per kanal.
          </p>
        </div>
        <Link className={styles.ghostBtn} href={MARKETING_ROUTES.all}>
          <ListIcon />
          Vis alle kostnader
        </Link>
      </header>

      {phase === 'loading' && <SkeletonGrid />}

      {phase === 'error' && (
        <div className={styles.catalogError} role="alert">
          <AlertIcon />
          <div>
            <p className={styles.catalogErrorTitle}>Kunne ikke laste kanaler</p>
            <span>{error || 'Prøv å laste siden på nytt.'}</span>
          </div>
        </div>
      )}

      {phase === 'ready' && cards.length === 0 && (
        <div className={styles.catalogEmpty}>
          Ingen markedsføringskanaler er konfigurert ennå.
        </div>
      )}

      {phase === 'ready' && cards.length > 0 && (
        <div className={styles.catalogGrid}>
          {cards.map((card) => (
            <MarketingChannelCard key={card.id} card={card} onRefresh={refreshCard} />
          ))}
        </div>
      )}
    </div>
  )
}
