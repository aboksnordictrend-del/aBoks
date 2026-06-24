import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Kjøpsvilkår',
  description:
    'Les kjøpsvilkårene for aBoks. Informasjon om betaling, levering, angrerett, reklamasjon og dine rettigheter som kunde.',
  alternates: {
    canonical: '/kjopsvilkar',
  },
  openGraph: {
    title: 'Kjøpsvilkår | aBoks',
    description:
      'Les kjøpsvilkårene for aBoks. Informasjon om betaling, levering, angrerett, reklamasjon og dine rettigheter som kunde.',
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

export default function KjopsvilkarPage() {
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Kjøpsvilkår</span>
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
            Juridisk
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
            Kjøpsvilkår
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

          <Section number="01" title="Avtalen">
            <p style={bodyStyle}>
              Kjøpsavtalen inngås mellom deg som kjøper og LUKOCIUS NORDICTREND (se kontaktinformasjon
              nederst). Ved å gjennomføre et kjøp bekrefter du at du har lest og akseptert disse kjøpsvilkårene.
            </p>
            <p style={bodyStyle}>
              Avtalen utfylles av gjeldende norsk lovgivning, herunder forbrukerkjøpsloven og angrerettloven.
            </p>
          </Section>

          <Section number="02" title="Priser">
            <p style={bodyStyle}>
              Alle priser er oppgitt i norske kroner (NOK) og inkluderer merverdiavgift (MVA). Vi forbeholder
              oss retten til å endre priser uten forhåndsvarsel. Prisen som gjelder for din bestilling, er
              den som vises i handlekurven på tidspunktet for kjøpet.
            </p>
          </Section>

          <Section number="03" title="Betaling">
            <p style={bodyStyle}>
              Betaling skjer via Kustom Checkout. Vi aksepterer følgende betalingsmåter:
            </p>
            <ul
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: 'clamp(15px,1.1vw,16px)',
                lineHeight: 1.75,
                color: '#4a4e41',
                margin: '0 0 12px',
                paddingLeft: '24px',
              }}
            >
              <li>Vipps</li>
              <li>Klarna</li>
              <li>Visa / Mastercard</li>
            </ul>
            <p style={bodyStyle}>
              Beløpet trekkes når bestillingen bekreftes.
            </p>
          </Section>

          <Section number="04" title="Levering">
            <p style={bodyStyle}>
              Vi sender kun til adresser i Norge. Levering skjer med Posten, og normal leveringstid er
              2–5 virkedager etter at bestillingen er bekreftet og betalt.
            </p>
            <p style={bodyStyle}>
              Du vil motta en ordrebekreftelse per e-post, og en ny e-post med sporingsinformasjon når
              pakken er sendt.
            </p>
          </Section>

          <Section number="05" title="Risiko for varen">
            <p style={bodyStyle}>
              Risikoen for varen går over på deg som kjøper når varen er levert på den oppgitte
              leveringsadressen.
            </p>
          </Section>

          <Section number="06" title="Forhåndsbestilling">
            <p style={bodyStyle}>
              Dersom du bestiller en vare som er under produksjon (forhåndsbestilling), vil forventet
              leveringstid fremgå av produktsiden og ordrebekreftelsen. Vi tar kontakt med deg dersom
              det skulle oppstå forsinkelser.
            </p>
          </Section>

          <Section number="07" title="Angrerett og retur">
            <p style={bodyStyle}>
              Du har 14 dagers angrerett fra den dagen du mottar varen, i henhold til angrerettloven.
              For å benytte angreretten, ta kontakt med oss innen fristen.
            </p>
            <p style={bodyStyle}>
              Ved retur dekker kunden returfrakten. Varen må returneres i vesentlig samme stand og mengde
              som ved mottak, med original emballasje der dette er mulig.
            </p>
            <p style={bodyStyle}>
              Les mer om hvordan du benytter angreretten og sender retur på vår{' '}
              <Link href="/angrerett" style={linkStyle}>side om angrerett</Link>.
            </p>
          </Section>

          <Section number="08" title="Reklamasjon">
            <p style={bodyStyle}>
              Reklamasjon på varer med feil eller mangler følger Forbrukerkjøpsloven. Du må melde ifra
              innen rimelig tid etter at du oppdaget – eller burde ha oppdaget – feilen.
            </p>
            <p style={bodyStyle}>
              Ved godkjent reklamasjon kan vi tilby reparasjon, erstatning med ny vare eller refusjon
              av kjøpesummen, i henhold til gjeldende regler.
            </p>
            <p style={bodyStyle}>
              For å starte en reklamasjon, ta kontakt med oss på{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>.
            </p>
          </Section>

          <Section number="09" title="Skadet pakke ved levering">
            <p style={bodyStyle}>
              Hvis pakken er skadet ved levering, ber vi deg kontakte oss så snart som mulig og ta
              bilder av emballasjen før pakken åpnes.
            </p>
          </Section>

          <Section number="10" title="Produktinformasjon og 3D-printing">
            <p style={bodyStyle}>
              aBoks er et egetutviklet produkt som selges som ny vare og produseres med 3D-printing.
            </p>
            <p style={bodyStyle}>
              På grunn av produksjonsmetoden kan det forekomme små variasjoner i overflate, struktur
              og finish fra produkt til produkt. Dette er normalt for 3D-printede produkter og regnes
              ikke som feil eller mangel. Produktets funksjon, kvalitet og brukbarhet skal likevel
              alltid samsvare med beskrivelsen.
            </p>
          </Section>

          <Section number="11" title="Personopplysninger">
            <p style={bodyStyle}>
              Vi behandler dine personopplysninger i samsvar med gjeldende personvernlovgivning. Les
              mer i vår{' '}
              <Link href="/personvernerklaering" style={linkStyle}>personvernerklæring</Link>.
            </p>
          </Section>

          <Section number="12" title="Tvister">
            <p style={bodyStyle}>
              Partene skal i første omgang forsøke å løse eventuelle tvister i minnelighet. Dersom
              dette ikke fører frem, kan du som forbruker ta saken videre til{' '}
              <a
                href="https://www.forbrukertilsynet.no"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Forbrukertilsynet
              </a>{' '}
              eller{' '}
              <a
                href="https://www.forbrukerradet.no"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Forbrukerrådet
              </a>.
            </p>
          </Section>

          <Section number="13" title="Kontaktinformasjon">
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>LUKOCIUS NORDICTREND</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>Org.nr.: 937 172 877</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>Storhaugveien 13, 7240 Hitra</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>
              E-post:{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>
            </p>
            <p style={{ ...bodyStyle, marginBottom: 0 }}>Telefon: 41 88 14 22</p>
          </Section>

        </div>
      </div>
    </main>
  )
}
