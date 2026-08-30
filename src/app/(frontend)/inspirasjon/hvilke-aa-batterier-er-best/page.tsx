import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'hvilke-aa-batterier-er-best',
    title: 'Hvilke AA-batterier er best? Guide til valg og oppbevaring',
    description:
      'Lurer du på hvilke AA-batterier er best? Se hva testene viser om alkalisk, litium og oppladbart, og lær hvordan du oppbevarer batteriene trygt hjemme.',
    ogDescription:
      'En grundig guide til hvilke AA-batterier som er best til ulike apparater – med resultater fra Forbrukerrådets tester, forskjellen på alkalisk, litium og oppladbare NiMH-batterier, samt praktiske råd om trygg oppbevaring og resirkulering i Norge.',
  }),
  keywords: [
    'AA-batterier', 'batteriguide', 'oppladbare batterier',
    'litiumbatterier', 'alkaliske batterier', 'NiMH',
    'batterioppbevaring', 'resirkulering',
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

function Callout({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 30px', background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px' }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        color: '#5e6a48', background: '#eee9de', padding: '5px 12px',
        borderRadius: '999px', marginBottom: '14px',
      }}>{label}</span>
      {title ? (
        <p style={{ ...h3Style, margin: '0 0 10px' }}>{title}</p>
      ) : null}
      <div style={{ ...pStyle, margin: 0 }}>{children}</div>
    </div>
  )
}

function DataTable({ headers, rows, caption }: { headers: string[]; rows: string[][]; caption: string }) {
  return (
    <>
      <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', minWidth: '560px',
          fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
          background: '#fff', borderRadius: '12px', overflow: 'hidden',
        }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} style={{
                  textAlign: 'left', padding: '13px 16px',
                  background: '#39402c', color: '#faf6ee',
                  fontWeight: 600, letterSpacing: '0.02em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[0]}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: '12px 16px',
                    borderBottom: i < rows.length - 1 ? '1px solid #ece8e1' : 'none',
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
        {caption}
      </p>
    </>
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

const TYPE_ROWS: string[][] = [
  ['Alkalisk (f.eks. Varta Longlife)', 'Fjernkontroller, klokker, røykvarslere', '7–12 år', 'Lav'],
  ['Litium (f.eks. Energizer Ultimate)', 'Kameraer, hodelykter, kaldt vær', 'Opptil 20 år', 'Høy'],
  ['Oppladbar NiMH', 'Hyppig bruk, leker, spillkontrollere', 'Måneder til 1 år per lading', 'Middels engangskostnad, lav på sikt'],
]

const SOURCES = [
  { label: 'Forbrukerrådet – test av engangsbatterier', url: 'https://www.forbrukerradet.no/siste-nytt/test-av-engangsbatterier/' },
  { label: 'DSB – Litiumbatterier, ofte stilte spørsmål', url: 'https://www.dsb.no/farlige-stoffer/transport-av-farlig-gods/veiledning/litiumbatterier---ofte-stilte-sporsmal/' },
  { label: 'NORSIRK – kildesortering av batterier', url: 'https://norsirk.no/kildesortering/batteri/' },
  { label: 'Miljødirektoratet – avfall og gjenvinning', url: 'https://www.miljodirektoratet.no/' },
  { label: 'Statistisk sentralbyrå – statistikk over farlig avfall', url: 'https://www.ssb.no/natur-og-miljo/avfall/statistikk/farlig-avfall' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvilke AA-batterier er best?</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Batteriguider
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvilke <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>AA-batterier</em> er best?
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              En praktisk guide til alkaliske, litium- og oppladbare AA-batterier – hva som faktisk
              lønner seg, og hvordan du oppbevarer dem trygt hjemme.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 7 min · Oppdatert august 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Hvilke <strong>AA-batterier</strong> er best, er et spørsmål de fleste av oss stiller
              oss i det øyeblikket fjernkontrollen slutter å virke eller barnas leketøy plutselig
              går i stå. Svaret er dessverre ikke ett enkelt merkenavn du kan huske utenat. Det
              beste AA-batteriet avhenger av hva du skal bruke det til, hvor ofte du bytter
              batterier, og om du er villig til å investere litt i forkant for å spare både penger
              og miljø i det lange løp. I denne guiden går vi gjennom forskjellene mellom
              alkaliske, litium- og oppladbare batterier, hva uavhengige tester faktisk viser, og
              hvordan du får orden på batteriskuffen slik at du aldri står uten strøm når det
              gjelder.
            </p>

            <p style={pStyle}>
              Som redaksjon har vi fulgt utviklingen i forbrukerelektronikk og bærekraftige
              husholdningsvaner i over to tiår, og få ting skaper like mye frustrasjon som et dødt
              batteri i feil øyeblikk. Godt nytt: med litt kunnskap om batterikjemi og noen enkle
              rutiner kan du både velge riktig og oppbevare batteriene dine på en måte som er
              trygg, ryddig og bærekraftig.
            </p>

            <h2 style={h2Style}>Alkalisk eller litium – hva er egentlig forskjellen?</h2>

            <p style={pStyle}>
              De fleste AA-batterier du finner i butikkhyllene er enten alkaliske eller
              litium-baserte engangsbatterier. Begge leverer den samme nominelle spenningen på 1,5
              volt, men kjemien innvendig gjør at de oppfører seg svært forskjellig under
              belastning. Alkaliske batterier bruker sink og mangandioksid, mens litiumbatterier
              (som Energizer Ultimate Lithium) benytter en litiumbasert kjemi som holder spenningen
              mer stabil selv når strømforbruket er høyt.
            </p>

            <h3 style={h3Style}>Når lønner litiumbatterier seg?</h3>

            <p style={pStyle}>
              I apparater med høyt strømforbruk – som kameraer, actionleker, hodelykter og trådløse
              tastatur med mye bruk – utmerker litiumbatterier seg. De tåler kulde langt bedre enn
              alkaliske batterier og har en lengre holdbarhet i skuffen, gjerne opptil 20 år ifølge
              produsentenes egne spesifikasjoner. Ulempen er prisen: litiumbatterier koster typisk
              tre til fire ganger så mye som alkaliske alternativer.
            </p>

            <h3 style={h3Style}>Når er alkaliske batterier riktig valg?</h3>

            <p style={pStyle}>
              Til apparater med lavt og jevnt strømforbruk, som veggur, røykvarslere eller
              fjernkontroller, er alkaliske batterier fortsatt et solid og rimelig valg. De har en
              holdbarhet på 7–12 år i lager før de begynner å tape kapasitet nevneverdig, noe som
              er mer enn nok for de fleste husholdningsformål.
            </p>

            <h2 style={h2Style}>Oppladbare AA-batterier: den smarteste langsiktige løsningen?</h2>

            <p style={pStyle}>
              Hvis du bruker mange batterier i året, er oppladbare NiMH-batterier ofte det som
              faktisk lønner seg mest – både økonomisk og miljømessig. De leverer normalt 1,2 volt,
              litt lavere enn engangsbatterienes 1,5 volt, men moderne apparater er som regel
              designet for å håndtere dette uten problemer. Som vi har gått grundigere gjennom i
              artikkelen om{' '}
              <Link href="/inspirasjon/oppladbare-eller-engangsbatterier" style={extLink}>
                oppladbare versus engangsbatterier
              </Link>
              , er det ikke batteriet alene som avgjør om oppladbart lønner seg – det er apparatet
              du putter det i.
            </p>

            <p style={pStyle}>
              Moderne lavt-selvutladende NiMH-batterier (ofte kalt «ready to use») beholder
              mesteparten av ladningen sin i måneder, i motsetning til eldre generasjoner som tømte
              seg selv raskt i skuffen. Det gjør dem langt mer praktiske for alt fra fjernkontroller
              til barneleker.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Det beste batteriet er ikke nødvendigvis det dyreste på hyllen – det er det som passer
              til apparatet du faktisk bruker det i, og som du har god oversikt over hjemme.
            </blockquote>

            <h2 style={h2Style}>Så hvilke AA-batterier er best? Resultater fra uavhengige tester</h2>

            <p style={pStyle}>
              Forbrukerrådet har testet en rekke engangsbatterier, og resultatene bekrefter mye av
              det vi ser i praksis. I deres siste test av AA-batterier kom Energizer Ultimate
              Lithium best ut med svært god ytelse under både høy og middels belastning, mens Varta
              Longlife Power ble kåret til beste alkaliske alternativ for pengene. Se hele testen
              hos{' '}
              <a href="https://www.forbrukerradet.no/siste-nytt/test-av-engangsbatterier/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Forbrukerrådet
              </a>
              .
            </p>

            <DataTable
              headers={['Batteritype', 'Best egnet til', 'Holdbarhet i lager', 'Pris']}
              rows={TYPE_ROWS}
              caption="Oversikt over de tre vanligste AA-batteritypene og hva de egner seg best til."
            />

            <p style={pStyle}>
              Konklusjonen er at det ikke finnes ett universelt «best» AA-batteri – men det finnes
              et batteri som er best for nettopp ditt behov. Kartlegg hvilke apparater som bruker
              mest strøm hjemme hos deg, og velg deretter kjemi ut fra det.
            </p>

            <h2 style={h2Style}>Trygg oppbevaring av AA-batterier hjemme</h2>

            <p style={pStyle}>
              Uansett hvilken type du velger, er trygg oppbevaring avgjørende. Ifølge norske
              brannvernmyndigheter kan feil håndtering av batterier – spesielt skadde eller
              sammenblandede batterier – utgjøre en reell brannrisiko.{' '}
              <a href="https://www.dsb.no/farlige-stoffer/transport-av-farlig-gods/veiledning/litiumbatterier---ofte-stilte-sporsmal/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              anbefaler blant annet å unngå å oppbevare skadde eller oppsvulmede batterier sammen
              med andre.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Skill nytt fra brukt:</strong> Ha et tydelig system som skiller ferske
                batterier fra tomme, slik at ingen forveksler dem.
              </BulletItem>
              <BulletItem>
                <strong>Teip polene på store batterier:</strong> Spesielt 9V-batterier og
                litiumceller bør ha teip over polene for å unngå kortslutning mot metall.
              </BulletItem>
              <BulletItem>
                <strong>Unngå fuktige og varme steder:</strong> Oppbevar batterier tørt og ved
                romtemperatur, ikke i fryseren.
              </BulletItem>
              <BulletItem>
                <strong>Bland ikke gamle og nye batterier</strong> i samme apparat – det øker
                risikoen for lekkasje.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Vil du gå enda dypere inn i emnet? Vi har skrevet detaljerte guider om både{' '}
              <Link href="/inspirasjon/oppbevare-batterier-trygt-hjemme" style={extLink}>
                hvordan du oppbevarer batterier trygt hjemme
              </Link>{' '}
              og{' '}
              <Link href="/inspirasjon/langtidsoppbevaring-oppladbare-batterier" style={extLink}>
                langtidsoppbevaring av oppladbare batterier
              </Link>
              , med konkrete tips om ladenivå og temperatur.
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
                Slik holder aBoks orden på batteriene dine
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                <Link href="/produkter/aboks" style={{ color: '#faf6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks
                </Link>{' '}
                er designet nettopp for denne typen praktiske utfordringer. Boksen, som er
                3D-printet i Norge av biobasert PLA, har egne rom for opptil 20 AA-batterier og 36
                AAA-batterier – pluss et eget rom for brukte batterier som venter på levering til
                gjenvinning. Dermed slipper du å blande nytt og brukt, og du unngår at batteriene
                kommer i kontakt med metall som kan gi kortslutning. Enten du satser på alkaliske,
                litium- eller oppladbare AA-batterier, gir en god oppbevaringsløsning deg full
                oversikt over hva du faktisk har hjemme – slik slipper du både unødvendige innkjøp
                og batteriskuffens evige kaos.
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
                  href="/slik-fungerer-det"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                    letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                    background: 'transparent', color: '#faf6ee', textDecoration: 'none',
                    border: '1px solid rgba(250,246,238,0.4)',
                  }}
                >
                  Slik fungerer det
                </Link>
              </div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9fb08f', margin: '16px 0 0' }}>
                Designet i Norge · fri frakt over kr 650
              </p>
            </div>

            <h2 style={h2Style}>Riktig kildesortering og resirkulering av AA-batterier</h2>

            <p style={pStyle}>
              Batterier inneholder stoffer som bly, kvikksølv og kadmium, som kan skade natur og
              helse dersom de havner i restavfallet. Ifølge{' '}
              <a href="https://norsirk.no/kildesortering/batteri/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Norsirk
              </a>{' '}
              skal alle batterier leveres til gjenvinning uavhengig av størrelse – tungmetallene kan
              gjenvinnes og brukes til å produsere nye batterier, noe som reduserer behovet for
              jomfruelig råmateriale. Du kan levere brukte AA-batterier gratis i butikker som selger
              batterier, eller på nærmeste gjenvinningsstasjon. Både{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Miljødirektoratet
              </a>{' '}
              og{' '}
              <a href="https://www.ssb.no/natur-og-miljo/avfall/statistikk/farlig-avfall" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Statistisk sentralbyrå
              </a>{' '}
              fører løpende statistikk over farlig avfall i Norge, og batterier inngår som en fast
              del av dette regnskapet.
            </p>

            <p style={pStyle}>
              Har du en fast plass hjemme for brukte batterier, blir det mye enklere å huske å
              faktisk levere dem videre – i stedet for at de blir liggende i en skuff i årevis.
            </p>

            <h2 style={h2Style}>Slik velger du riktig – en enkel sjekkliste</h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                Kartlegg hvilke apparater hjemme som bruker mest strøm, og vurder oppladbare
                batterier til disse.
              </NumberedItem>
              <NumberedItem n={2}>
                Behold alkaliske batterier til apparater med lavt og jevnt forbruk, som klokker og
                røykvarslere.
              </NumberedItem>
              <NumberedItem n={3}>
                Velg litiumbatterier når du trenger lang holdbarhet i lager eller bruk i kulde.
              </NumberedItem>
              <NumberedItem n={4}>
                Invester i en oppbevaringsløsning som skiller nytt fra brukt, og som holder polene
                unna metall.
              </NumberedItem>
              <NumberedItem n={5}>
                Lever brukte batterier til gjenvinning fortløpende, ikke bare når skuffen er full.
              </NumberedItem>
            </ol>

            <Callout label="Kort oppsummert" title="Det finnes ikke ett «best» AA-batteri">
              Litium vinner på ytelse i kulde og under høy belastning, alkalisk vinner på pris til
              lavt forbruk, og oppladbare NiMH vinner på totaløkonomi og miljø når batteriene byttes
              ofte. Velg kjemi ut fra apparatet – og sørg for at du har oversikt over hva du faktisk
              har liggende hjemme.
            </Callout>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om AA-batterier
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Er litiumbatterier alltid bedre enn alkaliske?">
                Ikke nødvendigvis. Litiumbatterier presterer bedre under høy belastning og i kulde,
                men koster betydelig mer. Til apparater med lavt strømforbruk, som fjernkontroller,
                gir alkaliske batterier like god praktisk ytelse for langt mindre penger.
              </FaqItem>
              <FaqItem question="Kan jeg bruke oppladbare NiMH-batterier i alt?">
                De fleste moderne apparater fungerer godt med NiMH-batterier, men noen eldre eller
                strømsensitive enheter kan reagere på den lavere spenningen (1,2V mot 1,5V). Sjekk
                gjerne apparatets bruksanvisning ved tvil.
              </FaqItem>
              <FaqItem question="Hvor lenge holder et AA-batteri i oppbevaring?">
                Alkaliske batterier holder normalt 7–12 år, mens litiumbatterier kan vare opptil 20
                år ifølge produsentenes spesifikasjoner. Oppladbare NiMH-batterier bør lades opp
                igjen etter noen måneder til et år i ubrukt tilstand, avhengig av
                selvutladingsraten.
              </FaqItem>
              <FaqItem question="Er det farlig å blande batterityper?">
                Ja, det anbefales ikke å blande gamle og nye batterier, eller ulike kjemityper, i
                samme apparat. Det kan føre til lekkasje eller redusert ytelse. Skadde eller
                oppsvulmede batterier bør dessuten oppbevares atskilt fra andre, jf. anbefalinger
                fra DSB.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg brukte AA-batterier?">
                Du kan levere batterier gratis i alle butikker som selger dem, eller på din lokale
                gjenvinningsstasjon. Se{' '}
                <a href="https://norsirk.no/kildesortering/batteri/slik-leverer-du-batteriene/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  Norsirks oversikt
                </a>{' '}
                for nærmeste innleveringspunkt.
              </FaqItem>
            </div>

            <p style={pStyle}>
              Uansett om du lander på alkalisk, litium eller oppladbart – det viktigste er at du
              velger bevisst ut fra hvordan du faktisk bruker batteriene dine, og at du har et
              system som gjør det enkelt å holde oversikt. Da slipper du både bortkastede penger,
              unødvendig avfall og det evige spørsmålet om hvor de gode batteriene egentlig ble av.
            </p>

            {/* CTA */}
            <div style={{
              background: '#eee9de', border: '1px solid #ddd8ce', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', textAlign: 'center', margin: '40px 0',
            }}>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600,
                fontSize: 'clamp(20px,1.8vw,26px)', letterSpacing: '-0.01em',
                color: '#1a1d17', margin: '0 0 14px',
              }}>
                Full oversikt over batteriene hjemme
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Tre rom for nye AA, nye AAA og brukte celler. Slik vet du alltid hvilke batterier du
                har – og hvilke som skal leveres til gjenvinning.
              </p>
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
            </div>

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Relaterte artikler</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/oppladbare-eller-engangsbatterier" style={extLink}>
                    Oppladbare eller engangsbatterier – hva lønner seg?
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva?
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/oppbevare-batterier-trygt-hjemme" style={extLink}>
                    Hvordan oppbevare batterier trygt hjemme?
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/langtidsoppbevaring-oppladbare-batterier" style={extLink}>
                    Langtidsoppbevaring av oppladbare batterier
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvor-levere-brukte-batterier" style={extLink}>
                    Hvor kan man levere brukte batterier?
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

              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6, margin: '0 0 20px' }}>
                Artikkelen er skrevet og kvalitetssikret av redaksjonen i aBoks.
              </p>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'AA-batterier', 'Batteriguide', 'Oppladbare batterier',
                  'Litiumbatterier', 'Batterioppbevaring', 'Resirkulering',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
