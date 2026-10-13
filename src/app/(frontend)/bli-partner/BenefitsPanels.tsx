'use client'

import { CUSTOMER_BENEFITS, PARTNER_BENEFITS } from '@/lib/partnerProgram/content'
import {
  PARTNER_COMMISSION_PERCENT,
  PARTNER_DISCOUNT_PERCENT,
  formatPercent,
} from '@/lib/partnerProgram/calculator'
import { BEIGE, BORDER_WARM, CREAM, GOLD, INK, OLIVE, SANS, SECTION_PAD, SERIF, SOFT, SAGE } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { AnimatedNumber, Icon, SectionHeading } from './ui'
import styles from './bliPartner.module.css'

/**
 * «Fordeler for både kunden og deg» — the customer's side and the partner's side as two
 * complementary panels, then the three-party flow (partner → customer → ABOKS AS → partner)
 * that shows where the code, the order and the commission travel.
 *
 * The headline percentages come from the calculator module, so the page cannot print one
 * figure here and calculate with another.
 */
export default function BenefitsPanels() {
  return (
    <section aria-labelledby="fordeler-title" style={{ background: BEIGE, padding: SECTION_PAD }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Reveal>
          <SectionHeading id="fordeler-title" eyebrow="Fordeler" title="Fordeler for både kunden og deg" center />
        </Reveal>

        <div className="mt-[clamp(40px,5vw,64px)] grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal style={{ height: '100%' }}>
            <Panel
              tone="light"
              label="For kunden"
              figure={PARTNER_DISCOUNT_PERCENT}
              figureCaption="ekstra rabatt med partnerkoden"
              items={CUSTOMER_BENEFITS}
            />
          </Reveal>
          <Reveal delay={0.1} style={{ height: '100%' }}>
            <Panel
              tone="dark"
              label="For deg som partner"
              figure={PARTNER_COMMISSION_PERCENT}
              figureCaption="provisjon på kvalifiserte salg, beregnet uten frakt"
              items={PARTNER_BENEFITS}
            />
          </Reveal>
        </div>

        <Reveal>
          <FlowDiagram />
        </Reveal>

        <p
          className="mx-auto mt-8 max-w-[62ch] text-center"
          style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.65, color: SOFT }}
        >
          Provisjon opptjenes bare på kvalifiserte salg. Partnerskapet gir ingen garantert eller
          fast inntekt.
        </p>
      </div>
    </section>
  )
}

function Panel({
  tone,
  label,
  figure,
  figureCaption,
  items,
}: {
  tone: 'light' | 'dark'
  label: string
  figure: number
  figureCaption: string
  items: readonly string[]
}) {
  const dark = tone === 'dark'
  return (
    <div
      className="relative h-full overflow-hidden"
      style={{
        borderRadius: '28px',
        padding: 'clamp(28px,4vw,48px)',
        background: dark ? `linear-gradient(160deg, #424a33 0%, ${OLIVE} 55%, #262a1e 100%)` : '#fffdf8',
        border: dark ? 'none' : `1px solid ${BORDER_WARM}`,
        color: dark ? CREAM : INK,
      }}
    >
      <p
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: dark ? GOLD : SAGE,
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
        style={{ margin: '18px 0 26px' }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: 'clamp(64px,8vw,104px)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: dark ? '#ecdcb8' : OLIVE,
          }}
        >
          <AnimatedNumber value={figure} format={(n) => formatPercent(Math.round(n))} countFromZero duration={1.2} />
        </span>
        <span
          style={{
            fontFamily: SANS,
            fontSize: '15px',
            lineHeight: 1.5,
            color: dark ? 'rgba(250,246,238,.78)' : SOFT,
            maxWidth: '26ch',
          }}
        >
          {figureCaption}
        </span>
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3"
            style={{
              borderTop: `1px solid ${dark ? 'rgba(250,246,238,.14)' : BORDER_WARM}`,
              padding: '14px 0',
              fontFamily: SANS,
              fontSize: '15px',
              lineHeight: 1.55,
              color: dark ? 'rgba(250,246,238,.9)' : SOFT,
            }}
          >
            <span style={{ marginTop: '2px' }}>
              <Icon name="check" size={18} color={dark ? GOLD : '#5f8253'} strokeWidth={2.2} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ────────────────────────────── three-party flow ────────────────────────────── */

const NODES = [
  { title: 'Partner', text: 'Deler sin personlige kode' },
  { title: 'Kunde', text: 'Handler på aboks.no med rabatt' },
  { title: 'ABOKS AS', text: 'Leverer varene og gjør opp provisjonen' },
] as const

const LINKS = ['Partnerkode', 'Bestilling'] as const

function FlowDiagram() {
  return (
    <figure
      className="mt-[clamp(40px,5vw,64px)]"
      style={{
        background: '#fffdf8',
        border: `1px solid ${BORDER_WARM}`,
        borderRadius: '28px',
        padding: 'clamp(24px,4vw,44px)',
      }}
    >
      <figcaption
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: SAGE,
          margin: '0 0 24px',
          textAlign: 'center',
        }}
      >
        Slik henger det sammen
      </figcaption>

      <ol
        className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-4"
        style={{ listStyle: 'none', padding: 0, margin: 0 }}
      >
        {NODES.map((node, i) => (
          <FlowItem key={node.title} node={node} index={i} link={LINKS[i]} />
        ))}
      </ol>

      {/* The commission's way back to the partner closes the loop. */}
      <div className="mt-4 hidden md:block" aria-hidden="true">
        <svg viewBox="0 0 1000 70" className="h-[56px] w-full" fill="none" preserveAspectRatio="none">
          <path
            className={styles.flow}
            d="M 860 6 C 860 60, 820 62, 500 62 S 140 60, 140 6"
            stroke={GOLD}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <path d="M 132 18 L 140 4 L 148 18" stroke={GOLD} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p
        className="mt-3 text-center"
        style={{ fontFamily: SANS, fontWeight: 600, fontSize: '14px', color: OLIVE, margin: '12px 0 0' }}
      >
        <span aria-hidden="true">↺ </span>Provisjon til partneren for kvalifiserte salg
      </p>
    </figure>
  )
}

function FlowItem({
  node,
  index,
  link,
}: {
  node: (typeof NODES)[number]
  index: number
  link?: string
}) {
  return (
    <>
      <li
        className="text-center"
        style={{
          background: index === 2 ? OLIVE : CREAM,
          color: index === 2 ? CREAM : INK,
          border: `1px solid ${index === 2 ? OLIVE : BORDER_WARM}`,
          borderRadius: '20px',
          padding: '20px 18px',
        }}
      >
        <span style={{ display: 'block', fontFamily: SERIF, fontWeight: 600, fontSize: '24px', lineHeight: 1.1 }}>
          {node.title}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: '6px',
            fontFamily: SANS,
            fontSize: '14px',
            lineHeight: 1.5,
            color: index === 2 ? 'rgba(250,246,238,.8)' : SOFT,
          }}
        >
          {node.text}
        </span>
      </li>
      {link && (
        <li aria-hidden="true" className="flex flex-col items-center justify-center py-1 md:py-0">
          <svg viewBox="0 0 80 24" className="hidden h-6 w-20 md:block" fill="none">
            <path className={styles.flow} d="M2 12 H 70" stroke={OLIVE} strokeWidth="2" />
            <path d="M64 5 L 74 12 L 64 19" stroke={OLIVE} strokeWidth="2" />
          </svg>
          <svg viewBox="0 0 24 40" className="h-9 w-6 md:hidden" fill="none">
            <path className={styles.flow} d="M12 2 V 32" stroke={OLIVE} strokeWidth="2" />
            <path d="M5 26 L 12 36 L 19 26" stroke={OLIVE} strokeWidth="2" />
          </svg>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: SAGE }}>
            {link}
          </span>
        </li>
      )}
    </>
  )
}
