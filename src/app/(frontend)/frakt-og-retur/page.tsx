import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Frakt og retur',
  description:
    'Informasjon om levering, frakt, retur, reklamasjon og forhåndsbestilling hos aBoks.',
  alternates: {
    canonical: '/frakt-og-retur',
  },
  openGraph: {
    title: 'Frakt og retur | aBoks',
    description:
      'Informasjon om levering, frakt, retur, reklamasjon og forhåndsbestilling hos aBoks.',
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

export default function FraktOgReturPage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            paddingTop: '18px',
            marginBottom: 'clamp(36px,5vw,56px)',
          }}
        >
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Frakt og retur</span>
        </div>

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
            Bestilling og levering
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
            Frakt og retur
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '14px',
              color: '#6b6f63',
              margin: 0,
            }}
          >
            Sist oppdatert: juni 2026
          </p>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          <Section number="01" title="Frakt">
            <p style={bodyStyle}>
              Vi sender alle bestillinger med Posten til adresser i Norge. Vi sender foreløpig
              ikke til utlandet.
            </p>
            <p style={bodyStyle}>
              Bestillinger behandles så raskt som mulig på hverdager. Når pakken er sendt, mottar
              du en e-post med sporingsinformasjon.
            </p>
          </Section>

          <Section number="02" title="Leveringstid">
            <p style={bodyStyle}>
              Normal leveringstid er <strong>2–5 virkedager</strong> etter at bestillingen er
              bekreftet og betalt.
            </p>
            <p style={bodyStyle}>
              Leveringstiden kan variere noe avhengig av Postens kapasitet og leveringssted. Vi
              gjør vårt beste for å sende bestillingene raskt.
            </p>
          </Section>

          <Section number="03" title="Sporingsinformasjon">
            <p style={bodyStyle}>
              Når pakken din er sendt, mottar du en e-post med sporingsnummer slik at du kan følge
              forsendelsen på Postens nettsider.
            </p>
          </Section>

          <Section number="04" title="Fraktkostnader">
            <p style={bodyStyle}>
              Frakt koster <strong>69 kr</strong>. Ved kjøp for <strong>650 kr eller mer</strong> er
              frakten gratis.
            </p>
            <p style={bodyStyle}>
              Fraktkostnaden beregnes automatisk i kassen basert på din bestillingssum.
            </p>
          </Section>

          <Section number="05" title="Forhåndsbestilling">
            <p style={bodyStyle}>
              Dersom du bestiller en vare som er under produksjon, vil forventet leveringstid
              fremgå av produktsiden eller opplyses i ordrebekreftelsen. Vi tar kontakt dersom
              det skulle oppstå forsinkelser.
            </p>
            <p style={bodyStyle}>
              Les mer om forhåndsbestilling i våre{' '}
              <Link href="/kjopsvilkar" style={linkStyle}>kjøpsvilkår</Link>.
            </p>
          </Section>

          <Section number="06" title="Retur">
            <p style={bodyStyle}>
              Du har <strong>14 dagers angrerett</strong> fra den dagen du mottar varen, i henhold
              til angrerettloven. Ønsker du å returnere varen, må du melde fra til oss innen
              angrefristen.
            </p>
            <ul style={listStyle}>
              <li>Varen skal returneres i vesentlig samme stand som da du mottok den.</li>
              <li>Kunden betaler returfrakten ved vanlig retur.</li>
              <li>Bruk gjerne original emballasje dersom det er mulig.</li>
            </ul>
            <p style={bodyStyle}>
              Les mer om angreretten på vår{' '}
              <Link href="/angrerett" style={linkStyle}>side om angrerett</Link>.
            </p>
          </Section>

          <Section number="07" title="Tilbakebetaling">
            <p style={bodyStyle}>
              Tilbakebetaling skjer etter at returen er mottatt og kontrollert. Vi behandler
              refusjonen så raskt som mulig, og beløpet tilbakeføres til den betalingsmetoden
              som ble brukt ved kjøpet.
            </p>
          </Section>

          <Section number="08" title="Skadet pakke ved levering">
            <p style={bodyStyle}>
              Hvis pakken er skadet ved levering, ber vi deg kontakte oss så snart som mulig og
              ta bilder av emballasjen før pakken åpnes.
            </p>
            <p style={bodyStyle}>
              Ta kontakt på{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a> eller ring oss
              på 41 88 14 22.
            </p>
          </Section>

          <Section number="09" title="Reklamasjon">
            <p style={bodyStyle}>
              Reklamasjon behandles i henhold til Forbrukerkjøpsloven. Dersom produktet har en
              produksjonsfeil eller har blitt skadet under transport, ber vi deg kontakte oss så
              raskt som mulig med en beskrivelse av feilen og bilder.
            </p>
            <p style={bodyStyle}>
              Vi vil finne en god løsning — enten reparasjon, erstatning eller refusjon, avhengig
              av situasjonen. Les mer i våre{' '}
              <Link href="/kjopsvilkar" style={linkStyle}>kjøpsvilkår</Link>.
            </p>
          </Section>

          <Section number="10" title="Kontakt oss">
            <p style={bodyStyle}>
              Har du spørsmål om frakt, levering eller retur? Ta gjerne kontakt — vi hjelper deg
              gjerne.
            </p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>LUKOCIUS NORDICTREND</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>Org.nr.: 937 172 877</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>Storhaugveien 13, 7240 Hitra</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>
              E-post:{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>
            </p>
            <p style={{ ...bodyStyle, marginBottom: '16px' }}>Telefon: 41 88 14 22</p>
            <p style={bodyStyle}>
              Du finner mer informasjon i vår{' '}
              <Link href="/personvernerklaering" style={linkStyle}>personvernerklæring</Link>{' '}
              og våre{' '}
              <Link href="/kjopsvilkar" style={linkStyle}>kjøpsvilkår</Link>.
            </p>
          </Section>

        </div>
      </div>
    </main>
  )
}
