import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'hvordan-fungerer-tradlos-strom',
    title: 'Hvordan fungerer trådløs strøm? Den komplette guiden | aBoks',
    description:
      'Hvordan fungerer trådløs strøm? Vi forklarer induksjon, Qi2, energitap og sikkerhet – og hva teknologien betyr for batteriene du fortsatt har hjemme.',
    ogDescription:
      'En grundig, fagfellevennlig guide til trådløs strøm: induktiv kobling, magnetisk resonans, RF-overføring og energihøsting forklart på norsk. Artikkelen dekker Qi- og Qi2-standarden, hvor mye energi som går tapt sammenlignet med kabel, myter om stråling og batterislitasje, ladevettreglene fra DSB og Norsk brannvernforening, og hvorfor AA- og AAA-batterier fortsatt trenger en fast plass i hjemmet.',
  }),
  keywords: [
    'trådløs strøm', 'trådløs lading', 'Qi2', 'MagSafe', 'induksjon',
    'elektromagnetisk induksjon', 'energieffektivitet', 'batterisikkerhet',
    'ladevettregler', 'litiumbatterier', 'smart hjem', 'bærekraftig hjem',
    'batterioppbevaring',
  ],
}

/* ── Style tokens ── */
const pStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,17px)',
  lineHeight: 1.8,
  color: '#4a4e41',
  margin: '0 0 22px',
}

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(26px,2.4vw,34px)',
  letterSpacing: '-0.015em',
  lineHeight: 1.15,
  color: '#1a1d17',
  margin: '56px 0 18px',
}

const h3Style: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: 'clamp(16px,1.3vw,19px)',
  color: '#1a1d17',
  margin: '36px 0 14px',
}

const extLink: React.CSSProperties = {
  color: '#39402c',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

/* ── Components ── */
function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '5px 0' }}>
      <span style={{
        flexShrink: 0, width: '7px', height: '7px', borderRadius: '50%',
        background: '#5e6a48', marginTop: '9px',
      }} />
      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#4a4e41' }}>
        {children}
      </span>
    </li>
  )
}

function NumberedItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '6px 0' }}>
      <span style={{
        flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%',
        background: '#39402c', color: '#faf6ee', marginTop: '2px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-manrope)', fontSize: '12px', fontWeight: 700,
      }}>{n}</span>
      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#4a4e41' }}>
        {children}
      </span>
    </li>
  )
}

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 30px', background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px' }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        color: '#5e6a48', background: '#eee9de', padding: '5px 12px',
        borderRadius: '999px', marginBottom: '14px',
      }}>{label}</span>
      <div style={{ ...pStyle, margin: 0 }}>{children}</div>
    </div>
  )
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details style={{ borderBottom: '1px solid #ddd8ce' }}>
      <summary style={{
        cursor: 'pointer', padding: '18px 4px',
        fontFamily: 'var(--font-manrope)', fontWeight: 700,
        fontSize: 'clamp(15px,1.1vw,16px)', color: '#1a1d17', listStyle: 'none',
      }}>
        {question}
      </summary>
      <div style={{ padding: '0 4px 20px', ...pStyle, margin: 0 }}>{children}</div>
    </details>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', background: '#eee9de', border: '1px solid #d8d2c7',
      borderRadius: '999px', padding: '5px 14px', margin: '4px 6px 4px 0',
      fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#4a4e41',
    }}>{label}</span>
  )
}

const TRANSFER_ROWS: string[][] = [
  ['Induktiv kobling (Qi/Qi2)', '0–4 cm', '5–25 W', 'Mobil, ørepropper, smartklokke, elektrisk tannbørste'],
  ['Magnetisk resonans', '10–20 cm', '3–75 kW', 'Elbil, industrikjøretøy, medisinsk utstyr'],
  ['Radiofrekvent (RF)', 'Opptil noen meter', 'Milliwatt', 'IoT-sensorer, elektroniske prislapper'],
  ['Infrarød stråle', 'Opptil ca. 4 meter', 'Milliwatt–watt', 'Smartlåser, kameraer, dørklokker'],
  ['Energihøsting', 'Ingen sender', 'Mikrowatt', 'Trådløse brytere, temperaturfølere'],
]

const SOURCES = [
  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) – råd om elsikkerhet og brannfare ved lading', url: 'https://www.dsb.no/' },
  { label: 'Elsikkerhetsportalen – ladevettreglene fra Norsk brannvernforening, DSB og If', url: 'https://elsikkerhetsportalen.no/elektrisk-utstyr/ladetips/' },
  { label: 'Direktoratet for strålevern og atomsikkerhet (DSA) – elektromagnetiske felt og grenseverdier', url: 'https://www.dsa.no/om-straling-og-radioaktivitet/elektromagnetiske-felt' },
  { label: 'Folkehelseinstituttet – kunnskapsoppsummering om elektromagnetiske felt og helse, januar 2026', url: 'https://www.fhi.no/nyheter/2026/elektromagnetiske-felt-og-helse/' },
  { label: 'Miljødirektoratet – regelverk for innsamling og gjenvinning av batterier', url: 'https://www.miljodirektoratet.no/' },
  { label: 'Nasjonal kommunikasjonsmyndighet (Nkom) – måling av elektromagnetiske felt', url: 'https://nkom.no/fysiske-nett-og-infrastruktur/elektromagnetisk-straling' },
  { label: 'Teknisk Ukeblad – virkningsgrad ved trådløs lading av kjøretøy', url: 'https://www.tu.no/' },
  { label: 'Statistisk sentralbyrå (SSB) – statistikk over avfall og elektrisk forbruk i husholdninger', url: 'https://www.ssb.no/' },
]

export default function ArticlePage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
          fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63',
          paddingTop: '18px', marginBottom: 'clamp(36px,5vw,48px)',
        }}>
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <Link href="/inspirasjon" style={{ color: '#6b6f63', textDecoration: 'none' }}>Inspirasjon</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvordan fungerer trådløs strøm?</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Teknologi &amp; bærekraft
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvordan fungerer <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>trådløs strøm?</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Trådløs strøm har flyttet inn i norske hjem – i nattbordladeren, i øreproppene
              og i bilen. Men hva skjer egentlig i luftgapet mellom laderen og telefonen? Her
              er den forståelige forklaringen, tallene som overrasker, og de praktiske rådene
              som gjør hverdagen både tryggere og mer bærekraftig.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 8 min · Juli 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Det finnes en liten hverdagsmagi i å legge telefonen fra seg på en plate og se
              ladesymbolet lyse opp. Ingen kabel, ingen kontakt, ingen ledning som floker seg
              bak nattbordet. <strong>Trådløs strøm</strong> føles nesten som noe fra
              fremtiden – men prinsippet bak er faktisk over 190 år gammelt, og det er det
              samme som får en vanlig transformator til å virke.
            </p>

            <p style={pStyle}>
              I denne guiden går vi gjennom hvordan trådløs strøm overføres, hvilke standarder
              som styrer teknologien i 2026, hvor mye energi som forsvinner på veien, og hva
              alt dette betyr for de batteriene du fortsatt har liggende i skuffen. For selv i
              et hjem fullt av ladeplater er det fortsatt AA- og AAA-batterier i
              fjernkontrollen, veggklokka og barnas leker.
            </p>

            <h2 style={h2Style}>Kort forklart: dette er trådløs strøm</h2>

            <p style={pStyle}>
              Trådløs strøm – eller trådløs kraftoverføring – er fellesbetegnelsen på alle
              metoder som flytter elektrisk energi fra en sender til en mottaker uten en fysisk
              leder mellom dem. I stedet for elektroner som løper gjennom en kobberkabel,
              brukes et elektromagnetisk felt som bærer energien over et gap.
            </p>

            <p style={pStyle}>
              Grunnprinsippet ble beskrevet av Michael Faraday allerede i 1831: et magnetfelt
              som endrer seg over tid, induserer en elektrisk spenning i en nærliggende
              lederkrets. Nikola Tesla brukte resten av livet på å drømme stort om det. I dag
              sitter resultatet i nattbordet ditt.
            </p>

            <h3 style={h3Style}>1. Induktiv kobling – teknologien i ladeplaten</h3>

            <p style={pStyle}>
              Dette er metoden nesten alle trådløse ladere hjemme bruker. Inne i ladeplaten
              ligger en flat kobberspole. Når vekselstrøm sendes gjennom den, oppstår et
              magnetfelt som pulserer tusenvis av ganger i sekundet. Legger du telefonen oppå,
              treffer feltet en tilsvarende mottakerspole i telefonen, og det induseres en
              strøm der. Elektronikken i telefonen likeretter strømmen og sender den videre til
              batteriet.
            </p>

            <p style={pStyle}>
              Rekkevidden er kort – vanligvis noen få millimeter opp til rundt fire centimeter.
              Det er nok til at de fleste mobildeksler fungerer fint, så lenge de ikke er svært
              tykke eller inneholder metall.
            </p>

            <h3 style={h3Style}>2. Magnetisk resonans – litt mer slingringsmonn</h3>

            <p style={pStyle}>
              Ved å la sender- og mottakerspolen svinge på samme resonansfrekvens kan energien
              overføres over noe lengre avstand og med mindre krav til presis plassering.
              Prinsippet brukes blant annet i trådløs lading av elbiler, der ladeplaten i
              asfalten og platen under bilen kan stå 10–20 centimeter fra hverandre.
              Virkningsgraden fra strømnett til bilbatteri er oppgitt til rundt 90 prosent i
              slike systemer.
            </p>

            <h3 style={h3Style}>3. Radiobølger og infrarødt lys – strøm gjennom rommet</h3>

            <p style={pStyle}>
              Den mest futuristiske varianten sender energi som radiobølger eller smale
              infrarøde lysstråler flere meter gjennom et rom. Effekten er lav – vi snakker
              milliwatt, ikke watt – så dette handler ikke om å lade telefonen fra taket. Det
              handler om sensorer, dørlåser, temperaturmålere og andre små enheter som kan
              holdes i live kontinuerlig uten batteribytte. Beslektet er{' '}
              <em>energihøsting</em>, der en enhet trekker mikrowatt fra lys, vibrasjon eller
              varme i omgivelsene.
            </p>

            {/* Oversiktstabell */}
            <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', minWidth: '640px',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Teknologi', 'Typisk avstand', 'Typisk effekt', 'Der du finner den'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '13px 16px',
                        background: '#39402c', color: '#faf6ee',
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRANSFER_ROWS.map((row, i) => (
                    <tr key={row[0]}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < TRANSFER_ROWS.length - 1 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top',
                          color: j === 0 ? '#39402c' : '#4a4e41',
                          fontWeight: j === 0 ? 700 : 400,
                          lineHeight: 1.6,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#7a756c', margin: '0 0 28px' }}>
              Oversikt over de vanligste formene for trådløs kraftoverføring. Effekt- og
              avstandsangivelser er typiske verdier for forbrukerutstyr i 2026.
            </p>

            <h2 style={h2Style}>Qi, Qi2 og MagSafe – standardene som holder orden</h2>

            <p style={pStyle}>
              At du kan legge en Samsung på en lader kjøpt til en iPhone, skyldes en felles
              standard. <strong>Qi</strong> (uttales «tsji») er utviklet av
              bransjeorganisasjonen Wireless Power Consortium og beskriver hvordan sender og
              mottaker skal kommunisere, hvilke frekvenser som brukes, og hvordan effekten
              reguleres underveis.
            </p>

            <p style={pStyle}>
              Før strømmen begynner å flyte, «snakker» laderen og enheten sammen: hvor mye
              effekt tåler du, ligger du riktig, blir det for varmt? Laderen har også{' '}
              <em>fremmedlegemedeteksjon</em> som stopper overføringen hvis en mynt, en nøkkel
              eller en nøkkelring havner mellom spolene og begynner å varmes opp av
              virvelstrømmer.
            </p>

            <p style={pStyle}>
              <strong>Qi2</strong>, som kom i 2023, la til en ring av magneter rundt spolen –
              samme grep som Apples MagSafe. Magnetene låser telefonen i riktig posisjon, og
              det høres kanskje trivielt ut, men det er den enkeltfaktoren som har mest å si
              for hvor effektiv ladingen blir. Nyere revisjoner av standarden har hevet
              effekten til 25 W for kompatible enheter.
            </p>

            <h2 style={h2Style}>Hvor mye strøm forsvinner underveis?</h2>

            <p style={pStyle}>
              Her kommer den delen få tenker over. Trådløs strøm er praktisk, men den er ikke
              gratis: hver omforming av energi koster litt, og det som går tapt, forsvinner som
              varme.
            </p>

            <p style={pStyle}>
              En vanlig kablet lader leverer typisk 85–95 prosent av energien fra stikkontakten
              videre til batteriet. En trådløs løsning ligger lavere. Målinger av
              mobiltelefoner har vist at en full opplading som krever rundt 15 wattimer med
              kabel, kan trenge omtrent 21 wattimer trådløst – altså rundt 40 prosent mer.
              Tester av magnetiske ladere har vist noe bedre tall, i størrelsesorden 24–36
              prosent merforbruk. Ligger telefonen skjevt på platen, kan effektiviteten
              halveres. Og en ladeplate som står i stikkontakten uten noe oppå, trekker
              fortsatt et par tideler av en watt.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Trådløs lading koster deg noen kroner i året. Den virkelige kostnaden er varmen –
              for varme er den største fienden til et litiumbatteri.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                aBoks redaksjon
              </footer>
            </blockquote>

            <p style={pStyle}>
              La oss sette tallene i perspektiv. Seks ekstra wattimer per lading blir rundt 2
              kilowattimer i året for én telefon som lades daglig – noen få kroner. Det er ikke
              der problemet ligger. Problemet er at overskuddsenergien blir til varme akkurat
              der du minst ønsker den: i batteriet. Litiumionbatterier eldes raskere ved høy
              temperatur, og et batteri som degraderes fortere, betyr en telefon som byttes ut
              tidligere. Da blir regnestykket plutselig et helt annet, og det er der
              miljøeffekten faktisk ligger.
            </p>

            <Callout label="Slik lader du trådløst med minst mulig tap">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  Velg en Qi2- eller MagSafe-sertifisert lader med magnetisk justering –
                  riktig plassering er halve jobben.
                </BulletItem>
                <BulletItem>Ta av tykke deksler, ringholdere og kortholdere i metall.</BulletItem>
                <BulletItem>
                  Lad på et hardt, kjølig underlag – aldri under en pute, et pledd eller i
                  senga.
                </BulletItem>
                <BulletItem>
                  Trekk ut laderen når den ikke er i bruk, eller koble den til en
                  skjøtekontakt med bryter.
                </BulletItem>
                <BulletItem>Bruk kabel når du har det travelt og trenger rask, kjølig lading.</BulletItem>
              </ul>
            </Callout>

            <h2 style={h2Style}>Tre seiglivede myter om trådløs strøm</h2>

            <h3 style={h3Style}>Myte 1: «Trådløs lading ødelegger batteriet»</h3>

            <p style={pStyle}>
              Selve induksjonen skader ingenting. Det er varmen som slår ut, og moderne enheter
              struper ladehastigheten hvis temperaturen nærmer seg 45 °C. Lader du kjølig og
              luftig, er forskjellen liten. De samme prinsippene gjelder uansett batteritype –
              vi har samlet dem i guiden om{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                hvordan du forlenger levetiden på batteriene dine
              </Link>.
            </p>

            <h3 style={h3Style}>Myte 2: «Strålingen fra ladeplaten er farlig»</h3>

            <p style={pStyle}>
              Feltene fra en ladeplate er svake, lavfrekvente og faller dramatisk i styrke bare
              noen centimeter unna. Norge følger grenseverdiene fra den internasjonale
              kommisjonen ICNIRP, og en fersk kunnskapsoppsummering fra{' '}
              <a href="https://www.fhi.no/nyheter/2026/elektromagnetiske-felt-og-helse/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Folkehelseinstituttet
              </a>
              , utført på oppdrag fra Direktoratet for strålevern og atomsikkerhet,
              konkluderte i januar 2026 med at forskningen ikke har påvist helseeffekter av
              svake elektromagnetiske felt under grenseverdiene. Har du pacemaker eller annet
              implantert medisinsk utstyr, følger du produsentens avstandsanbefaling – det er
              det eneste reelle forbeholdet.
            </p>

            <h3 style={h3Style}>Myte 3: «Snart trenger vi ikke batterier i det hele tatt»</h3>

            <p style={pStyle}>
              Dette er den mest utbredte misforståelsen. Trådløs strøm erstatter ikke batteriet
              – den fyller det. Bortsett fra noen få batterifrie sensorer og brytere er alt
              annet fortsatt avhengig av en celle som lagrer energien. Og i et vanlig norsk hjem
              finnes det fremdeles et sted mellom 30 og 100 løse batterier: i fjernkontroller,
              veggklokker, røykvarslere, hodelykter, digitale termometre, barnas leker og
              pannelamper som brukes én gang i året.
            </p>

            <h2 style={h2Style}>Ladeplate på nattbordet – og batterier i skuffen</h2>

            <p style={pStyle}>
              Her ligger et lite paradoks. Vi har fått ryddigere nattbord uten kabler, samtidig
              som mengden løse batterier i hjemmet ikke har blitt mindre. Nye AA-batterier
              havner i en pose i skuffen, brukte legges «midlertidig» ved siden av
              mikrobølgeovnen, og etter noen måneder vet ingen lenger hvilke som er fulle og
              hvilke som er tomme.
            </p>

            <p style={pStyle}>
              Det er ikke bare et ryddeproblem. Brukte batterier som ligger løst sammen med
              nøkler, mynter og binders kan i uheldige tilfeller kortslutte, og litiumcellene i
              knappebatterier og små elektroniske enheter er spesielt følsomme for varme og
              mekanisk påkjenning. Løsningen er ikke mer teknologi – det er en fast plass. Vi
              har skrevet mer om dette i artikkelen om{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                hvordan du sorterer batteriene riktig hjemme
              </Link>.
            </p>

            {/* Produktblokk */}
            <div style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', margin: '40px 0',
            }}>
              <span style={{
                display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
                letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
                color: '#c8cebb', marginBottom: '14px',
              }}>Praktisk løsning</span>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(20px,1.8vw,26px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 16px',
              }}>
                Én boks. Tre rom. Full oversikt.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                <Link href="/produkter/aboks" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks
                </Link>{' '}
                er utviklet i Norge for akkurat dette problemet: nye AA i ett rom, nye AAA i et
                annet, og et eget rom for de brukte som skal leveres til gjenvinning. Du ser på
                ett blikk hva du har igjen – og de tomme cellene blir liggende trygt samlet i
                stedet for løst i skuffen, helt til du tar dem med på neste butikktur.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Med plass til 20 AA og 36 AAA, matt finish og et formspråk laget for å stå
                fremme, passer den like naturlig på hjemmekontoret som ved TV-en. Vil du spare
                benkeplass, finnes den også i en veggmontert utgave –{' '}
                <Link href="/produkter/aboks-vegg" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks Vegg
                </Link>
                .
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link
                  href="/produkter/aboks"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                    letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                    background: '#5e6a48', color: '#faf6ee', textDecoration: 'none',
                  }}
                >
                  Se aBoks
                </Link>
                <Link
                  href="/produkter/aboks-vegg"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                    letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                    background: 'transparent', color: '#faf6ee', textDecoration: 'none',
                    border: '1px solid rgba(250,246,238,0.4)',
                  }}
                >
                  Se aBoks Vegg
                </Link>
              </div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9fb08f', margin: '16px 0 0' }}>
                Designet i Norge · fri frakt over kr 650
              </p>
            </div>

            <h2 style={h2Style}>Trygg lading hjemme: ladevettreglene</h2>

            <p style={pStyle}>
              Enten du lader trådløst eller med kabel, gjelder de samme grunnreglene.{' '}
              <a href="https://elsikkerhetsportalen.no/elektrisk-utstyr/ladetips/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Ladevettreglene
              </a>{' '}
              er utarbeidet av Norsk brannvernforening, Direktoratet for samfunnssikkerhet og
              beredskap (DSB) og forsikringsselskapet If, og de er verdt å henge på innsiden av
              skapdøra:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>Lad i et rom med røykvarsler.</NumberedItem>
              <NumberedItem n={2}>Lad når du er våken og til stede.</NumberedItem>
              <NumberedItem n={3}>Les og følg produsentens bruksanvisning, og bruk helst original lader.</NumberedItem>
              <NumberedItem n={4}>Lad på et underlag som ikke lett kan brenne – og dekk aldri til laderen.</NumberedItem>
              <NumberedItem n={5}>Ikke lad i senga, i korridorer eller i trapperom som skal brukes som rømningsvei.</NumberedItem>
              <NumberedItem n={6}>Bytt ut skadet utstyr, og stopp ladingen hvis det oppstår lyder, lukt eller unormal varme.</NumberedItem>
              <NumberedItem n={7}>Ved røyk eller flammer: kom deg ut og ring 110.</NumberedItem>
            </ol>

            <Callout label="Visste du at ...">
              En brann i et litiumionbatteri kan bli så varm at den er svært vanskelig å slokke,
              og den utvikler store mengder giftig gass på kort tid. Det er hovedgrunnen til at
              DSB anbefaler at du er våken og til stede når du lader – ikke fordi elektriske
              apparater brenner oftere om natten, men fordi konsekvensene blir langt større når
              ingen oppdager det.
            </Callout>

            <h2 style={h2Style}>Hva betyr trådløs strøm for et mer bærekraftig hjem?</h2>

            <p style={pStyle}>
              Teknologien peker i to retninger samtidig. På den ene siden: flere ladeplater, mer
              elektronikk og litt høyere energiforbruk per lading. På den andre: færre slitte
              kontakter, færre kabler som kastes, og på sikt sensorer og smartlåser som aldri
              trenger batteribytte. Det siste er reelt bærekraftig – hvert batteri som aldri
              produseres, er det mest miljøvennlige batteriet som finnes.
            </p>

            <p style={pStyle}>
              I mellomtiden ligger den største gevinsten fortsatt i det lavpraktiske: bruke
              batteriene du har til de faktisk er tomme, velge oppladbare der det gir mening, og
              sørge for at de brukte havner i gjenvinning i stedet for i restavfallet. Metallene
              i et batteri – nikkel, kobolt, litium, sink og mangan – kan gjenvinnes og brukes
              på nytt, men bare hvis batteriet leveres inn. Les mer om{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>
              , eller se oversikten over{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">Ofte stilte spørsmål om trådløs strøm</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvordan fungerer trådløs strøm helt enkelt forklart?">
                En spole i laderen lager et magnetfelt som skifter retning tusenvis av ganger i
                sekundet. En tilsvarende spole i telefonen fanger opp feltet, og det oppstår en
                elektrisk strøm i den. Strømmen likerettes og sendes til batteriet. Ingen
                elektroner hopper gjennom lufta – det er magnetfeltet som bærer energien.
              </FaqItem>
              <FaqItem question="Bruker trådløs lading mer strøm enn kabel?">
                Ja. Målinger tyder på et merforbruk på omtrent 25–40 prosent, avhengig av lader,
                deksel og hvor presist enheten ligger. I kroner er det snakk om noen få kroner i
                året per telefon, men energien blir til varme som over tid sliter på batteriet.
              </FaqItem>
              <FaqItem question="Kan jeg lade gjennom et mobildeksel?">
                Som regel ja. De fleste ladere håndterer et luftgap på noen millimeter. Unngå
                deksler med metallplater, magnetholdere som ikke er laget for formålet, eller
                kredittkort og nøkkelkort mellom telefon og lader – kort med magnetstripe eller
                RFID-brikke kan bli skadet.
              </FaqItem>
              <FaqItem question="Er MagSafe det samme som Qi2?">
                Nei, men de er nære slektninger. MagSafe er Apples egen løsning, mens Qi2 er den
                åpne bransjestandarden som har hentet den magnetiske justeringen fra samme idé.
                En Qi2-lader fungerer med eldre Qi-enheter, men da uten magnetfesting og uten
                full hastighet.
              </FaqItem>
              <FaqItem question="Kan trådløs lading erstatte vanlige AA- og AAA-batterier?">
                Ikke i praksis. Trådløs strøm lader batterier – den fjerner dem ikke.
                Fjernkontroller, veggklokker, røykvarslere og leker kommer til å gå på
                utskiftbare celler i lang tid ennå, og de trenger fortsatt en fast plass hjemme
                og en tur til gjenvinningen når de er tomme.
              </FaqItem>
              <FaqItem question="Er det trygt å ha en ladeplate på nattbordet?">
                Feltene fra ladeplaten er svake og godt innenfor norske grenseverdier. Det
                viktigste hensynet er brannsikkerhet: bruk sertifisert utstyr, la platen ligge
                fritt og udekket på et ikke-brennbart underlag, og følg ladevettreglene fra DSB
                og Norsk brannvernforening.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg brukte batterier?">
                Alle butikker som selger batterier, er pliktige til å ta imot brukte batterier
                gratis – uansett merke og uansett om du kjøper noe nytt. I tillegg tar
                gjenvinningsstasjoner og miljøstasjoner imot dem. Løse litiumbatterier bør ha
                polene teipet før innlevering.
              </FaqItem>
            </div>

            {/* CTA */}
            <div style={{
              background: '#eee9de', border: '1px solid #ddd8ce', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', textAlign: 'center', margin: '0 0 40px',
            }}>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600,
                fontSize: 'clamp(20px,1.8vw,26px)', letterSpacing: '-0.01em',
                color: '#1a1d17', margin: '0 0 14px',
              }}>
                Orden i batteriene – uansett hvor trådløst hjemmet blir
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Tre farger. Tre rom. Én smart boks som gir deg full oversikt fra dag én, og som
                sørger for at brukte batterier faktisk når gjenvinningen.
              </p>
              <Link
                href="/produkter"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                  letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                  background: '#5e6a48', color: '#faf6ee', textDecoration: 'none',
                }}
              >
                Se alle produkter
              </Link>
            </div>

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les videre</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/hvordan-fungerer-batterier" style={extLink}>
                    Hvordan fungerer batterier? Slik blir kjemi til strøm
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                    Slik sorterer du batteriene riktig hjemme
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/vanlige-sporsmal" style={extLink}>
                    Vanlige spørsmål om aBoks
                  </Link>
                </BulletItem>
              </ul>
            </div>

            {/* Sources */}
            <div style={{ paddingTop: '28px', borderTop: '1px solid #ddd8ce' }}>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: '13px', color: '#1a1d17', margin: '0 0 14px',
              }}>
                Kilder og videre lesning
              </p>
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {SOURCES.map((s, i) => (
                  <li key={s.url} id={`kilde-${i + 1}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ flexShrink: 0, fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62', fontWeight: 700 }}>
                      {i + 1}.
                    </span>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6 }}>
                      {s.label} –{' '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                        {new URL(s.url).hostname.replace('www.', '')}
                      </a>
                    </span>
                  </li>
                ))}
              </ol>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'Trådløs strøm', 'Trådløs lading', 'Qi2', 'MagSafe', 'Induksjon',
                  'Elektromagnetisk induksjon', 'Energieffektivitet', 'Batterisikkerhet',
                  'Ladevettregler', 'Litiumbatterier', 'Smart hjem', 'Bærekraftig hjem',
                  'Batterioppbevaring',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
