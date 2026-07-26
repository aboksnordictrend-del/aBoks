import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'oppladbare-eller-engangsbatterier',
    title: 'Oppladbare eller engangsbatterier? Slik regner du ut hva som lønner seg',
    description:
      'Oppladbare eller engangsbatterier? Se regnestykket som avgjør – break-even-punkt, hva lading koster i strøm, miljøregnskapet og hvor engangsbatterier fortsatt vinner.',
    ogDescription:
      'Komplett guide til valget mellom oppladbare og engangsbatterier i norske hjem. Konkret break-even-formel, femårs kostnadsoversikt, ladekostnad basert på SSBs strømpriser for 2026, livsløpsanalyse av miljøeffekten, tabell over hvilke apparater som passer til hva, fem myter og FAQ.',
  }),
  keywords: [
    'oppladbare batterier', 'engangsbatterier', 'NiMH', 'batteriøkonomi',
    'strømpris', 'bærekraftig hjem', 'batterigjenvinning', 'røykvarsler',
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

function Formula({ equation, note }: { equation: string; note: string }) {
  return (
    <div style={{
      margin: '32px 0', padding: '26px 30px', background: '#eee9de',
      border: '1px solid #ddd8ce', borderRadius: '16px', textAlign: 'center',
    }}>
      <span style={{
        display: 'block', fontFamily: 'var(--font-cormorant)', fontWeight: 600,
        fontSize: 'clamp(17px,1.5vw,22px)', lineHeight: 1.5, color: '#39402c',
      }}>{equation}</span>
      <span style={{
        display: 'block', fontFamily: 'var(--font-manrope)', fontSize: '13px',
        lineHeight: 1.7, color: '#6b6f63', marginTop: '12px',
      }}>{note}</span>
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

const COST_ROWS: string[][] = [
  ['Innkjøp første år', 'ca. 400 kr', 'ca. 620 kr (8 celler + lader)'],
  ['År 2–5', 'ca. 1 600 kr', '0–250 kr (evt. nye celler)'],
  ['Strøm til lading', '–', 'under 5 kr'],
  ['Batterier til gjenvinning', 'ca. 200 stk', '8–16 stk'],
  ['Totalt over fem år', 'ca. 2 000 kr', 'ca. 700–900 kr'],
]

const DEVICE_ROWS: string[][] = [
  ['Barneleker, hodelykt, blitz, radiostyrt', 'Høyt', 'Oppladbare NiMH – tjener seg raskt inn'],
  ['Spillkontroller, trådløst tastatur, mus', 'Middels', 'Oppladbare NiMH'],
  ['Fjernkontroll, veggur, termometer', 'Lavt', 'Alkaliske, eller NiMH med lav selvutlading'],
  ['Røykvarsler', 'Lavt, men kritisk', 'Alkalisk eller litium – aldri oppladbare'],
  ['Nødlykt, hytteutstyr, beredskapslager', 'Lagres over år', 'Litium engangs (lang holdbarhet, tåler kulde)'],
]

const SOURCES = [
  { label: 'Statistisk sentralbyrå (SSB) – elektrisitetspriser for husholdninger', url: 'https://www.ssb.no/energi-og-industri/energi/statistikk/elektrisitetspriser' },
  { label: 'Miljødirektoratet – ny innsamlingsplikt for løse batterier på 65 prosent', url: 'https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent' },
  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) – litiumbatterier, ofte stilte spørsmål', url: 'https://www.dsb.no/farlige-stoffer/transport-av-farlig-gods/veiledning/litiumbatterier---ofte-stilte-sporsmal/' },
  { label: 'The International Journal of Life Cycle Assessment – livsløpsanalyse av engangs- og oppladbare husholdningsbatterier', url: 'https://link.springer.com/article/10.1007/s11367-016-1134-5' },
  { label: 'Store norske leksikon – oppladbare batterier', url: 'https://snl.no/oppladbare_batterier' },
  { label: 'Norsk brannvernforening – røykvarsleren går ut på dato', url: 'https://brannvernforeningen.no/aktuelt/nyheter/visste-du-at-roykvarsleren-gar-ut-pa-dato' },
  { label: 'NORSIRK – retursystem for batterier og EE-avfall', url: 'https://www.norsirk.no/' },
  { label: 'Regjeringen.no – avfallspolitikk og produsentansvar', url: 'https://www.regjeringen.no/' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Oppladbare eller engangsbatterier?</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Bærekraft &amp; smart hverdag
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Oppladbare eller engangsbatterier? Slik regner du ut{' '}
              <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>hva som faktisk lønner seg</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Oppladbare eller engangsbatterier er et av de spørsmålene alle har en mening om,
              men få har regnet på. Her er tallene, formelen og de tre stedene i hjemmet der
              svaret snur.
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
              Spørsmålet om oppladbare eller engangsbatterier dukker opp omtrent hver gang en
              fjernkontroll dør midt i en film. Svaret du får avhenger av hvem du spør.
              Elektronikkentusiasten sverger til oppladbare. Naboen har prøvd det én gang på
              nittitallet og gitt opp. Miljøbevisste venner sier det er selvsagt. Og selgeren i
              butikken selger det som ligger nærmest kassa.
            </p>

            <p style={pStyle}>
              Sannheten er mer interessant, og litt mer nyansert:{' '}
              <strong>
                det er ikke batteriet som avgjør om oppladbart lønner seg. Det er apparatet du
                putter det i.
              </strong>{' '}
              To husholdninger kan gjøre nøyaktig samme innkjøp og ende opp med helt ulike
              regnestykker, avhengig av om cellene havner i en fjernkontroll eller i en barnehånd.
            </p>

            <p style={pStyle}>
              I denne guiden får du regnestykket du kan gjøre på ditt eget hjem – på under fem
              minutter, med tall fra 2026.
            </p>

            <h2 style={h2Style}>Kort fortalt: hvor grensen faktisk går</h2>

            <p style={pStyle}>Før vi går inn i tallene, her er konklusjonen i tre linjer:</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Apparater som tømmer batteriet raskt</strong> – leker, hodelykter,
                spillkontrollere, blitz – er der oppladbare batterier tjener seg inn på måneder.
              </BulletItem>
              <BulletItem>
                <strong>Apparater som trekker nesten ingenting</strong> – fjernkontroller,
                veggur, romtermometre – er der alkaliske engangsbatterier fortsatt holder stand,
                rett og slett fordi de varer i årevis.
              </BulletItem>
              <BulletItem>
                <strong>Røykvarslere</strong> står i en klasse for seg, og der er svaret
                entydig: aldri oppladbare. Mer om hvorfor lenger ned.
              </BulletItem>
            </ul>

            <p style={pStyle}>Alt annet er et regnestykke. La oss sette det opp.</p>

            <h2 style={h2Style}>Regnestykket: finn ditt eget break-even-punkt</h2>

            <p style={pStyle}>
              Break-even er punktet der de oppladbare batteriene har spart deg for like mye som
              de kostet. Etter det punktet er alt ren gevinst. Formelen er enkel nok til å gjøres
              på baksiden av en handleliste.
            </p>

            <Formula
              equation="Break-even (antall ladinger) = (pris på cellene + pris på lader) ÷ (pris per engangsbatteri × antall celler i settet)"
              note="Én «lading» betyr her at hele settet lades én gang – altså det du ellers ville brukt et helt sett engangsbatterier på."
            />

            <h3 style={h3Style}>Steg 1: Finn de faktiske prisene</h3>

            <p style={pStyle}>
              Norske priser i 2026 varierer mer enn folk tror, og det er verdt å bruke to
              minutter på å sjekke sine egne. Som utgangspunkt kan du regne med rundt 8–15
              kroner per alkalisk AA-batteri i vanlig dagligvare, og rundt 45–60 kroner per
              oppladbar NiMH-celle av god kvalitet. En brukbar lader med individuell
              cellekontroll ligger typisk på 300–500 kroner, og varer i mange år.
            </p>

            <h3 style={h3Style}>Steg 2: Sett tallene inn</h3>

            <p style={pStyle}>
              Et realistisk startsett – fire AA-celler til 55 kroner stykket pluss en lader til
              400 kroner – koster 620 kroner. Hvert engangsalternativ, altså fire alkaliske
              batterier til 10 kroner, koster 40 kroner. Da blir regnestykket:
            </p>

            <Formula
              equation="620 kr ÷ 40 kr = 15,5 ladinger"
              note="Etter cirka 16 ladinger har settet betalt for seg selv. Deretter koster hver «nye» batteripakke deg noen få øre."
            />

            <h3 style={h3Style}>Steg 3: Oversett ladinger til tid</h3>

            <p style={pStyle}>
              Her kommer poenget som avgjør alt. Seksten ladinger er ingenting i en kontroller
              som brukes daglig – det tar kanskje åtte måneder. I en fjernkontroll som skifter
              batteri hvert tredje år, tar de samme seksten syklusene nesten femti år. Cellene
              rekker å bli gamle lenge før de rekker å bli lønnsomme.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Regn ikke på batteriet. Regn på hvor ofte apparatet tømmer det. Det er den ene
              variabelen som flytter break-even fra åtte måneder til femti år.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                aBoks redaksjon
              </footer>
            </blockquote>

            <h2 style={h2Style}>Strømmen til lading koster nesten ingenting</h2>

            <p style={pStyle}>
              Dette er kanskje det mest overraskende tallet i hele regnestykket, og det er nesten
              alltid utelatt fra diskusjonen.
            </p>

            <p style={pStyle}>
              Et AA-batteri på 2000 mAh lagrer 2,4 wattimer. Med et normalt ladetap på rundt 30
              prosent trenger du cirka 3,4 wattimer fra veggen for å fylle det – altså 0,0034
              kilowattimer.{' '}
              <a href="https://www.ssb.no/energi-og-industri/energi/statistikk/elektrisitetspriser" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Statistisk sentralbyrå
              </a>{' '}
              oppga en gjennomsnittlig strømpris for norske husholdninger på 122 øre per
              kilowattime i første kvartal 2026, etter at støtte fra myndighetene er trukket fra.
            </p>

            <Callout label="Visste du at">
              Å lade ett AA-batteri koster omtrent <strong>0,4 øre</strong>. Å lade fire
              batterier hundre ganger koster under to kroner. Over hele levetiden til et sett
              oppladbare batterier utgjør strømmen mindre enn prisen på ett eneste
              engangsbatteri.
            </Callout>

            <p style={pStyle}>
              Med andre ord: strømkostnaden er så liten at den ikke påvirker konklusjonen i det
              hele tatt. Det som avgjør, er innkjøpsprisen og hvor mange runder du faktisk klarer
              å bruke cellene.
            </p>

            <h2 style={h2Style}>Fem år fram i tid: et realistisk husholdningsregnskap</h2>

            <p style={pStyle}>
              La oss se på en familie som bruker rundt 40 AA- og AAA-batterier i året – ikke
              uvanlig i et hjem med barn, kontrollere, lykter og litt for mange lyslenker.
            </p>

            <DataTable
              headers={['Post', 'Engangsbatterier', 'Oppladbare (NiMH)']}
              rows={COST_ROWS}
              caption="Femårskostnad for en husholdning med moderat batteriforbruk. Tallene er regneeksempler basert på norske priser i 2026."
            />

            <p style={pStyle}>
              Differansen er reell, men den forutsetter én ting: at cellene faktisk sirkulerer.
              Et sett oppladbare batterier som blir liggende halvladet i en skuff i tre år,
              sparer verken penger eller miljø. Det er her de fleste regnestykker på nett stopper
              – og der virkeligheten begynner.
            </p>

            <h2 style={h2Style}>Hvor lønner det seg – og hvor gjør det ikke det?</h2>

            <p style={pStyle}>
              Bruk denne oversikten som en rask sjekk gjennom hjemmet. Er du usikker på hvilken
              celletype som hører hjemme hvor, går vi grundigere gjennom det i guiden{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier passer til hva
              </Link>.
            </p>

            <DataTable
              headers={['Apparat', 'Strømtrekk', 'Anbefaling']}
              rows={DEVICE_ROWS}
              caption="Anbefaling etter hvor mye strøm apparatet trekker."
            />

            <h3 style={h3Style}>Hvorfor røykvarsleren er unntaket</h3>

            <p style={pStyle}>
              En røykvarsler skal varsle deg om at batteriet er lavt lenge før det er tomt.
              Alkaliske og litiumbatterier gir en jevn, gradvis spenningsnedgang som gir
              varsleren tid til å pipe i dagevis. NiMH-celler holder spenningen nesten flat helt
              til de faller brått – og da kan varslingsvinduet forsvinne på timer. Legg til at
              oppladbare celler taper ladning over tid av seg selv, og du sitter med et
              sikkerhetsprodukt du ikke kan stole på.{' '}
              <a href="https://brannvernforeningen.no/aktuelt/nyheter/visste-du-at-roykvarsleren-gar-ut-pa-dato" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Brannvernforeningen
              </a>{' '}
              og DSB anbefaler å teste varslerne og bytte batteri årlig, gjerne på
              Røykvarslerdagen 1. desember. Bruk engangsbatteriet der.
            </p>

            <h2 style={h2Style}>Miljøregnskapet er ikke automatisk i favør av oppladbare</h2>

            <p style={pStyle}>
              Her er innsikten som sjelden når fram til forbrukerne. En sammenlignende
              livsløpsanalyse publisert i{' '}
              <em>The International Journal of Life Cycle Assessment</em> så på alkaliske
              engangsbatterier opp mot oppladbare NiMH i AA- og AAA-format. Konklusjonen var
              tydelig på ett punkt og overraskende på et annet.
            </p>

            <p style={pStyle}>
              På avfallsmengde vinner oppladbare batterier stort, selv med få gjenbruk. Men på
              flere miljøindikatorer – forsuring, partikkelutslipp og human toksisitet – kan
              oppladbare batterier som brukes «ineffektivt», altså lades tjue ganger eller
              færre, faktisk komme dårligere ut enn engangsbatterier. Først ved rundt{' '}
              <strong>femti ladesykluser</strong> gir de en robust forbedring på tvers av alle
              indikatorene som ble målt.
            </p>

            <Callout label="Det praktiske poenget">
              Miljøgevinsten ligger ikke i selve kjøpet av oppladbare batterier. Den ligger i
              bruken. Et sett som lades to hundre ganger er et av de beste miljøvalgene du kan
              gjøre i hjemmet. Et sett som lades femten ganger og så forsvinner i en skuff, er et
              dårligere valg enn alkaliske batterier du faktisk leverer inn.
            </Callout>

            <p style={pStyle}>
              Det gjør organisering til et miljøtiltak, ikke bare et estetisk et. Og det gjør
              neste avsnitt til mer enn et sidespor.
            </p>

            <h2 style={h2Style}>Regnestykket du ikke kan gjøre uten oversikt</h2>

            <p style={pStyle}>
              Prøv en øvelse: hvor mange AA-batterier har du i huset akkurat nå? De fleste bommer
              kraftig. Undersøkelser fra flere europeiske land tyder på at husholdninger typisk
              har rundt hundre løse batterier liggende, mens folk selv gjetter på en tredjedel av
              det.
            </p>

            <p style={pStyle}>Konsekvensene er både økonomiske og praktiske:</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Du kjøper batterier du allerede har.</strong> Ny multipakke fordi du ikke
                fant de gamle.
              </BulletItem>
              <BulletItem>
                <strong>Fulle og tomme blandes.</strong> Halvbrukte celler kastes fordi ingen vet
                hvilke som er hvilke.
              </BulletItem>
              <BulletItem>
                <strong>Alkaliske batterier lekker.</strong> Glemte celler i en skuff kan ruste
                og lekke elektrolytt som ødelegger både apparatet og skuffen.
              </BulletItem>
              <BulletItem>
                <strong>Oppladbare celler blir aldri ladet.</strong> Og dermed aldri lønnsomme –
                verken for lommeboka eller klimaet.
              </BulletItem>
              <BulletItem>
                <strong>Brukte batterier når aldri gjenvinningen.</strong> De blir liggende, eller
                de havner i restavfallet der de utgjør en reell brannrisiko.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Løse batterier med eksponerte poler kan i verste fall kortslutte mot metall. Det er
              en av grunnene til at{' '}
              <a href="https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Miljødirektoratet
              </a>{' '}
              i 2024 skjerpet kravet til returselskapenes innsamlingsgrad for løse, bærbare
              batterier fra 30 til 65 prosent – nettopp for å hindre at batterier på avveie
              starter branner i avfallssystemet.
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
                Én boks, tre rom – og et regnestykke som går opp
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Skal du gå over til oppladbare batterier, er den vanligste feilen ikke feil
                batterivalg. Det er at systemet aldri blir et system. Uten et fast sted å legge
                de ladede cellene, og et eget sted for de brukte, forsvinner rutinen etter noen
                uker.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                <Link href="/produkter/aboks" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks
                </Link>{' '}
                er bygget for akkurat den rutinen: ett rom for nye AA, ett for nye AAA og ett
                eget rom for brukte celler som skal leveres til gjenvinning. Du ser på et blikk
                hva du har, hva som er ladet, og hva som skal ut av huset neste gang du er innom
                butikken. For dem som heller vil frigjøre benkeplass, gir{' '}
                <Link href="/produkter/aboks-vegg" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks Vegg
                </Link>{' '}
                samme oversikt montert på veggen.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Se{' '}
                <Link href="/slik-fungerer-det" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  slik fungerer aBoks
                </Link>{' '}
                eller{' '}
                <Link href="/produkter" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  alle produkter
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

            <h2 style={h2Style}>Fem seiglivede myter</h2>

            <h3 style={h3Style}>1. «Oppladbare batterier har memory-effekt»</h3>
            <p style={pStyle}>
              Det stemte for NiCd-batterier, som stort sett er ute av norske hjem. Moderne
              NiMH-celler har ikke memory-effekt i praktisk forstand. Du kan trygt lade dem
              halvtomme.
            </p>

            <h3 style={h3Style}>2. «1,2 volt er for lite»</h3>
            <p style={pStyle}>
              Alkaliske batterier oppgis med 1,5 volt, men det er startspenningen. Under bruk
              faller den jevnt mot 1,1 volt. NiMH-celler ligger stabilt rundt 1,2 volt gjennom
              nesten hele utladningen. I krevende apparater yter de derfor ofte bedre, ikke
              dårligere.
            </p>

            <h3 style={h3Style}>3. «Man kan lade opp vanlige engangsbatterier»</h3>
            <p style={pStyle}>
              Nei. Alkaliske batterier er ikke konstruert for det. Forsøk kan gi
              varmeutvikling, lekkasje av etsende elektrolytt og i verste fall sprekkdannelse.
              Det er verken trygt eller lønnsomt.
            </p>

            <h3 style={h3Style}>4. «Oppladbare tømmer seg i skuffen»</h3>
            <p style={pStyle}>
              Dette var et reelt problem før. Dagens celler med lav selvutlading, ofte merket
              «ready to use» eller «precharged», beholder store deler av kapasiteten i årevis.
              Ser du etter oppladbare til apparater som brukes sjelden, er det denne merkingen du
              skal lete etter.
            </p>

            <h3 style={h3Style}>5. «Det viktigste er hvilket merke du kjøper»</h3>
            <p style={pStyle}>
              Nordiske og danske forbrukertester har gjentatte ganger vist at billige alkaliske
              batterier presterer overraskende nær premiummerkene i apparater med jevnt, lavt
              strømtrekk. Forskjellen blir først tydelig ved høyt forbruk. Bruksmønsteret ditt
              betyr mer enn logoen på cellen.
            </p>

            <h2 style={h2Style}>Slik gjør du overgangen på en ettermiddag</h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Gå gjennom hjemmet og noter.</strong> Hvilke apparater tømmer batterier
                oftere enn to ganger i året? De står øverst på listen.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Kjøp riktig antall celler.</strong> Regn med minst det dobbelte av det
                apparatene rommer, slik at du alltid har et ladet sett klart mens det andre
                lader.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Velg en lader med individuell cellekontroll.</strong> Den lader hver
                celle for seg og stopper når den er full. Det forlenger levetiden merkbart
                sammenlignet med billige ladere som behandler alle cellene likt.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Behold alkaliske der de hører hjemme.</strong> Røykvarsler, veggur,
                nødlykt.
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>Gi cellene en fast plass.</strong> Ladet, brukt, klar. Uten dette
                skrittet forsvinner rutinen.
              </NumberedItem>
              <NumberedItem n={6}>
                <strong>Lever de gamle inn.</strong> Teip polene på brukte litiumceller og lever
                dem der du kjøper nye. Vi har samlet rådene i guiden om{' '}
                <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                  hvorfor det lønner seg å levere inn brukte batterier
                </Link>
                .
              </NumberedItem>
            </ol>

            <p style={pStyle}>
              Vil du presse enda mer ut av cellene du allerede har, finner du de konkrete grepene
              i artikkelen om{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                hvordan du forlenger levetiden på batteriene
              </Link>
              . Og skal skuffen ryddes samtidig, gir{' '}
              <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                fem tips for orden i skuffen
              </Link>{' '}
              deg en god start.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvor mange ganger kan et oppladbart AA-batteri lades?">
                Vanlige NiMH-celler tåler typisk mellom 500 og 1 000 ladesykluser. Celler med høy
                kapasitet, over 2 100 mAh, har som regel færre sykluser – ofte 500 til 800 –
                fordi kapasitet og syklustall går i motsatt retning. I praksis begrenses
                levetiden like ofte av alder og lagringsforhold som av antall ladinger.
              </FaqItem>
              <FaqItem question="Hvor mye koster det i strøm å lade batterier hjemme?">
                Nesten ingenting. Ett AA-batteri koster rundt 0,4 øre å lade med norske
                strømpriser fra 2026. Selv om du lader fire celler ukentlig i fem år, havner den
                samlede strømkostnaden på under 10 kroner. Strøm er aldri argumentet mot
                oppladbare batterier.
              </FaqItem>
              <FaqItem question="Kan jeg bruke oppladbare batterier i røykvarsleren?">
                Nei. Bruk alkaliske eller litiumbatterier. NiMH-celler taper ladning over tid og
                faller brått i spenning på slutten, noe som kan gjøre varslerens lavbatterisignal
                upålitelig. Test varsleren og bytt batteri årlig – 1. desember er en enkel dato å
                huske.
              </FaqItem>
              <FaqItem question="Er oppladbare batterier alltid best for miljøet?">
                Ikke automatisk. Livsløpsanalyser viser at gevinsten avhenger sterkt av hvor
                mange ganger cellene faktisk lades. Ved tjue sykluser eller færre kan oppladbare
                komme dårligere ut på enkelte miljøindikatorer, mens rundt femti sykluser gir en
                tydelig forbedring på tvers av nesten alle. Bruk dem ofte, og bruk dem lenge.
              </FaqItem>
              <FaqItem question="Hva gjør jeg med oppladbare batterier som er utslitt?">
                De skal leveres til gjenvinning på samme måte som engangsbatterier – i butikk som
                selger batterier, eller på kommunal miljøstasjon. Oppladbare celler inneholder
                metaller som kan gjenvinnes og brukes i nye produkter, og de skal aldri i
                restavfallet.{' '}
                <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                  Slik sorterer du batteriene riktig hjemme
                </Link>{' '}
                gir deg rutinen.
              </FaqItem>
              <FaqItem question="Lønner det seg å blande oppladbare og alkaliske i samme apparat?">
                Nei, og det gjelder også blanding av gamle og nye celler av samme type. Ulik
                spenning og kapasitet gjør at den svakeste cellen tømmes først og kan bli
                dyputladet av de andre. Det gir dårligere ytelse, kortere levetid og økt risiko
                for lekkasje. Bytt alltid hele settet samtidig.
              </FaqItem>
              <FaqItem question="Hvor mange oppladbare celler bør en vanlig husholdning ha?">
                En god tommelfingerregel er åtte AA og åtte AAA for en gjennomsnittlig familie.
                Det gir ett sett i bruk og ett ladet sett i reserve for de vanligste apparatene,
                uten at cellene blir liggende ubrukt så lenge at de mister verdi.
              </FaqItem>
            </div>

            <h2 style={h2Style}>Konklusjonen</h2>

            <p style={pStyle}>
              Oppladbare eller engangsbatterier er ikke et spørsmål med ett svar, men med en
              formel. For apparatene som spiser batterier, er oppladbare celler et opplagt valg –
              de tjener seg inn på under et år, kutter avfallet dramatisk, og strømmen de bruker
              er en avrundingsfeil i husholdningsbudsjettet. For apparatene som knapt trekker
              strøm, er alkaliske batterier fortsatt et fornuftig og trygt valg.
            </p>

            <p style={pStyle}>
              Det viktigste er ikke å velge riktig én gang, men å bygge en rutine som holder. Når
              hvert batteri har sin plass – ladet, brukt, klart – blir regnestykket noe du faktisk
              kan gjøre. Og da går det nesten alltid i din favør.
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
                Klar for orden i batteriene?
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Tre rom, full oversikt og en fast plass for de brukte cellene. Slik blir riktig
                batterivalg til en vane som varer.
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
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les videre</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva? Den komplette guiden for hjemmet
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvordan-fungerer-batterier" style={extLink}>
                    Hvordan fungerer batterier? Slik blir kjemi til strøm
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et ryddigere og tryggere hjem
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
                  'Oppladbare batterier', 'Engangsbatterier', 'NiMH', 'Batteriøkonomi',
                  'Strømpris', 'Bærekraftig hjem', 'Batterigjenvinning', 'Røykvarsler',
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
