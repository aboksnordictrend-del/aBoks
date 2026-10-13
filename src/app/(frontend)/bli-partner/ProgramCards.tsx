import Reveal from '../historien/Reveal'
import { PARTNER_PROGRAMS, isOpenProgram, type PartnerProgram } from '@/lib/partnerProgram/programs'
import {
  BEIGE,
  BORDER_WARM,
  CREAM,
  GOLD,
  INK,
  MUTED,
  OLIVE,
  SANS,
  SECTION_PAD,
  SERIF,
  SOFT,
} from '../bedrifter/theme'
import { Icon, SectionHeading } from './ui'
import styles from './bliPartner.module.css'

/**
 * «Tre veier til samarbeid» — one card per entry in `PARTNER_PROGRAMS`.
 *
 * The open programme gets the dominant, dark card with its figures and an active link; a
 * coming-soon programme gets a restrained card with a «Kommer snart» badge and no button at
 * all, so an unavailable programme can never be mistaken for one that takes applications.
 * Adding or opening a programme is a data change in `lib/partnerProgram/programs.ts`.
 */
export default function ProgramCards() {
  const [featured, ...rest] = [...PARTNER_PROGRAMS].sort(
    (a, b) => Number(isOpenProgram(b)) - Number(isOpenProgram(a)),
  )

  return (
    <section
      id="programmer"
      aria-labelledby="programmer-title"
      style={{ background: CREAM, padding: SECTION_PAD, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Reveal>
          <SectionHeading
            id="programmer-title"
            eyebrow="Partnerprogrammer"
            title="Tre veier til samarbeid"
            intro="Vi utvikler ulike samarbeidsmuligheter for mennesker og bedrifter som ønsker å vokse sammen med aBoks."
          />
        </Reveal>

        <ul
          className="mt-[clamp(40px,5vw,64px)] grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr] lg:grid-rows-2"
          style={{ listStyle: 'none', padding: 0 }}
        >
          <li className="lg:row-span-2">
            <Reveal style={{ height: '100%' }}>
              <FeaturedCard program={featured} />
            </Reveal>
          </li>
          {rest.map((program, i) => (
            <li key={program.id}>
              <Reveal delay={0.08 * (i + 1)} style={{ height: '100%' }}>
                {isOpenProgram(program) ? (
                  <FeaturedCard program={program} />
                ) : (
                  <ComingSoonCard program={program} />
                )}
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function StatusBadge({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '999px',
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: '11.5px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        background: open ? 'rgba(201,167,106,.18)' : BEIGE,
        color: open ? '#e8d6ad' : MUTED,
        border: open ? '1px solid rgba(201,167,106,.45)' : `1px solid ${BORDER_WARM}`,
      }}
    >
      {open && (
        <span
          aria-hidden="true"
          style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#9fc28b' }}
        />
      )}
      {open ? 'Åpen for søknader' : 'Kommer snart'}
    </span>
  )
}

function FeaturedCard({ program }: { program: PartnerProgram }) {
  return (
    <article
      className={`${styles.card} relative flex h-full flex-col overflow-hidden`}
      style={{
        background: `linear-gradient(155deg, #3f4730 0%, ${OLIVE} 45%, #262a1e 100%)`,
        borderRadius: '28px',
        padding: 'clamp(28px,4vw,52px)',
        color: CREAM,
      }}
    >
      {/* Quiet decoration: two concentric arcs in the corner. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-[340px] w-[340px]"
        viewBox="0 0 340 340"
        fill="none"
      >
        <circle cx="170" cy="170" r="120" stroke={GOLD} strokeOpacity=".22" />
        <circle cx="170" cy="170" r="165" stroke={GOLD} strokeOpacity=".12" />
      </svg>

      <StatusBadge open />
      <h3
        style={{
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: 'clamp(34px,3.6vw,50px)',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          margin: '22px 0 14px',
        }}
      >
        {program.name}
      </h3>
      <p
        style={{
          fontFamily: SANS,
          fontSize: 'clamp(15.5px,1.3vw,17px)',
          lineHeight: 1.7,
          color: 'rgba(250,246,238,.82)',
          margin: 0,
          maxWidth: '48ch',
        }}
      >
        {program.summary}
      </p>

      {program.highlights.length > 0 && (
        <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-7">
          {program.highlights.map((h) => (
            <div key={h.label} style={{ borderTop: '1px solid rgba(250,246,238,.16)', paddingTop: '16px' }}>
              <dt className="sr-only">{h.label}</dt>
              <dd style={{ margin: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontFamily: SERIF,
                    fontWeight: 600,
                    fontSize: 'clamp(30px,3vw,42px)',
                    lineHeight: 1,
                    color: '#ecdcb8',
                  }}
                >
                  {h.value}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    marginTop: '8px',
                    fontFamily: SANS,
                    fontSize: '14px',
                    lineHeight: 1.45,
                    color: 'rgba(250,246,238,.72)',
                  }}
                >
                  {h.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {program.cta && (
        <div className="mt-auto pt-10">
          <a
            href={program.cta.href}
            data-btn
            className="inline-flex items-center gap-2 rounded-full px-8"
            style={{
              minHeight: '54px',
              background: CREAM,
              color: INK,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: '15px',
              textDecoration: 'none',
            }}
          >
            {program.cta.label}
            <span className={styles.ctaArrow}>
              <Icon name="arrow" size={18} color={INK} strokeWidth={2} />
            </span>
          </a>
        </div>
      )}
    </article>
  )
}

function ComingSoonCard({ program }: { program: PartnerProgram }) {
  return (
    <article
      className="flex h-full flex-col"
      style={{
        background: '#fffdf8',
        border: `1px solid ${BORDER_WARM}`,
        borderRadius: '24px',
        padding: 'clamp(26px,3vw,38px)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <StatusBadge open={false} />
        <Icon name="lock" size={20} color={MUTED} />
      </div>
      <h3
        style={{
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: 'clamp(26px,2.4vw,32px)',
          letterSpacing: '-0.015em',
          lineHeight: 1.1,
          color: INK,
          margin: '22px 0 10px',
        }}
      >
        {program.name}
      </h3>
      <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.7, color: SOFT, margin: 0 }}>
        {program.summary}
      </p>
      <p
        className="mt-auto pt-6"
        style={{ fontFamily: SANS, fontSize: '13.5px', fontWeight: 600, color: MUTED, margin: 0 }}
      >
        Ikke åpent for søknader ennå.
      </p>
    </article>
  )
}
