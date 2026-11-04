'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import StatisticsPanel from '../../miljo/[code]/StatisticsPanel'
import styles from '../../miljo/[code]/miljo.module.css'

const TABS = [
  { id: 'statistikk', label: 'Statistikk og eksport' },
  { id: 'leveranser', label: 'Leveranser' },
  { id: 'qr', label: 'QR-kode og PIN' },
  { id: 'konto', label: 'Konto' },
] as const
export type MinSideTab = (typeof TABS)[number]['id']

const isTab = (v: string): v is MinSideTab => TABS.some((t) => t.id === v)

/**
 * Min side's areas as accessible tabs — the same pattern and styles as the QR page (arrow keys,
 * Home/End, URL hash, panels stay mounted). Statistics load the first time their tab is shown;
 * they come from the account's own endpoints, never from a public code.
 */
export default function MinSideTabs({ deliveries, qr, account }: { deliveries: ReactNode; qr: ReactNode; account: ReactNode }) {
  const [active, setActive] = useState<MinSideTab>('statistikk')
  const [statsOpened, setStatsOpened] = useState(false)
  const tabRefs = useRef<Record<MinSideTab, HTMLButtonElement | null>>({ statistikk: null, leveranser: null, qr: null, konto: null })

  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '')
    if (isTab(fromHash)) setActive(fromHash)
  }, [])

  useEffect(() => {
    if (active === 'statistikk') setStatsOpened(true)
    const hash = active === 'statistikk' ? '' : `#${active}`
    if (window.location.hash !== hash) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }, [active])

  const select = (id: MinSideTab, focus = false) => {
    setActive(id)
    if (focus) tabRefs.current[id]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === active)
    const next =
      e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i - 1 + TABS.length) % TABS.length] : e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[TABS.length - 1] : null
    if (!next) return
    e.preventDefault()
    select(next.id, true)
  }

  const panel = (id: MinSideTab, children: ReactNode) => (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={active !== id}>
      {children}
    </div>
  )

  return (
    <div className={styles.theme}>
      <div role="tablist" aria-label="Velg område" className={`${styles.tabs} ${styles.tabsFour}`} onKeyDown={onKeyDown}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className={styles.tab}
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {panel(
        'statistikk',
        statsOpened && (
          <StatisticsPanel endpoints={{ statistics: '/api/miljo/konto/statistikk', exports: '/api/miljo/konto/eksport' }} showDeliveryRows={false} />
        ),
      )}
      {panel('leveranser', deliveries)}
      {panel('qr', qr)}
      {panel('konto', account)}
    </div>
  )
}
