'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Script from 'next/script'
import type { PublicOrganization } from '@/lib/miljo/service'
import RegistrationForm from './RegistrationForm'
import StatisticsPanel from './StatisticsPanel'
import DeliveryForm from './DeliveryForm'
import styles from './miljo.module.css'

const TABS = [
  { id: 'registrer', label: 'Registrer batterier' },
  { id: 'statistikk', label: 'Miljøstatistikk' },
  { id: 'levering', label: 'Registrer faktisk levering' },
] as const
type TabId = (typeof TABS)[number]['id']

const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v)

/**
 * The QR page: three areas as accessible tabs (arrow keys, Home/End). All panels stay mounted so
 * switching never loses what someone has typed; statistics load the first time they are shown.
 * The active tab is mirrored in the URL hash, so #statistikk and #levering can be linked directly.
 */
export default function MiljoPage({ organization, turnstileSiteKey }: { organization: PublicOrganization; turnstileSiteKey: string }) {
  const [active, setActive] = useState<TabId>('registrer')
  const [statsOpened, setStatsOpened] = useState(false)
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ registrer: null, statistikk: null, levering: null })

  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '')
    if (isTab(fromHash)) setActive(fromHash)
  }, [])

  useEffect(() => {
    if (active === 'statistikk') setStatsOpened(true)
    const hash = active === 'registrer' ? '' : `#${active}`
    if (window.location.hash !== hash) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
  }, [active])

  const select = (id: TabId, focus = false) => {
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

  return (
    <>
      {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />}
      <header className={styles.hero}>
        <p className={styles.eyebrow}>aBoks Miljøregistrering</p>
        <h1 className={styles.orgName}>{organization.name}</h1>
      </header>

      <div role="tablist" aria-label="Velg område" className={styles.tabs} onKeyDown={onKeyDown}>
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

      <div role="tabpanel" id="panel-registrer" aria-labelledby="tab-registrer" hidden={active !== 'registrer'}>
        <RegistrationForm organization={organization} turnstileSiteKey={turnstileSiteKey} />
      </div>
      <div role="tabpanel" id="panel-statistikk" aria-labelledby="tab-statistikk" hidden={active !== 'statistikk'}>
        {statsOpened && <StatisticsPanel code={organization.code} />}
      </div>
      <div role="tabpanel" id="panel-levering" aria-labelledby="tab-levering" hidden={active !== 'levering'}>
        <DeliveryForm organization={organization} turnstileSiteKey={turnstileSiteKey} />
      </div>
    </>
  )
}
