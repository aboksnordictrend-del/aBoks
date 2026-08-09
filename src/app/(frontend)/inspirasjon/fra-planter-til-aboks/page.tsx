import type { Metadata } from 'next'
import Link from 'next/link'
import FraPlanterTilABoksImage from '@/components/FraPlanterTilABoksImage'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'fra-planter-til-aboks',
    title: 'Fra planter til aBoks – slik lages biobasert plast (PLA)',
    description:
      'Biobasert plast starter i en åker, ikke på en oljeplattform. Slik blir mais og sukkerrør til PLA – og hva det betyr for klima, hverdag og sortering i Norge.',
    ogDescription:
      'Komplett guide til biobasert plast og PLA: råstoff, produksjonsprosessen i seks trinn, klimafotavtrykk sammenlignet med fossil plast, fire vanlige misforståelser, stelleråd og riktig sortering i Norge. Med kilder fra Miljødirektoratet, Store norske leksikon og Sortere.no.',
  }),
  keywords: [
    'biobasert plast', 'PLA', 'bioplast',
    'bærekraftig design', 'materialvalg', 'sortering',
    'resirkulering', 'norsk design', 'sirkulær økonomi',
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

const COMPARE_ROWS: string[][] = [
  ['Råstoff', 'Fornybare, biologiske råvarer som mais, sukkerrør og sukkerbete', 'Primært fossile råvarer som olje og naturgass'],
  ['Resirkulert innhold', 'Nei – biobasert er ikke det samme som resirkulert', 'Varierer med produkt og produsent'],
  ['Varmetoleranse', 'Følsomt for høy varme', 'Varierer mellom plasttyper'],
  ['Stivhet', 'Relativt stivt og formstabilt', 'Varierer mellom plasttyper'],
  ['Overflate (PLA Matte)', 'Matt og tett', 'Ofte blank'],
  ['Sortering i Norge', 'Restavfall – mangler egen materialstrøm', 'Restavfall om det ikke er emballasje'],
]

const SOURCES = [
  { label: 'Miljødirektoratet – Nyttig å vite om biobasert og bionedbrytbar plast', url: 'https://www.miljodirektoratet.no/aktuelt/nyheter/2019/januar-2019/nyttig-a-vite-om-biobasert-og-bionedbrytbar-plast/' },
  { label: 'Miljødirektoratet – Sirkulær økonomi', url: 'https://www.miljodirektoratet.no/ansvarsomrader/avfall/sirkular-okonomi/' },
  { label: 'Store norske leksikon – Bioplast', url: 'https://snl.no/bioplast' },
  { label: 'Store norske leksikon – Fermentering', url: 'https://snl.no/fermentering' },
  { label: 'Sortere.no (LOOP) – sorteringsveileder for norske kommuner', url: 'https://sortere.no/' },
  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB)', url: 'https://www.dsb.no/' },
  { label: 'NORSIRK – Avfallsforskriften for batterier', url: 'https://norsirk.no/produsentansvar/lover-og-regler/om-avfallsforskriften-for-batterier/' },
  { label: 'Miljødirektoratet – Ny innsamlingsplikt av løse batterier blir 65 prosent', url: 'https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent' },
  { label: 'Regjeringen.no – Batteriforordningen', url: 'https://www.regjeringen.no/no/sub/eos-notatbasen/notatene/2021/jan/batteriforordningen/id2828700/' },
  { label: 'Statistisk sentralbyrå – Avfallsstatistikk', url: 'https://www.ssb.no/natur-og-miljo/avfall' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Fra planter til aBoks</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Materialer &amp; bærekraft
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Fra planter til aBoks: reisen til{' '}
              <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>biobasert plast</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Biobasert plast begynner et helt annet sted enn de fleste tror – ikke på en
              oljeplattform, men i en plante. Her følger vi råstoffet hele veien fra åkeren til en
              ferdig boks 3D-printet i Norge, og ser nærmere på hva materialvalget betyr i praksis:
              for bruken, for stellet og for sorteringen når produktet en dag er utslitt.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 7 min · Oppdatert august 2026
            </p>
          </header>

          {/* Hero */}
          <figure style={{ margin: '0 0 clamp(36px,4vw,48px)' }}>
            <FraPlanterTilABoksImage background="#efe6d3" />
            <figcaption style={{
              fontFamily: 'var(--font-manrope)', fontSize: '12px',
              color: '#7a756c', margin: '12px 0 0', textAlign: 'center',
            }}>
              Materialet i en aBoks starter som sukker i en plante. Foto: aBoks.
            </figcaption>
          </figure>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              De fleste av oss tenker sjelden på hva tingene rundt oss er laget av. En boks er en
              boks. Men i det øyeblikket du snur den opp ned og leser «biobasert PLA», åpner det
              seg en historie som strekker seg tilbake til fotosyntesen – og som sier ganske mye om
              hvordan vi bygger hjem i dag.
            </p>

            <p style={pStyle}>
              La oss ta det aller enkleste først, uten fagspråk:{' '}
              <strong>
                materialet i en aBoks er laget av fornybare, plantebaserte råvarer i stedet for
                olje.
              </strong>{' '}
              Det tekniske navnet på materialet er PLA – men du trenger ikke kunne kjemien for å
              forstå poenget. Råstoffet vokser.
            </p>

            <p style={pStyle}>
              Vi har fulgt materialet gjennom hele kjeden og samlet det du bør vite før du kjøper –
              og før du en dag kaster.
            </p>

            <h2 style={h2Style}>Hva biobasert plast egentlig er</h2>

            <p style={pStyle}>
              PLA er en biobasert plast, fremstilt av fornybare, plantebaserte råvarer.
            </p>

            <p style={pStyle}>
              Materialet i en aBoks heter PLA – polymelkesyre, eller polylaktid.{' '}
              <a href="https://snl.no/bioplast" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Store norske leksikon
              </a>{' '}
              forklarer at PLA fremstilles ved å polymerisere melkesyre, og at råstoffet gjerne er
              fermentert maisstivelse eller sukkerrør. Det er altså den samme grunnkjemien som gjør
              surdeigsbrød surt og sauerkraut holdbart, satt i system i industriell skala.
            </p>

            <p style={pStyle}>
              Én presisering før vi går videre, fordi begrepene blandes ofte:{' '}
              <strong>
                biobasert betyr at råstoffet har biologisk opprinnelse. Det betyr ikke at materialet
                er laget av resirkulert plast.
              </strong>{' '}
              Det er to helt forskjellige ting, og bare det ene sier noe om hvor karbonet i
              materialet kommer fra.
            </p>

            <h3 style={h3Style}>Biobasert er ikke det samme som nedbrytbar</h3>

            <p style={pStyle}>
              Dette er den viktigste – og mest oversette – nyansen i hele feltet. At noe er laget av
              planter, sier ingenting om hva som skjer med det etterpå. Biobasert plast kan være
              bionedbrytbar, men trenger ikke å være det, og de to egenskapene henger ikke
              automatisk sammen.
            </p>

            <p style={pStyle}>
              Miljødirektoratet er utvetydige på ett punkt: det finnes ingen holdepunkter for å si
              at bionedbrytbar plast brytes ned innen rimelig tid i et kaldt norsk klima – verken på
              land, i vann eller i hjemmekompost. Nedbrytning i laboratorium under kontrollerte
              forhold er én ting. En kald høstmåned på Østlandet er noe helt annet.
            </p>

            <p style={pStyle}>
              For et produkt som skal stå i hyllen i mange år, er dette faktisk en fordel. Vi{' '}
              <em>vil</em> ikke at en boks skal begynne å brytes ned mens den er i bruk.
            </p>

            <p style={pStyle}>
              Vær derfor tydelig med deg selv på dette punktet:{' '}
              <strong>
                en aBoks skal ikke kastes i naturen og skal ikke hjemmekomposteres.
              </strong>{' '}
              Vi bruker ikke «biologisk nedbrytbar» som et salgsargument, rett og slett fordi det
              ikke ville vært en ærlig beskrivelse av hvordan materialet oppfører seg i norsk klima.
            </p>

            <h2 style={h2Style}>Reisen fra åker til ferdig boks</h2>

            <p style={pStyle}>
              Veien fra plante til produkt er kortere enn mange forestiller seg. Hele kjeden kan
              oppsummeres i én linje:
            </p>

            <Callout label="Kjeden">
              <strong>
                Planter og fornybare råvarer → sukker → melkesyre → PLA → filament → 3D-printing i
                Norge → aBoks
              </strong>
            </Callout>

            <p style={pStyle}>Og her er de samme trinnene, litt nærmere:</p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Planten vokser.</strong> Mais, sukkerrør eller sukkerbete binder CO₂ fra
                lufta gjennom fotosyntesen og lagrer det som karbohydrat. Alt karbonet som senere
                havner i boksen din, er hentet ut av atmosfæren her.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Stivelsen blir sukker.</strong> Råstoffet renses og brytes ned til enkle
                sukkerarter – i praksis den samme prosessen som ligger bak sirup og glukose i
                næringsmiddelindustrien.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Fermentering.</strong> Melkesyrebakterier omdanner sukkeret til melkesyre.
                Dette er en av menneskehetens eldste teknologier, brukt i tusenvis av år til alt fra
                ost til rakfisk.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Melkesyre blir laktid.</strong> To melkesyremolekyler kobles sammen til en
                ringformet mellomform som er renere og lettere å arbeide med.
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>Polymerisering.</strong> Ringene åpnes og kjedes sammen til lange
                polymerkjeder. Resultatet er PLA – i denne sammenhengen den matte varianten, PLA
                Matte.
              </NumberedItem>
              <NumberedItem n={6}>
                <strong>3D-printing i Norge.</strong> PLA-materialet formes til filament som brukes
                i 3D-printing. aBoks{' '}
                <Link href="/produkter/aboks" style={extLink}>
                  designes og produseres lokalt i Norge
                </Link>
                , lag for lag, med fokus på presisjon, funksjonalitet og lang levetid.
              </NumberedItem>
            </ol>

            <p style={pStyle}>
              Det siste trinnet er verdt å dvele ved, for det er uvanlig. De fleste plastprodukter i
              norske hjem er masseprodusert i store serier langt unna. En aBoks bygges opp lag for
              lag på en printer, og produksjonen skjer i Norge. Det gir en kortere vei fra
              produksjon til kunde, og gjør det mulig å justere design og detaljer uten å bestille
              nye, kostbare former.
            </p>

            <p style={pStyle}>
              PLA er et relativt stivt materiale, og det egner seg godt til formstabile beholdere
              med presise rom og tydelige kanter. Til gjengjeld er det følsomt for varme – noe vi
              kommer tilbake til under stell.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Det mest bærekraftige produktet er sjelden det som brytes raskest ned. Det er det som
              må erstattes sjeldnest.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Et prinsipp som går igjen i skandinavisk designtradisjon
              </footer>
            </blockquote>

            <h2 style={h2Style}>Hvorfor materialvalget betyr noe</h2>

            <p style={pStyle}>
              Her er det på sin plass med litt edruelighet. Klimaregnskapet for plast er komplisert,
              og det finnes mye lettvint markedsføring i omløp – også fra aktører som selger
              biobaserte produkter.
            </p>

            <p style={pStyle}>
              Klimafotavtrykket til PLA avhenger blant annet av hvilket råstoff som brukes, hvor mye
              energi produksjonen krever, hvilken energimiks fabrikken har, hvordan produktet
              fremstilles, hvor langt det fraktes – og ikke minst hvor lenge det faktisk brukes.
              Livsløpsanalyser av PLA spriker betydelig mellom studier, avhengig av hvilke
              forutsetninger som legges til grunn og hvordan det biologiske karbonet regnes.
            </p>

            <p style={pStyle}>
              Derfor kommer vi ikke til å påstå at PLA uten videre er «bedre for klimaet». Det Store
              norske leksikon slår fast, er verdt å ta med seg: bioplast er ikke nødvendigvis mer
              miljøvennlig enn plast basert på petroleum. Det som er en etterprøvbar forskjell, er
              hvor råstoffet kommer fra.
            </p>

            <DataTable
              headers={['Egenskap', 'Biobasert PLA', 'Fossil plast (PP/ABS)']}
              rows={COMPARE_ROWS}
              caption="Forenklet oversikt over forskjeller i råstoff og egenskaper. Tabellen er ingen samlet miljøsammenligning – klimafotavtrykk avhenger av mange faktorer i hvert enkelt tilfelle."
            />

            <p style={pStyle}>
              Legg merke til den siste raden. Den overrasker mange, og den fortjener sitt eget
              avsnitt.
            </p>

            <h2 style={h2Style}>Fire vanlige misforståelser</h2>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>«Bioplast kan kastes i matavfallet.»</strong> Nei. Bioplast er uønsket i
                komposterings- og biogassanlegg, fordi den ikke tilfører næring og ikke lar seg
                skille fra vanlig plast i prosessen. Sjekk alltid{' '}
                <a href="https://sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  Sortere.no
                </a>{' '}
                for kommunen din.
              </BulletItem>
              <BulletItem>
                <strong>«Bioplast forsvinner hvis den havner i naturen.»</strong> Ufullstendig
                nedbrytning gir mikroplast, ikke frisk jord. Miljødirektoratet advarer eksplisitt
                mot denne antakelsen.
              </BulletItem>
              <BulletItem>
                <strong>«Bioplast er alltid 100 prosent plantebasert.»</strong> Mange bioplasttyper
                er delvis fossile. I mangel av presis merking tror forbrukere ofte noe annet.
              </BulletItem>
              <BulletItem>
                <strong>«Engangsprodukter er greie så lenge de er av bioplast.»</strong> Det norske
                forbudet mot engangsartikler som bestikk og sugerør gjelder <em>også</em> når de er
                laget av biobasert eller nedbrytbar plast.
              </BulletItem>
            </ul>

            <Callout label="Prinsipp" title="Laget for å brukes lenge">
              For aBoks er poenget med materialvalget ikke at produktet skal brytes raskt ned, men
              at det skal fungere godt og brukes lenge. Lang levetid og god funksjon er derfor en
              viktig del av hvordan vi tenker rundt materialer og design.
            </Callout>

            <h2 style={h2Style}>Slik tar du vare på et produkt i PLA</h2>

            <p style={pStyle}>
              Materialet fungerer godt ved normal innendørs bruk, men PLA er følsomt for høy varme.
              Noen enkle vaner holder produktet formstabilt over tid:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>Bruk produktet innendørs, ved vanlig romtemperatur.</BulletItem>
              <BulletItem>
                Ikke plasser boksen nær sterke varmekilder som panelovn, stekeovn eller kokeplate.
              </BulletItem>
              <BulletItem>
                Ikke la den ligge igjen i en svært varm bil, for eksempel i sommersol.
              </BulletItem>
              <BulletItem>Rengjør med en myk, fuktig klut. Ikke oppvaskmaskin.</BulletItem>
              <BulletItem>
                Unngå sterke kjemikalier og løsemidler på den matte overflaten.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              I praksis betyr dette lite. En boks som står ved TV-en, på hjemmekontoret eller i
              gangen lever et helt udramatisk liv. Se gjerne{' '}
              <Link href="/slik-fungerer-det" style={extLink}>
                hvordan aBoks fungerer i hverdagen
              </Link>{' '}
              for plassering og bruk.
            </p>

            <h2 style={h2Style}>Når boksen en dag er utslitt</h2>

            <p style={pStyle}>
              Norge mangler i dag infrastruktur for å behandle PLA som en egen materialstrøm, og
              materialet forringer kvaliteten dersom det blandes inn i vanlig plastgjenvinning.
              Derfor gjelder to enkle regler når et PLA-produkt har levd ferdig:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Tøm ut alt innhold først.</strong> Batterier skal aldri følge med i
                restavfallet – de leveres separat til butikk eller miljøstasjon.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Sorter selve boksen som restavfall.</strong> Plastgjenstander som ikke er
                emballasje hører hjemme der, ikke i posen for plastemballasje og aldri i
                matavfallet.
              </NumberedItem>
            </ol>

            <p style={pStyle}>
              Er du usikker, finner du alltid gjeldende råd for din kommune hos{' '}
              <a href="https://sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Sortere.no
              </a>
              , som driftes av LOOP.
            </p>

            <h2 style={h2Style}>Materialet er bare halve historien</h2>

            <p style={pStyle}>
              Et bærekraftig materiale gir liten gevinst hvis produktet løser feil problem. Derfor
              er den andre halvdelen av regnestykket like viktig: hva boksen faktisk hindrer.
            </p>

            <p style={pStyle}>
              Løse batterier på avveie er et reelt problem i norske hjem, og myndighetene har
              skjerpet kravene.{' '}
              <a
                href="https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent"
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={extLink}
              >
                Miljødirektoratet
              </a>{' '}
              hevet kravet til innsamlingsgrad for løse, bærbare batterier fra 30 til 65 prosent med
              virkning fra 1. januar 2024.{' '}
              <a
                href="https://www.regjeringen.no/no/sub/eos-notatbasen/notatene/2021/jan/batteriforordningen/id2828700/"
                target="_blank"
                rel="noopener noreferrer nofollow"
                style={extLink}
              >
                EUs batteriforordning
              </a>{' '}
              setter minimumskrav på 63 prosent i 2027 og 73 prosent i 2030. Begrunnelsen fra
              Miljødirektoratet er todelt: å hindre at batterier kommer på avveier, og å redusere
              kostnadene ved branner i avfallsinfrastrukturen.
            </p>

            <p style={pStyle}>
              Bak regelverket ligger noe helt konkret: et brukt AA-batteri som blir liggende løst i
              en skuff sammen med nøkler og mynter. Løse batterier bør ikke oppbevares sammen med
              metallgjenstander, fordi kontakt mellom polene og metall kan føre til kortslutning. Et
              fast, adskilt sted å legge dem{' '}
              <em>kan bidra til å redusere risikoen for kortslutning ved oppbevaring</em> – men det
              erstatter ikke gode rutiner, som å teipe polene på litiumbatterier og levere dem inn
              jevnlig.
            </p>

            <p style={pStyle}>
              Vi har skrevet mer om{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                hvordan du sorterer batteriene riktig hjemme
              </Link>{' '}
              og{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere dem inn
              </Link>
              .{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                DSB
              </a>{' '}
              har generelle råd om trygg håndtering av batterier i hjemmet.
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
              }}>Der materialet møter hverdagen</span>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(20px,1.8vw,26px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 16px',
              }}>
                3D-printet i Norge av biobasert PLA Matte
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                aBoks har tre adskilte rom: ett for nye AA-batterier, ett for nye AAA-batterier og
                ett eget rom for brukte batterier.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Kapasiteten er opptil 20 AA og 36 AAA, og automatisk mating gjør at neste batteri
                alltid ligger klart. Rommet for brukte batterier gjør det enklere å samle dem på ett
                sted frem til levering, adskilt fra løse metallgjenstander i skuffen.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Det er ikke oppsiktsvekkende teknologi. Det er bare et sted å legge fra seg noe som
                ellers blir liggende feil.
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

            <h2 style={h2Style}>Skandinavisk designtradisjon – og hvorfor matt er et valg</h2>

            <p style={pStyle}>
              Den matte overflaten er valgt både for uttrykket og for hvordan aBoks passer inn i
              hjemmet. Matte flater reflekterer mindre lys enn blanke, og gir et roligere, mer
              dempet inntrykk på en benk eller i en hylle.
            </p>

            <p style={pStyle}>
              Det samme gjelder fargevalget: olivengrønn, mørk blå, creme og sort er farger som ikke
              låser seg til én sesong. Nordisk designtradisjon har alltid handlet mindre om å
              imponere og mer om å vare – en tanke vi utdyper i artikkelen om{' '}
              <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                fremtidens bærekraftige hjem
              </Link>
              .
            </p>

            <p style={pStyle}>
              Og for den som vil ta det ett skritt videre: mindre svinn begynner ofte med bedre
              oversikt. Når du ser hva du har, kjøper du ikke fire nye pakker AAA du ikke trengte.
              Les gjerne også{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                hvordan du forlenger levetiden på batteriene
              </Link>{' '}
              og{' '}
              <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                fem grep for orden i skuffen
              </Link>
              .
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om biobasert plast
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Er biobasert plast alltid bedre for miljøet?">
                Ikke automatisk. Store norske leksikon påpeker at bioplast ikke nødvendigvis er mer
                miljøvennlig enn petroleumsbasert plast. Det avhenger av råstoff, energibruk i
                produksjonen, transport – og ikke minst hvor lenge produktet varer. Et kortlevd
                produkt i bioplast kan komme dårligere ut enn et langlevd produkt i fossil plast.
              </FaqItem>
              <FaqItem question="Kan jeg kompostere PLA hjemme?">
                Nei. Hjemmekompost kommer ikke opp i temperaturene som kreves, og Miljødirektoratet
                finner ingen holdepunkter for nedbrytning innen rimelig tid i norsk klima. Bioplast
                er dessuten uønsket i komposteringsanlegg fordi den forstyrrer prosessen.
              </FaqItem>
              <FaqItem question="Er PLA det samme som resirkulert plast?">
                Nei. Biobasert PLA og resirkulert plast er to forskjellige ting. Biobasert beskriver
                hvor råstoffet kommer fra – i dette tilfellet fornybare, plantebaserte råvarer.
                Resirkulert plast er materiale som er produsert av plast som allerede har vært
                brukt.
              </FaqItem>
              <FaqItem question="Hvor kaster jeg en aBoks som er ødelagt?">
                Tøm ut batteriene og lever dem separat til butikk eller miljøstasjon. Selve boksen
                sorteres som restavfall, ettersom den verken er emballasje eller kan behandles i
                dagens norske plaststrøm. Sjekk{' '}
                <a href="https://sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  Sortere.no
                </a>{' '}
                for lokale avvik.
              </FaqItem>
              <FaqItem question="Tåler PLA å stå på kjøkkenet?">
                Ja, med normal plassering. Unngå direkte kontakt med varme flater og plassering rett
                over ovn eller kokeplate. Vanlig romtemperatur og benkeplass er helt uproblematisk.
              </FaqItem>
              <FaqItem question="Hvorfor 3D-printing i stedet for vanlig masseproduksjon?">
                3D-printing gjør det mulig å produsere lokalt i Norge, lag for lag, uten å bestille
                store og kostbare støpeformer i utlandet. Det gir presisjon i detaljene og en
                kortere vei fra produksjon til kunde. Se{' '}
                <Link href="/produkter/aboks" style={extLink}>produktsiden</Link> for
                materialdetaljer.
              </FaqItem>
              <FaqItem question="Konkurrerer råstoffet med matproduksjon?">
                Det er en berettiget innvending, og et aktivt forskningsfelt. Bioplast utgjør
                fortsatt en svært liten andel av verdens samlede plastproduksjon, og utviklingen går
                mot økt bruk av rest- og avfallsråstoff fra jordbruk og hagebruk fremfor
                primæravlinger. Miljødirektoratets kunnskapsgrunnlag peker på nettopp dette
                potensialet.
              </FaqItem>
              <FaqItem question="Hvilke andre produkter finnes fra aBoks?">
                I tillegg til standardmodellen finnes aBoks Vegg, som kan monteres på vegg eller stå
                fritt på en hylle. Se{' '}
                <Link href="/produkter" style={extLink}>alle produkter</Link> eller{' '}
                <Link href="/vanlige-sporsmal" style={extLink}>vanlige spørsmål</Link> for detaljer
                om materiale, mål og levering.
              </FaqItem>
            </div>

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
                Et lite valg, et langt liv
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Materialet kommer fra en plante. Formen kommer fra norsk design. Nytten kommer av at
                batteriene endelig har et sted å høre hjemme.
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
                Se produktene
              </Link>
            </div>

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Relaterte artikler</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                    aBoks og fremtidens bærekraftige hjem
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                    Slik sorterer du batteriene riktig hjemme
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                    Hvorfor det lønner seg å levere inn brukte batterier
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et tryggere hjem
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
                  'Biobasert plast', 'PLA', 'Bioplast',
                  'Bærekraftig design', 'Materialvalg', 'Sortering',
                  'Resirkulering', 'Norsk design', 'Sirkulær økonomi',
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
