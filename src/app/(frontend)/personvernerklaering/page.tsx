import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Personvernerklæring',
  description:
    'Les hvordan aBoks behandler personopplysninger, cookies, betaling, levering og markedsføring.',
  alternates: {
    canonical: '/personvernerklaering',
  },
  openGraph: {
    title: 'Personvernerklæring | aBoks',
    description:
      'Les hvordan aBoks behandler personopplysninger, cookies, betaling, levering og markedsføring.',
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

export default function PersonvernerklaerngPage() {
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Personvernerklæring</span>
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
              fontSize: 'clamp(38px,5vw,68px)',
              letterSpacing: '-0.024em',
              lineHeight: 1.0,
              color: '#1a1d17',
              margin: '0 0 18px',
            }}
          >
            Personvernerklæring
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

          <Section number="01" title="Behandlingsansvarlig">
            <p style={bodyStyle}>
              Behandlingsansvarlig for personopplysninger på dette nettstedet er:
            </p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>LUKOCIUS NORDICTREND</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>Org.nr.: 937 172 877</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>Storhaugveien 13, 7240 Hitra</p>
            <p style={{ ...bodyStyle, marginBottom: '4px' }}>
              E-post:{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>
            </p>
            <p style={{ ...bodyStyle, marginBottom: '12px' }}>Telefon: 41 88 14 22</p>
            <p style={bodyStyle}>
              Vi behandler personopplysninger i samsvar med EUs personvernforordning (GDPR) og
              norsk personopplysningslov.
            </p>
          </Section>

          <Section number="02" title="Hvilke personopplysninger vi samler inn">
            <p style={bodyStyle}>
              Avhengig av hva du gjør på nettstedet, kan vi samle inn følgende opplysninger:
            </p>
            <ul style={listStyle}>
              <li>Navn</li>
              <li>E-postadresse</li>
              <li>Telefonnummer</li>
              <li>Leveringsadresse</li>
              <li>Fakturaadresse</li>
              <li>Ordreinformasjon og betalingsstatus</li>
              <li>IP-adresse</li>
              <li>Informasjonskapsler (cookies)</li>
              <li>Teknisk informasjon om nettleser og enhet</li>
            </ul>
            <p style={bodyStyle}>
              Vi samler kun inn opplysninger som er nødvendige for formålet de brukes til.
            </p>
          </Section>

          <Section number="03" title="Hvorfor vi behandler personopplysninger">
            <p style={bodyStyle}>
              Vi behandler personopplysninger for følgende formål:
            </p>
            <ul style={listStyle}>
              <li>Behandle og gjennomføre bestillinger</li>
              <li>Organisere levering av varer</li>
              <li>Gjennomføre betaling</li>
              <li>Håndtere kundeservice, retur og reklamasjon</li>
              <li>Overholde lovpålagte forpliktelser</li>
              <li>Forbedre nettstedet og brukeropplevelsen</li>
              <li>Sende nyhetsbrev og markedsføring der du har gitt samtykke</li>
            </ul>
            <p style={bodyStyle}>
              Behandlingsgrunnlaget er oppfyllelse av kjøpsavtale (GDPR art. 6 nr. 1 b), rettslig
              forpliktelse (art. 6 nr. 1 c) og/eller samtykke (art. 6 nr. 1 a) der det er relevant.
            </p>
          </Section>

          <Section number="04" title="Betaling og checkout">
            <p style={bodyStyle}>
              Betaling gjennomføres via Kustom Checkout, som støtter Vipps, Klarna og kortbetaling
              (Visa / Mastercard). Vi lagrer ikke kortinformasjon selv — all betalingsdata håndteres
              av de respektive betalingsløsningene i henhold til deres egne personvernerklæringer.
            </p>
            <p style={bodyStyle}>
              Les mer om vilkår for kjøp i våre{' '}
              <Link href="/kjopsvilkar" style={linkStyle}>kjøpsvilkår</Link>.
            </p>
          </Section>

          <Section number="05" title="Levering">
            <p style={bodyStyle}>
              For å kunne levere varer til deg, deler vi nødvendige opplysninger (navn og
              leveringsadresse) med Posten. Disse opplysningene brukes utelukkende for å
              gjennomføre leveransen.
            </p>
          </Section>

          <Section number="06" title="Nyhetsbrev og markedsføring">
            <p style={bodyStyle}>
              Vi kan bruke e-posttjenesten Brevo til å sende nyhetsbrev og markedsføring. Du mottar
              slike e-poster kun dersom du selv har gitt samtykke til det.
            </p>
            <p style={bodyStyle}>
              Du kan trekke tilbake samtykket og melde deg av nyhetsbrevet når som helst ved å
              klikke på avmeldingslenken i e-posten, eller ved å ta kontakt med oss på{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>.
            </p>
          </Section>

          <Section number="07" title="Informasjonskapsler">
            <p style={bodyStyle}>
              Nettstedet bruker informasjonskapsler (cookies) til følgende formål:
            </p>
            <ul style={listStyle}>
              <li>Nødvendige funksjoner som handlekurv og checkout</li>
              <li>Analyse av trafikk og bruksatferd</li>
              <li>Markedsføring og annonsering</li>
              <li>Forbedring av brukeropplevelsen</li>
            </ul>
            <p style={bodyStyle}>
              Du kan når som helst endre eller trekke tilbake samtykke til cookies via
              innstillingene i nettleseren din, eller gjennom cookie-banneret på nettstedet dersom
              dette er tilgjengelig.
            </p>
          </Section>

          <Section number="08" title="Analyse og annonsering">
            <p style={bodyStyle}>
              Vi bruker følgende tjenester for analyse og markedsføring:
            </p>
            <ul style={listStyle}>
              <li>
                <strong>Google Analytics</strong> — for å forstå hvordan besøkende bruker
                nettstedet. Data kan overføres til og lagres i USA.
              </li>
              <li>
                <strong>Meta Pixel</strong> — for å måle effekten av annonsering på Facebook og
                Instagram, og for å vise relevante annonser.
              </li>
            </ul>
            <p style={bodyStyle}>
              Disse tjenestene kan bruke cookies og samle inn anonymiserte eller pseudonymiserte
              opplysninger om besøk på nettstedet. Du kan reservere deg mot slik sporing ved å
              justere cookie-innstillingene.
            </p>
          </Section>

          <Section number="09" title="Deling av personopplysninger">
            <p style={bodyStyle}>
              Vi deler personopplysninger kun med tredjeparter i den utstrekning det er nødvendig
              for å oppfylle formålene beskrevet i denne erklæringen. Aktuelle mottakere kan være:
            </p>
            <ul style={listStyle}>
              <li>Kustom Checkout, Vipps, Klarna og kortbetalingsløsninger (betaling)</li>
              <li>Posten (levering)</li>
              <li>Brevo (e-postmarkedsføring)</li>
              <li>Google og Meta (analyse og annonsering)</li>
              <li>Vercel (hosting og drift av nettstedet)</li>
              <li>Andre tekniske leverandører som er nødvendige for drift av nettbutikken</li>
            </ul>
            <p style={bodyStyle}>
              Vi selger aldri personopplysninger til tredjeparter. Alle databehandlere vi bruker
              er underlagt databehandleravtaler og behandler data kun i henhold til våre
              instrukser.
            </p>
          </Section>

          <Section number="10" title="Lagringstid">
            <p style={bodyStyle}>
              Vi lagrer personopplysninger så lenge det er nødvendig for formålet de ble samlet
              inn for, eller så lenge vi er pålagt å gjøre det etter lov — for eksempel gjelder
              regnskapslovens krav om 5 års oppbevaring for transaksjonsdata.
            </p>
            <p style={bodyStyle}>
              Opplysninger knyttet til nyhetsbrev slettes når du melder deg av, eller dersom du
              ikke lenger er aktiv abonnent over tid.
            </p>
          </Section>

          <Section number="11" title="Dine rettigheter">
            <p style={bodyStyle}>
              Som registrert har du etter GDPR følgende rettigheter:
            </p>
            <ul style={listStyle}>
              <li>Rett til innsyn i hvilke opplysninger vi har om deg</li>
              <li>Rett til å korrigere feilaktige opplysninger</li>
              <li>Rett til å kreve sletting («retten til å bli glemt»)</li>
              <li>Rett til å begrense behandlingen</li>
              <li>Rett til dataportabilitet</li>
              <li>Rett til å protestere mot behandling basert på legitime interesser</li>
              <li>Rett til å trekke tilbake samtykke når som helst, uten at det påvirker tidligere behandling</li>
            </ul>
            <p style={bodyStyle}>
              For å benytte deg av rettighetene dine, ta kontakt med oss på{' '}
              <a href="mailto:post@aboks.no" style={linkStyle}>post@aboks.no</a>. Vi svarer
              innen 30 dager.
            </p>
            <p style={bodyStyle}>
              Du har også rett til å klage til{' '}
              <a
                href="https://www.datatilsynet.no"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Datatilsynet
              </a>{' '}
              dersom du mener vi behandler personopplysningene dine i strid med gjeldende regler.
            </p>
          </Section>

          <Section number="12" title="Sikkerhet">
            <p style={bodyStyle}>
              Vi tar sikkerhet på alvor og iverksetter tekniske og organisatoriske tiltak for å
              beskytte personopplysningene dine mot uautorisert tilgang, tap eller misbruk.
              Nettstedet er kryptert med HTTPS, og vi bruker kun leverandører med gode
              sikkerhetsrutiner.
            </p>
          </Section>

          <Section number="13" title="Endringer i personvernerklæringen">
            <p style={bodyStyle}>
              Vi kan oppdatere denne personvernerklæringen ved behov — for eksempel hvis vi tar i
              bruk nye tjenester eller regelverket endres. Datoen øverst på siden viser når
              erklæringen sist ble oppdatert. Vi anbefaler at du leser denne siden jevnlig.
            </p>
          </Section>

          <Section number="14" title="Kontaktinformasjon">
            <p style={bodyStyle}>
              Har du spørsmål om hvordan vi behandler personopplysningene dine, ta gjerne kontakt:
            </p>
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
