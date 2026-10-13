import Reveal from '../historien/Reveal'
import {
  OPEN_TO,
  SALGSPARTNER_CONDITIONS,
  SALGSPARTNER_TERMS,
} from '@/lib/partnerProgram/content'
import { BEIGE, BORDER_WARM, INK, PALE_SAGE, SANS, SECTION_PAD, SOFT, OLIVE } from '../bedrifter/theme'
import { Icon, SectionHeading } from './ui'
import styles from './bliPartner.module.css'

/**
 * «Bli aBoks-salgspartner» — the open programme in depth: who it is for, every core term as
 * a card, and the conditions that limit them, always shown alongside.
 */
export default function SalgspartnerSection() {
  return (
    <section
      id="salgspartner"
      aria-labelledby="salgspartner-title"
      style={{ background: BEIGE, padding: SECTION_PAD, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <Reveal>
            <SectionHeading
              id="salgspartner-title"
              eyebrow="Program 1 · Åpent nå"
              title="Bli aBoks-salgspartner"
              intro="En enkel måte å skape inntekter på – uten varelager, oppstartskostnader eller krav til salgsvolum."
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
                color: OLIVE,
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
                    background: '#fffdf8',
                    border: `1px solid ${BORDER_WARM}`,
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: '14.5px',
                    color: INK,
                  }}
                >
                  <Icon name="check" size={16} strokeWidth={2.2} />
                  {group}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <ul
          className="mt-[clamp(40px,5vw,64px)] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={{ listStyle: 'none', padding: 0 }}
        >
          {SALGSPARTNER_TERMS.map((term, i) => (
            <li key={term.title}>
              <Reveal delay={Math.min(i % 4, 3) * 0.06} style={{ height: '100%' }}>
                <div
                  className={`${styles.card} h-full`}
                  style={{
                    background: '#fffdf8',
                    border: `1px solid ${BORDER_WARM}`,
                    borderRadius: '20px',
                    padding: '24px 22px',
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: '44px', height: '44px', borderRadius: '14px', background: PALE_SAGE }}
                  >
                    <Icon name={term.icon} />
                  </span>
                  <h3
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: '16.5px',
                      lineHeight: 1.35,
                      color: INK,
                      margin: '18px 0 8px',
                    }}
                  >
                    {term.title}
                  </h3>
                  <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.65, color: SOFT, margin: 0 }}>
                    {term.text}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal>
          <div
            className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3"
            style={{
              borderTop: `1px solid ${BORDER_WARM}`,
              paddingTop: '28px',
            }}
          >
            {SALGSPARTNER_CONDITIONS.map((condition) => (
              <p
                key={condition}
                className="flex items-start gap-3"
                style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.65, color: SOFT, margin: 0 }}
              >
                <span aria-hidden="true" style={{ color: OLIVE, fontWeight: 700, lineHeight: 1.5 }}>
                  —
                </span>
                {condition}
              </p>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
