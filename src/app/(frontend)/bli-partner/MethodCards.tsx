'use client'

import type { MouseEvent } from 'react'
import Reveal from '../historien/Reveal'
import { PARTNER_METHODS, type PartnerMethod } from '@/lib/partnerProgram/methods'
import { formatPercent } from '@/lib/partnerProgram/calculator'
import { BORDER_WARM, CREAM, GOLD, INK, MUTED, OLIVE, PALE_SAGE, SANS, SECTION_PAD, SERIF, SOFT } from '../bedrifter/theme'
import { Icon, SectionHeading } from './ui'
import { selectPartnerMethod } from './methodSelection'
import styles from './bliPartner.module.css'

/**
 * «Velg én metode – eller kombiner alle tre» — one card per earning method of the single
 * partner programme, each with its commission rate.
 *
 * A card's link selects that method in the tab section below and scrolls to it. The link
 * keeps a real `href="#bedriftssalg"`, so a new tab or a copied link opens the same method.
 */
export default function MethodCards() {
  return (
    <section
      id="metoder"
      aria-labelledby="metoder-title"
      style={{ background: CREAM, padding: SECTION_PAD, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Reveal>
          <SectionHeading
            id="metoder-title"
            eyebrow="Ett partnerprogram · tre metoder"
            title="Velg én metode – eller kombiner alle tre"
            intro="Alle godkjente partnere får tilgang til alle tre metodene under den samme partneravtalen. Du bestemmer selv hva du vil bruke, og når."
          />
        </Reveal>

        <ul
          className="mt-[clamp(40px,5vw,64px)] grid grid-cols-1 gap-5 md:grid-cols-3"
          style={{ listStyle: 'none', padding: 0 }}
        >
          {PARTNER_METHODS.map((method, i) => (
            <li key={method.id}>
              <Reveal delay={0.08 * i} style={{ height: '100%' }}>
                <MethodCard method={method} featured={method.id === 'bedriftssalg'} />
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal>
          <ul
            className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3"
            style={{ listStyle: 'none', padding: 0, margin: '32px 0 0' }}
          >
            {['Én søknad og én avtale', 'Ingen salgsmål eller aktivitetskrav', 'Bruk én, flere eller alle metodene'].map(
              (point) => (
                <li
                  key={point}
                  className="flex items-center gap-2"
                  style={{ fontFamily: SANS, fontWeight: 600, fontSize: '14.5px', color: SOFT }}
                >
                  <Icon name="check" size={17} color="#5f8253" strokeWidth={2.2} />
                  {point}
                </li>
              ),
            )}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

function MethodCard({ method, featured }: { method: PartnerMethod; featured: boolean }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    selectPartnerMethod(method.id)
  }

  const dark = featured
  return (
    <article
      className={`${styles.card} relative flex h-full flex-col overflow-hidden`}
      style={{
        background: dark ? `linear-gradient(155deg, #3f4730 0%, ${OLIVE} 50%, #262a1e 100%)` : '#fffdf8',
        border: dark ? 'none' : `1px solid ${BORDER_WARM}`,
        borderRadius: '26px',
        padding: 'clamp(26px,3vw,38px)',
        color: dark ? CREAM : INK,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: dark ? 'rgba(250,246,238,.1)' : PALE_SAGE,
          }}
        >
          <Icon name={method.icon} color={dark ? GOLD : undefined} />
        </span>
        <span
          aria-hidden="true"
          style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '22px', color: dark ? 'rgba(250,246,238,.45)' : MUTED }}
        >
          {method.number}
        </span>
      </div>

      <h3
        style={{
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: 'clamp(28px,2.6vw,36px)',
          letterSpacing: '-0.015em',
          lineHeight: 1.1,
          margin: '22px 0 0',
        }}
      >
        {method.name}
      </h3>

      <p className="flex flex-wrap items-baseline gap-x-3" style={{ margin: '14px 0 0' }}>
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: 'clamp(52px,5.4vw,72px)',
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            color: dark ? '#ecdcb8' : OLIVE,
          }}
        >
          {formatPercent(method.rate)}
        </span>
        <span style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.45, color: dark ? 'rgba(250,246,238,.75)' : SOFT }}>
          {method.rateLabel}
        </span>
      </p>

      <p
        style={{
          fontFamily: SANS,
          fontSize: '15px',
          lineHeight: 1.65,
          color: dark ? 'rgba(250,246,238,.85)' : SOFT,
          margin: '18px 0 0',
        }}
      >
        {method.tagline}
      </p>

      <div className="mt-auto pt-8">
        <a
          href={`#${method.id}`}
          onClick={onClick}
          data-btn
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: '15px',
            color: dark ? CREAM : OLIVE,
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
            textDecorationColor: dark ? 'rgba(250,246,238,.4)' : 'rgba(57,64,44,.35)',
            minHeight: '44px',
          }}
        >
          Slik fungerer {method.name.toLowerCase()}
          <span className={styles.ctaArrow}>
            <Icon name="arrow" size={17} color={dark ? GOLD : OLIVE} strokeWidth={2} />
          </span>
        </a>
      </div>
    </article>
  )
}
