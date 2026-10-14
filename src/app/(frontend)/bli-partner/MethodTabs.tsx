'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { scrollToAnchor } from '@/lib/anchorScroll'
import { formatPercent } from '@/lib/partnerProgram/calculator'
import {
  PARTNER_METHODS,
  isPartnerMethodId,
  type PartnerMethodId,
} from '@/lib/partnerProgram/methods'
import { BEIGE, BORDER_WARM, CREAM, INK, OLIVE, SANS, SECTION_PAD, SOFT } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { SectionHeading } from './ui'
import { METHOD_SELECT_EVENT, METHOD_TABS_ID } from './methodSelection'

/**
 * «Slik tjener du» — the three earning methods as an accessible tab interface.
 *
 * WAI-ARIA tabs with automatic activation: ←/→ move between tabs and select, Home/End jump to
 * the first/last, and only the selected tab is in the tab order. Every panel is server-rendered
 * — the inactive ones carry `hidden` — so all three methods are in the HTML for search engines
 * and for the browser's find-in-page, while only one is shown at a time.
 *
 * The panels themselves are server components passed in as props, so this file only owns the
 * selection: which tab is chosen, the URL hash (`#promokode`, `#bedriftssalg`,
 * `#forhandlersalg`) and the event a method card sends (see `methodSelection.ts`).
 */
export default function MethodTabs({ panels }: { panels: Record<PartnerMethodId, ReactNode> }) {
  const [active, setActive] = useState<PartnerMethodId>('promokode')
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // A deep link or a reload with a method hash opens that tab and brings it into view.
  useEffect(() => {
    const fromHash = (scroll: boolean) => {
      const id = window.location.hash.slice(1)
      if (!isPartnerMethodId(id)) return
      setActive(id)
      if (scroll) requestAnimationFrame(() => scrollToAnchor(METHOD_TABS_ID))
    }
    fromHash(true)
    const onHash = () => fromHash(true)
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent<unknown>).detail
      if (isPartnerMethodId(id)) setActive(id)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener(METHOD_SELECT_EVENT, onSelect)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener(METHOD_SELECT_EVENT, onSelect)
    }
  }, [])

  const choose = useCallback((id: PartnerMethodId, focus: boolean) => {
    setActive(id)
    // Keeps the choice deep-linkable without the browser's own jump to the anchor.
    window.history.replaceState(null, '', `#${id}`)
    if (focus) tabRefs.current[id]?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const ids = PARTNER_METHODS.map((m) => m.id)
    const index = ids.indexOf(active)
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % ids.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + ids.length) % ids.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = ids.length - 1
    if (next === null) return
    e.preventDefault()
    choose(ids[next], true)
  }

  return (
    <section
      id={METHOD_TABS_ID}
      aria-labelledby="metode-title"
      style={{ background: BEIGE, padding: SECTION_PAD, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Reveal>
          <SectionHeading
            id="metode-title"
            eyebrow="Slik tjener du"
            title="Tre metoder, én partneravtale"
            intro="Velg en metode for å se hvordan den fungerer, hva kunden får, hva du tjener og et regneeksempel."
            center
          />
        </Reveal>

        <div
          role="tablist"
          aria-label="Metoder for å tjene provisjon"
          className="mx-auto mt-[clamp(32px,4vw,48px)] grid max-w-[760px] grid-cols-3 gap-1.5"
          style={{
            background: '#fffdf8',
            border: `1px solid ${BORDER_WARM}`,
            borderRadius: '22px',
            padding: '6px',
          }}
        >
          {PARTNER_METHODS.map((method) => {
            const selected = method.id === active
            return (
              <button
                key={method.id}
                ref={(el) => {
                  tabRefs.current[method.id] = el
                }}
                type="button"
                role="tab"
                id={`tab-${method.id}`}
                aria-selected={selected}
                aria-controls={method.id}
                tabIndex={selected ? 0 : -1}
                onClick={() => choose(method.id, false)}
                onKeyDown={onKeyDown}
                className="flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-1.5 py-2.5 text-center sm:flex-row sm:gap-2 sm:px-3"
                style={{
                  borderRadius: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  background: selected ? OLIVE : 'transparent',
                  color: selected ? CREAM : INK,
                  transition: 'background 0.2s ease, color 0.2s ease',
                  fontFamily: SANS,
                }}
              >
                <span
                  lang="nb"
                  style={{ fontWeight: 700, fontSize: 'clamp(13px,1.6vw,16px)', lineHeight: 1.2, hyphens: 'auto' }}
                >
                  {method.name}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 'clamp(12px,1.4vw,14px)',
                    color: selected ? '#ecdcb8' : SOFT,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPercent(method.rate)}
                </span>
              </button>
            )
          })}
        </div>

        {PARTNER_METHODS.map((method) => (
          <div
            key={method.id}
            role="tabpanel"
            id={method.id}
            aria-labelledby={`tab-${method.id}`}
            hidden={method.id !== active}
            tabIndex={0}
            className="mt-[clamp(32px,4vw,52px)] outline-none focus-visible:ring-2 focus-visible:ring-[#5e6a48] focus-visible:ring-offset-4"
            style={{ scrollMarginTop: '90px', borderRadius: '12px' }}
          >
            {panels[method.id]}
          </div>
        ))}
      </div>
    </section>
  )
}
