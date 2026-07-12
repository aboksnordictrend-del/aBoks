import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import HowItWorksSteps from '@/components/HowItWorksSteps'
import { COMPARTMENTS, STEP_DETAILS, CAPACITY } from '@/lib/content'

export const metadata: Metadata = {
  title: {
    absolute: 'Slik fungerer aBoks | Enkel batterioppbevaring',
  },
  description:
    'Slik fungerer aBoks: tre adskilte rom for nye AA, nye AAA og brukte batterier. Se de fire stegene fra du pakker ut boksen til du leverer brukte batterier til gjenvinning.',
  alternates: {
    canonical: '/slik-fungerer-det',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/slik-fungerer-det',
    title: 'Slik fungerer aBoks | Enkel batterioppbevaring',
    description:
      'Tre rom, fire enkle steg. Se hvordan aBoks gir nye og brukte batterier hver sin faste plass – og hvordan de brukte faktisk når gjenvinningen.',
  },
}

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '17px 36px',
  borderRadius: '999px',
  background: '#39402c',
  color: '#faf6ee',
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: '15px',
  textDecoration: 'none',
}

const textLink: React.CSSProperties = {
  color: '#39402c',
  fontFamily: 'var(--font-manrope)',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

export default function SlikFungererDetPage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Slik fungerer det' }]} />

        {/* Page heading */}
        <div style={{ marginBottom: 'clamp(48px,6vw,72px)', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '0 0 14px',
          }}>
            Slik fungerer det
          </p>
          <h1 style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(38px,5vw,68px)',
            letterSpacing: '-0.024em',
            lineHeight: 1.0,
            color: '#1a1d17',
            margin: '0 0 18px',
          }}>
            Slik fungerer aBoks
          </h1>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: 'clamp(15px,1.2vw,17px)',
            lineHeight: 1.6,
            color: '#6b6f63',
            margin: '0 auto',
            maxWidth: '560px',
          }}>
            aBoks gir hvert batteri sin faste plass. Nye AA, nye AAA og et eget rom for de brukte –
            så du alltid ser hva du har, og hva som skal til gjenvinning. Her går vi gjennom de tre
            rommene og de fire stegene fra utpakking til levering.
          </p>
        </div>

        {/* De tre rommene */}
        <section style={{ marginBottom: 'clamp(64px,8vw,96px)' }}>
          <h2 style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(30px,3.6vw,46px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.07,
            color: '#1a1d17',
            margin: '0 0 clamp(28px,3.5vw,40px)',
          }}>
            Én boks. Tre rom.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '760px' }}>
            {COMPARTMENTS.map((c) => (
              <div key={c.tag} style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', padding: '18px 0', borderTop: '1px solid #e7e2d4' }}>
                <span style={{ flexShrink: 0, width: '54px', height: '54px', borderRadius: '999px', background: '#e6ecdf', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '14px', color: '#39402c' }}>
                  {c.tag}
                </span>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#1a1d17', margin: '0 0 4px' }}>{c.name}</h3>
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.5, color: '#6b6f63', margin: 0 }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fire steg */}
        <section style={{ marginBottom: 'clamp(64px,8vw,96px)' }}>
          <h2 style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(30px,3.6vw,46px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.07,
            color: '#1a1d17',
            margin: '0 0 clamp(28px,3.5vw,40px)',
          }}>
            Klar på få minutter.
          </h2>
          <HowItWorksSteps descriptions={STEP_DETAILS} />
        </section>

        {/* Kapasitet */}
        <section style={{ marginBottom: 'clamp(64px,8vw,96px)' }}>
          <h2 style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(30px,3.6vw,46px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.07,
            color: '#1a1d17',
            margin: '0 0 clamp(28px,3.5vw,40px)',
          }}>
            Plass til hverdagen.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(24px,3vw,40px)' }}>
            {CAPACITY.map((c) => (
              <div key={c.unit}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(44px,5vw,64px)', lineHeight: 1, color: '#39402c', marginBottom: '10px' }}>
                  {c.big}
                </div>
                <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '16px', color: '#1a1d17', margin: '0 0 4px' }}>{c.unit}</h3>
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.5, color: '#6b6f63', margin: 0 }}>{c.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA + interne lenker */}
        <section style={{ marginBottom: 'clamp(80px,10vw,128px)' }}>
          <div style={{
            borderRadius: '28px',
            background: '#39402c',
            padding: 'clamp(40px,6vw,72px) clamp(28px,5vw,64px)',
          }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#faf6ee', margin: '0 0 16px' }}>
              Klar for orden i batteriene?
            </h2>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', lineHeight: 1.6, color: '#c8d2c3', margin: '0 0 32px', maxWidth: '460px' }}>
              Se hele serien og velg fargen som passer hjemme hos deg.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
              <Link href="/produkter" data-btn style={{ ...primaryButton, background: '#faf6ee', color: '#1a1d17' }}>
                Se alle produkter
              </Link>
              <Link
                href="/produkter/aboks"
                data-btn
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '17px 36px',
                  borderRadius: '999px',
                  border: '1.5px solid rgba(250,246,238,0.45)',
                  color: '#faf6ee',
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 600,
                  fontSize: '15px',
                  textDecoration: 'none',
                }}
              >
                Bestill aBoks
              </Link>
            </div>
          </div>

          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: '16px',
            lineHeight: 1.7,
            color: '#4a4e41',
            margin: 'clamp(32px,4vw,48px) 0 0',
            maxWidth: '680px',
          }}>
            Lurer du på noe mer? Les <Link href="/vanlige-sporsmal" style={textLink}>vanlige spørsmål om aBoks</Link>,
            finn tips og guider under <Link href="/inspirasjon" style={textLink}>Inspirasjon</Link>, eller{' '}
            <Link href="/kontakt" style={textLink}>kontakt oss</Link> direkte. Du kan også gå tilbake til{' '}
            <Link href="/" style={textLink}>forsiden</Link>.
          </p>
        </section>

      </div>
    </main>
  )
}
