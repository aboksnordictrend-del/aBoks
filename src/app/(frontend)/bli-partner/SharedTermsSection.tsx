import Reveal from '../historien/Reveal'
import { OPEN_TO, SHARED_CONDITIONS, SHARED_TERMS } from '@/lib/partnerProgram/content'
import { CREAM, GOLD, SANS, SECTION_PAD } from '../bedrifter/theme'
import { Icon, SectionHeading } from './ui'
import styles from './bliPartner.module.css'

/**
 * «Felles for alle partnere» — what one partner agreement gives, whichever methods are used:
 * who can apply, every shared term as a card, and the conditions that limit them, always
 * shown alongside.
 */
export default function SharedTermsSection() {
  return (
    <section
      id="felles-vilkar"
      aria-labelledby="felles-title"
      style={{ background: '#1f231a', padding: SECTION_PAD, color: CREAM, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <Reveal>
            <SectionHeading
              id="felles-title"
              eyebrow="Felles for alle partnere"
              title="Én avtale som dekker alt"
              intro="Uansett om du bruker én metode eller alle tre, gjelder de samme grunnvilkårene – uten varelager, oppstartskostnader eller krav til salgsvolum."
              light
            />
          </Reveal>
          <Reveal delay={0.08}>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: '11.5px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: GOLD,
                margin: '0 0 12px',
              }}
            >
              Programmet er åpent for
            </p>
            <ul className="flex flex-wrap gap-2.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {OPEN_TO.map((group) => (
                <li
                  key={group}
                  className="inline-flex items-center gap-2 rounded-full"
                  style={{
                    padding: '10px 16px',
                    background: 'rgba(250,246,238,.06)',
                    border: '1px solid rgba(250,246,238,.18)',
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: '14.5px',
                    color: CREAM,
                  }}
                >
                  <Icon name="check" size={16} color={GOLD} strokeWidth={2.2} />
                  {group}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <ul
          className="mt-[clamp(40px,5vw,64px)] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{ listStyle: 'none', padding: 0 }}
        >
          {SHARED_TERMS.map((term, i) => (
            <li key={term.title}>
              <Reveal delay={Math.min(i % 4, 3) * 0.06} style={{ height: '100%' }}>
                <div
                  className={`${styles.card} h-full`}
                  style={{
                    background: 'rgba(250,246,238,.04)',
                    border: '1px solid rgba(250,246,238,.14)',
                    borderRadius: '20px',
                    padding: '24px 22px',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(250,246,238,.08)' }}
                  >
                    <Icon name={term.icon} color={GOLD} />
                  </span>
                  <h3
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: '16.5px',
                      lineHeight: 1.35,
                      color: CREAM,
                      margin: '18px 0 8px',
                    }}
                  >
                    {term.title}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.65, color: 'rgba(250,246,238,.78)', margin: 0 }}>
                    {term.text}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal>
          <ul
            className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3"
            style={{ listStyle: 'none', margin: '32px 0 0', padding: '28px 0 0', borderTop: '1px solid rgba(250,246,238,.14)' }}
          >
            {SHARED_CONDITIONS.map((condition) => (
              <li
                key={condition}
                className="flex items-start gap-3"
                style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.65, color: 'rgba(250,246,238,.78)' }}
              >
                <span aria-hidden="true" style={{ color: GOLD, fontWeight: 700, lineHeight: 1.5 }}>
                  —
                </span>
                {condition}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
