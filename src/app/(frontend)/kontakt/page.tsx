import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'

export const metadata: Metadata = {
  title: {
    absolute: 'Kontakt aBoks | Vi hjelper deg',
  },
  description:
    'Ta kontakt med aBoks om produkter, bestilling, levering, retur eller samarbeid. Vi svarer normalt innen 1–2 virkedager.',
  alternates: {
    canonical: '/kontakt',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/kontakt',
    title: 'Kontakt aBoks | Vi hjelper deg',
    description:
      'Spørsmål om produkter, bestilling, levering eller retur? Ta kontakt med aBoks – vi hjelper deg.',
  },
}

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(22px,2vw,28px)',
  letterSpacing: '-0.01em',
  lineHeight: 1.15,
  color: '#1a1d17',
  margin: '0 0 14px',
}

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,16px)',
  lineHeight: 1.75,
  color: '#4a4e41',
  margin: '0 0 12px',
}

const listStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,16px)',
  lineHeight: 1.75,
  color: '#4a4e41',
  margin: '0 0 12px',
  paddingLeft: '24px',
}

const linkStyle: React.CSSProperties = {
  color: '#39402c',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'clamp(40px,4vw,56px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '16px' }}>
        <span
          style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            flexShrink: 0,
          }}
        >
          {number}
        </span>
        <h2 style={sectionHeadingStyle}>{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  )
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
      <span
        style={{
          flexShrink: 0,
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: '#eee9de',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          color: '#5e6a48',
        }}
      >
        {icon}
      </span>
      <div>{children}</div>
    </div>
  )
}

const IconEmail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 7 10-7" />
  </svg>
)

const IconPhone = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 7 7l1.09-1.09a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const IconAddress = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const IconFacebook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
)

const IconInstagram = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#5e6a48',
  marginBottom: '4px',
}

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,16px)',
  lineHeight: 1.6,
  color: '#1a1d17',
}

export default function KontaktPage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Kontakt oss' }]} />

        {/* Page heading */}
        <div style={{ marginBottom: 'clamp(48px,6vw,72px)', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#5e6a48',
              margin: '0 0 14px',
            }}
          >
            Vi er her for deg
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(40px,5vw,72px)',
              letterSpacing: '-0.024em',
              lineHeight: 1.0,
              color: '#1a1d17',
              margin: '0 0 18px',
            }}
          >
            Kontakt oss
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(15px,1.1vw,16px)',
              lineHeight: 1.6,
              color: '#6b6f63',
              margin: '0 auto',
              maxWidth: '420px',
            }}
          >
            Har du spørsmål? Vi hjelper deg gjerne og svarer normalt innen 1–2 virkedager.
          </p>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          <Section number="01" title="Kontaktinformasjon">
            <ContactRow icon={<IconEmail />}>
              <p style={labelStyle}>E-post</p>
              <a href="mailto:post@aboks.no" style={{ ...valueStyle, ...linkStyle }}>
                post@aboks.no
              </a>
            </ContactRow>

            <ContactRow icon={<IconPhone />}>
              <p style={labelStyle}>Telefon</p>
              <a href="tel:+4741881422" style={{ ...valueStyle, color: '#1a1d17', textDecoration: 'none' }}>
                +47 418 81 422
              </a>
            </ContactRow>

            <ContactRow icon={<IconAddress />}>
              <p style={labelStyle}>Adresse</p>
              <p style={{ ...valueStyle, margin: 0 }}>
                LUKOCIUS NORDICTREND<br />
                Org.nr. 937 172 877<br />
                Storhaugveien 13<br />
                7240 Hitra, Norge
              </p>
            </ContactRow>
          </Section>

          <Section number="02" title="Kundeservice">
            <p style={bodyStyle}>
              Har du spørsmål om aBoks, bestillingen din eller levering? Vi hjelper deg gjerne.
            </p>
            <p style={bodyStyle}>
              Ta kontakt via e-post eller telefon, så svarer vi så raskt som mulig. Normalt
              besvarer vi henvendelser innen <strong>1–2 virkedager</strong>.
            </p>
            <p style={bodyStyle}>
              Du finner svar på de vanligste spørsmålene i våre{' '}
              <Link href="/frakt-og-retur" style={linkStyle}>frakt og retur</Link>-sider og
              i{' '}
              <Link href="/kjopsvilkar" style={linkStyle}>kjøpsvilkårene</Link>.
            </p>
          </Section>

          <Section number="03" title="Reklamasjon og retur">
            <p style={bodyStyle}>
              Ved spørsmål om reklamasjon eller retur ber vi deg oppgi følgende i meldingen din:
            </p>
            <ul style={listStyle}>
              <li>Ordrenummer</li>
              <li>Navn</li>
              <li>En kort beskrivelse av saken</li>
              <li>Bilder dersom produktet er skadet eller har en feil</li>
            </ul>
            <p style={bodyStyle}>
              Send dette til{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>, så tar vi
              oss av resten. Les mer om dine rettigheter på siden{' '}
              <Link href="/frakt-og-retur" style={linkStyle}>Frakt og retur</Link>.
            </p>
          </Section>

          <Section number="04" title="Samarbeid">
            <p style={bodyStyle}>
              Ønsker du å samarbeide med aBoks, selge våre produkter eller har andre
              forretningshenvendelser? Vi er åpne for gode samtaler.
            </p>
            <p style={bodyStyle}>
              Send oss en e-post på{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>.
            </p>
          </Section>

          <Section number="05" title="Følg aBoks">
            <p style={bodyStyle}>
              Følg oss på Facebook og Instagram for nyheter, oppdateringer og produktlansering.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <a
                href="https://www.facebook.com/aboks.no"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#39402c',
                  textDecoration: 'none',
                  border: '1.5px solid #c9cfc0',
                  borderRadius: '999px',
                  padding: '10px 20px',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                <IconFacebook />
                aBoks på Facebook
              </a>
              <a
                href="https://www.instagram.com/aboks.no"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#39402c',
                  textDecoration: 'none',
                  border: '1.5px solid #c9cfc0',
                  borderRadius: '999px',
                  padding: '10px 20px',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                <IconInstagram />
                aBoks på Instagram
              </a>
            </div>
          </Section>

          {/* Closing note */}
          <div
            style={{
              borderTop: '1px solid rgba(26,29,23,0.1)',
              paddingTop: 'clamp(32px,3vw,48px)',
              marginTop: '8px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '14px',
                lineHeight: 1.75,
                color: '#6b6f63',
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              Vi setter stor pris på alle tilbakemeldinger og spørsmål. Takk for at du besøker aBoks.
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}
