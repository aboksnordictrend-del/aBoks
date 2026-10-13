import Link from 'next/link'
import Accordion from '@/components/Accordion'
import { PARTNER_FAQ } from '@/lib/partnerProgram/content'
import { CREAM, OLIVE, SANS, SECTION_PAD, SOFT } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { SectionHeading } from './ui'

/** The FAQ, on the site's shared accordion (the same one the homepage uses). */
export default function PartnerFaq() {
  return (
    <section aria-labelledby="faq-title" style={{ background: CREAM, padding: SECTION_PAD }}>
      <div className="max-w-container mx-auto grid grid-cols-1 gap-10 px-[clamp(20px,5vw,48px)] lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <SectionHeading
            id="faq-title"
            eyebrow="Spørsmål og svar"
            title="Vanlige spørsmål om partnerskap"
            intro={
              <>
                Finner du ikke svaret du leter etter? Skriv til oss på{' '}
                <a href="mailto:post@aboks.no" style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  post@aboks.no
                </a>{' '}
                eller se{' '}
                <Link href="/kontakt" style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  kontaktsiden
                </Link>
                .
              </>
            }
          />
          <p style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.65, color: SOFT, margin: '18px 0 0', maxWidth: '46ch' }}>
            Svarene beskriver programmets hovedvilkår. Det er partneravtalen som gjelder for det
            enkelte samarbeidet.
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <Accordion items={[...PARTNER_FAQ]} />
        </Reveal>
      </div>
    </section>
  )
}
