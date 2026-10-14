import Link from 'next/link'
import { CREAM, GOLD, SANS, SECTION_PAD } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import ApplicationForm from './ApplicationForm'
import { Icon, SectionHeading } from './ui'

const NEXT_STEPS = [
  'Vi vurderer søknaden og tar kontakt.',
  'Blir den godkjent, får du én partneravtale til signering. Den dekker alle tre metodene.',
  'Etter signering får du din personlige promokode og kan ta i bruk de metodene du ønsker.',
]

/**
 * «Klar til å bli aBoks-partner?» — the closing call to action and the ONE application form.
 * One application and one agreement cover all three earning methods; there is deliberately no
 * per-method form.
 */
export default function ApplicationSection() {
  return (
    <section
      id="sok"
      aria-labelledby="sok-title"
      style={{
        background: 'linear-gradient(165deg, #2c3223 0%, #1f231a 60%, #171a13 100%)',
        padding: SECTION_PAD,
        scrollMarginTop: '90px',
      }}
    >
      <div className="max-w-container mx-auto grid grid-cols-1 gap-12 px-[clamp(20px,5vw,48px)] lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <SectionHeading
            id="sok-title"
            eyebrow="Søk nå · Én søknad for alle tre metodene"
            title="Klar til å bli aBoks-partner?"
            intro="Én søknad og én partneravtale gir tilgang til promokode, bedriftssalg og forhandlersalg. Fortell oss gjerne hvilke metoder du er mest interessert i."
            light
          />
          <ol className="mt-9" style={{ listStyle: 'none', padding: 0 }}>
            {NEXT_STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-4"
                style={{ padding: '14px 0', borderTop: '1px solid rgba(250,246,238,.12)', fontFamily: SANS, fontSize: '15px', lineHeight: 1.55, color: 'rgba(250,246,238,.86)' }}
              >
                <span
                  className="inline-flex shrink-0 items-center justify-center"
                  style={{ width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${GOLD}`, color: GOLD, fontWeight: 700, fontSize: '13px' }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-start gap-3" style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.6, color: 'rgba(250,246,238,.7)' }}>
            <Icon name="approval" size={18} color={GOLD} />
            <span>
              Les hvordan vi behandler personopplysninger i{' '}
              <Link href="/personvernerklaering" style={{ color: CREAM, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                personvernerklæringen
              </Link>
              . Spørsmål? Skriv til{' '}
              <a href="mailto:post@aboks.no" style={{ color: CREAM, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                post@aboks.no
              </a>
              .
            </span>
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <ApplicationForm />
        </Reveal>
      </div>
    </section>
  )
}
