import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'hvordan-fungerer-batterier',
    title: 'Hvordan fungerer batterier? Slik blir kjemi til strøm',
    description:
      'Hvordan fungerer batterier egentlig? Vi forklarer anode, katode og elektrolytt enkelt – og hva det betyr for trygg oppbevaring og riktig gjenvinning hjemme.',
    ogDescription:
      'Komplett guide til hvordan batterier fungerer: elektrokjemien bak AA- og AAA-celler, forskjellen på alkalisk, litium, NiMH og litium-ion, hvorfor batterier lekker og går tomme, sikker oppbevaring av brukte batterier og norske regler for innsamling og gjenvinning.',
  }),
  keywords: [
    'hvordan fungerer batterier', 'batterikjemi', 'alkaliske batterier',
    'litiumbatterier', 'AA-batterier', 'AAA-batterier', 'batterisikkerhet',
    'batterigjenvinning', 'oppbevaring av batterier', 'bærekraftig hjem',
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

const BATTERY_ROWS: string[][] = [
  ['Alkalisk AA/AAA', 'Sink + mangandioksid, kaliumhydroksid', '1,5 V', 'Fjernkontroll, klokke, lommelykt, leker', 'Nei'],
  ['Litium AA/AAA (primær)', 'Litium + jerndisulfid', '1,5 V', 'Kamera, utstyr i kulde, røykvarsler', 'Nei'],
  ['NiMH', 'Nikkelmetallhydrid', '1,2 V', 'Enheter med høyt forbruk, daglig bruk', 'Ja'],
  ['Litium-ion', 'Karbonanode + litiumoksidkatode', '3,6–3,7 V', 'Telefon, verktøy, elsykkel, elsparkesykkel', 'Ja'],
  ['Knappcelle (CR)', 'Litium + mangandioksid', '3 V', 'Bilnøkkel, vekt, hodeplagg-lys', 'Nei'],
]

const SOURCES = [
  { label: 'Kjemisk institutt, Universitetet i Oslo – Hvordan fungerer et batteri?', url: 'https://www.mn.uio.no/kjemi/forskning/fakta/batterier/artikler/batteriprinsipp.html' },
  { label: 'Kjemisk institutt, Universitetet i Oslo – Alkaliske batterier', url: 'https://www.mn.uio.no/kjemi/forskning/tema/batterier/artikler/alkaliske-batterier.html' },
  { label: 'Store norske leksikon – Batteri', url: 'https://snl.no/batteri' },
  { label: 'DSB – Råd og veiledning om litiumionbatterier og elsparkesykler', url: 'https://www.dsb.no/brannsikkerhet/brannforebygging/rad-og-veiledning-om-elsparkesykler/' },
  { label: 'Miljødirektoratet – Ny innsamlingsplikt for løse batterier', url: 'https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent' },
  { label: 'Lovdata – Avfallsforskriften kapittel 3, kasserte batterier', url: 'https://lovdata.no/forskrift/2004-06-01-930/KAPITTEL_3' },
  { label: 'NORSIRK – Om avfallsforskriften for batterier', url: 'https://norsirk.no/produsentansvar/lover-og-regler/om-avfallsforskriften-for-batterier/' },
  { label: 'SSB – Natur og miljø', url: 'https://www.ssb.no/natur-og-miljo' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvordan fungerer batterier?</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Kunnskap &amp; hverdag
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvordan fungerer <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>batterier?</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Et lite sølvfarget rør driver fjernkontrollen, veggklokka og barnas leker –
              men hva skjer egentlig inni? Her er den forståelige forklaringen, og hva den
              betyr for hvordan du oppbevarer og leverer batteriene dine.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 7 min · Juli 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Hvordan fungerer batterier? Spørsmålet dukker gjerne opp i det øyeblikket
              fjernkontrollen slutter å svare, og de fleste av oss nøyer seg med et vagt
              svar om at «det er noe med strøm». Sannheten er både enklere og mer elegant:
              et batteri er et kjemisk kraftverk i miniatyr, der en reaksjon som ellers
              ville skjedd på et blunk, tvinges til å gå sakte – og til å sende energien
              sin gjennom apparatet ditt på veien.
            </p>

            <p style={pStyle}>
              Å forstå prinsippet tar fem minutter. Gevinsten varer lenger: du kjøper
              riktigere, du oppbevarer tryggere, du kaster mindre, og du skjønner hvorfor
              et «tomt» batteri fortsatt kan være i stand til å starte en brann.
            </p>

            <h2 style={h2Style}>Tre deler, én reaksjon</h2>

            <p style={pStyle}>
              Alle batterier – fra AAA-cellen i veggklokka til pakken i en elbil – er
              bygget over samme lest. De består av en <strong>anode</strong>, en{' '}
              <strong>katode</strong> og en <strong>elektrolytt</strong> mellom dem, som
              beskrevet av Kjemisk institutt ved Universitetet i Oslo.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Anoden</strong> er laget av et materiale som gjerne gir fra seg
                elektroner. I vanlige AA- og AAA-batterier er dette sink, ofte i
                pulverform.
              </BulletItem>
              <BulletItem>
                <strong>Katoden</strong> består av et materiale som villig tar imot
                elektroner. I alkaliske batterier er mangandioksid arbeidshesten.
              </BulletItem>
              <BulletItem>
                <strong>Elektrolytten</strong> er en væske eller gelé som leder ioner, men
                ikke elektroner. I alkaliske batterier er den en sterkt basisk
                kaliumhydroksidløsning – det er derfor de heter «alkaliske».
              </BulletItem>
            </ul>

            <h3 style={h3Style}>Hvorfor elektronene må ta omveien</h3>

            <p style={pStyle}>
              Blander du anodemateriale og katodemateriale direkte, skjer reaksjonen
              umiddelbart og utvikler varme. Det er ikke et batteri – det er en liten
              brann. Batteriets geni ligger i å holde de to fra hverandre og fjerne én
              bestemt mulighet: elektronene får ikke lov til å ta snarveien.
            </p>

            <p style={pStyle}>
              Reaksjonen er en redoksreaksjon, og for at den skal kunne gå, må ladningene
              bevege seg. Ionene reiser gjennom elektrolytten inne i batteriet. Elektronene
              må ta den lange veien – ut gjennom minuspolen, gjennom ledningen, gjennom
              lyspæra eller motoren eller høyttaleren, og inn igjen på plusspolen. Det er
              nettopp på denne omveien at vi kan hente ut arbeid. Kobler du ikke batteriet
              til noe, står køen stille, og reaksjonen venter tålmodig.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Et batteri lagrer ikke strøm slik en bøtte lagrer vann. Det lagrer et kjemisk
              potensial – en vilje til å reagere – og lar oss ta betalt i elektroner for å
              slippe reaksjonen fri.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Grunnprinsippet bak enhver battericelle
              </footer>
            </blockquote>

            <h2 style={h2Style}>Fra Voltas søyle til stuebordet</h2>

            <p style={pStyle}>
              Prinsippet er over to hundre år gammelt. Den italienske fysikeren Alessandro
              Volta konstruerte rundt år 1800 den første elektrokjemiske cellen: vekselvis
              plater av kobber og sink, skilt av papp fuktet med elektrolytt. Volta ga navn
              til både voltasøylen og måleenheten vi bruker den dag i dag.
            </p>

            <p style={pStyle}>
              Det som har endret seg siden, er ikke prinsippet, men materialene. Kvikksølv,
              som tidligere ble tilsatt for å bremse uønskede sidereaksjoner som
              hydrogengassdannelse, er faset ut av vanlige husholdningsbatterier. I stedet
              brukes svært rene materialer – dyrere å produsere, men langt bedre for både
              helse og natur.
            </p>

            <h2 style={h2Style}>Hvorfor batteritypene oppfører seg forskjellig</h2>

            <p style={pStyle}>
              Ulike materialkombinasjoner gir ulik spenning, ulik levetid og ulike
              bruksområder. Det er derfor et NiMH-batteri viser 1,2 volt uten å være
              «halvtomt», og derfor et litiumbatteri klarer seg der det alkaliske gir opp.
            </p>

            {/* Batteritype-tabell */}
            <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', minWidth: '640px',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Type', 'Kjemi', 'Spenning', 'Typisk bruk', 'Oppladbart'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '13px 16px',
                        background: '#39402c', color: '#faf6ee',
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BATTERY_ROWS.map((row, i) => (
                    <tr key={row[0]}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < BATTERY_ROWS.length - 1 ? '1px solid #ece8e1' : 'none',
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
              Oversikt over de vanligste batteritypene i norske hjem. Kapasitet og levetid
              varierer med merke, temperatur og bruksmønster.
            </p>

            <p style={pStyle}>
              Vil du gå dypere i hvilken celle som hører hjemme hvor, har vi samlet det i
              guiden om{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>.
            </p>

            <h2 style={h2Style}>Hvorfor blir batteriet tomt – også i skuffen?</h2>

            <p style={pStyle}>
              Et batteri går tomt fordi materialene brukes opp. Sinken oksideres,
              mangandioksiden reduseres, og til slutt er det ikke mer å hente. Men to ting
              overrasker mange.
            </p>

            <h3 style={h3Style}>1. Enheten gir opp før batteriet er tomt</h3>

            <p style={pStyle}>
              Spenningen i et ferskt alkalisk batteri ligger mellom 1,5 og 1,65 volt, og
              den faller jevnt gjennom bruken. Mange elektroniske apparater slutter å
              fungere når spenningen kryper under en viss grense – selv om det fortsatt
              finnes kjemisk energi igjen. Derfor kan et batteri som «ikke virker» i det
              digitale kameraet, fint drive veggklokka i mange måneder til. Å flytte
              batterier nedover i næringskjeden er et av de mest undervurderte
              sparetipsene, og noe vi utdyper i artikkelen om{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                hvordan du forlenger levetiden på batteriene
              </Link>.
            </p>

            <h3 style={h3Style}>2. Selvutlading og kulde</h3>

            <p style={pStyle}>
              Selv uten bruk pågår små sidereaksjoner inne i cellen. Alkaliske batterier
              taper derfor litt kapasitet i året, og varme akselererer prosessen.
              Anbefalingen er enkel: oppbevar batteriene tørt og ved vanlig romtemperatur,
              unna sollys, panelovner og fuktige kjellerhyller.
            </p>

            <p style={pStyle}>
              Kulde virker motsatt vei, men gir samme frustrasjon. I kaldt vær går de
              kjemiske reaksjonene tregere, og batteriet klarer ikke å levere like mye
              strøm. Lommelykta i bilen om vinteren lyser svakt – ikke nødvendigvis fordi
              batteriene er utbrukt, men fordi de er kalde. La dem få romtemperatur før du
              dømmer dem.
            </p>

            <Callout label="Derfor lekker batterier">
              <p style={{ ...pStyle, margin: '0 0 14px' }}>
                Når et batteri står lenge i en enhet som ikke brukes, eller når det nærmer
                seg helt utladet, kan den basiske elektrolytten etse seg gjennom
                kapslingen. Resultatet er det hvite, krystallinske belegget vi kjenner
                igjen fra glemte leker. Tre grep reduserer risikoen betraktelig:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>Ta batteriene ut av utstyr som skal stå ubrukt i flere uker.</BulletItem>
                <BulletItem>Bytt alle batteriene i en enhet samtidig – ikke bland gamle og nye, og ikke bland typer.</BulletItem>
                <BulletItem>Oppbevar løse batterier i sitt eget rom, adskilt fra mynter, nøkler og binders.</BulletItem>
              </ul>
            </Callout>

            <h2 style={h2Style}>Et brukt batteri er sjelden helt tomt</h2>

            <p style={pStyle}>
              Dette er kunnskapen som betyr mest for sikkerheten hjemme. Et batteri du
              regner som ferdig, har som regel restenergi igjen. Legger du flere slike løst
              i en skuff sammen med metallgjenstander, kan polene komme i kontakt og
              kortslutte. Da utvikles varme – og i verste fall antennelse.
            </p>

            <p style={pStyle}>
              Risikoen er størst for litiumbaserte celler.{' '}
              <a href="https://www.dsb.no/brannsikkerhet/brannforebygging/rad-og-veiledning-om-elsparkesykler/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              beskriver hvordan branner i litiumionbatterier kan utvikle seg svært raskt,
              med kraftig varmeutvikling og giftige gasser, og hvordan de er vanskelige å
              slokke med vanlig slokkeutstyr. Utviklingen i statistikken understreker
              alvoret: mens brann- og redningsvesenet i 2016 rykket ut én gang til
              hendelser knyttet til batterier i elsparkesykler, elsykler og lignende
              småkjøretøy, var tallet i 2025 oppe i 82.
            </p>

            <p style={pStyle}>
              De fleste av oss har ikke et elkjøretøy i gangen, men vi har knappceller,
              verktøybatterier og en håndfull brukte AA-er som venter på å bli levert.
              Løsningen er den samme, og den er lavterskel:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>Tape over polene på litium- og knappcellebatterier med et lite stykke teip.</NumberedItem>
              <NumberedItem n={2}>Hold brukte batterier atskilt fra nye, slik at de ikke havner tilbake i omløp.</NumberedItem>
              <NumberedItem n={3}>Oppbevar dem tørt, i et rom hvor de ikke kan komme i kontakt med løst metall.</NumberedItem>
              <NumberedItem n={4}>Lever inn jevnlig – ikke når skuffen er full, men når du likevel er innom butikken.</NumberedItem>
            </ol>

            <p style={pStyle}>
              Knappceller fortjener en ekstra bemerkning: de er små, blanke og farlige å
              svelge for små barn. De hører hjemme utenfor rekkevidde, ikke i en åpen skål
              på kjøkkenbenken.
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
                Når kunnskapen skal bli hverdag
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Det er lett å være enig i prinsippene og likevel ende opp med batterier på
                tvers i skuffen.{' '}
                <Link href="/produkter/aboks" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks
                </Link>{' '}
                er laget for å løse akkurat det: tre adskilte rom gir nye AA-batterier, nye
                AAA-batterier og de brukte hver sin faste plass. Du ser hva du har igjen,
                du unngår å blande fulle og tomme celler, og de brukte ligger samlet – klare
                til å bli levert i stedet for å bli liggende.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Skal du frigjøre benkeplass, finnes samme løsning som{' '}
                <Link href="/produkter/aboks-vegg" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks Vegg
                </Link>
                , som kan monteres på veggen eller stå fritt på en hylle.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
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
                  Slik fungerer aBoks
                </Link>
              </div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9fb08f', margin: '16px 0 0' }}>
                Designet i Norge · fri frakt over kr 650
              </p>
            </div>

            <h2 style={h2Style}>Hva skjer etter at batteriet er tomt?</h2>

            <p style={pStyle}>
              Et batteri er ikke søppel – det er råvarer i feil emballasje. Sink fra
              alkaliske småbatterier gjenvinnes blant annet til korrosjonsbeskyttelse på
              stål og til pigment i maling, mens bly og kadmium fra andre batterityper går
              tilbake i produksjon av nye batterier. Jo mer vi samler inn, desto mindre
              jomfruelig materiale må hentes ut av bakken.
            </p>

            <p style={pStyle}>
              I Norge er ansvaret regulert i{' '}
              <a href="https://lovdata.no/forskrift/2004-06-01-930/KAPITTEL_3" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                avfallsforskriftens kapittel 3
              </a>. Produsenter og importører må være medlem i et returselskap godkjent av{' '}
              <a href="https://www.miljodirektoratet.no/ansvarsomrader/avfall/avfallstyper/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Miljødirektoratet
              </a>
              , og forhandlere som selger batterier har plikt til å ta imot brukte
              batterier gratis. Fra 1. januar 2024 ble kravet til innsamlingsgrad for løse,
              bærbare batterier hevet fra 30 til 65 prosent av medlemmenes samlede import
              og produksjon. Til sammenligning stiller EUs batteriforordning krav om 63
              prosent i 2027 og 73 prosent i 2030 – ambisjonene skjerpes, og det siste
              stykket må hentes hjemme hos oss.
            </p>

            <p style={pStyle}>
              Vil du vite nøyaktig hvor batteriene dine kan leveres og hva som skjer med dem
              videre, går vi gjennom det i artikkelen om{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>.
            </p>

            <h2 style={h2Style}>Fem grep som følger av kjemien</h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Kjøp riktig type til riktig oppgave.</strong> Litium til kulde og
                høyt forbruk, alkalisk til lavt og jevnt forbruk, NiMH til det som tømmes
                ofte.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Bytt hele settet samtidig.</strong> Et svakt batteri i serie tvinger
                de andre til å jobbe hardere, og øker risikoen for lekkasje.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Gi batteriene romtemperatur og tørre omgivelser.</strong>{' '}
                Kjøleskapet er unødvendig, og kondens er en reell ulempe.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Hold nye og brukte fysisk adskilt.</strong> Det er den eneste måten
                å slippe testrunden i skuffen på.
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>Gjør innlevering til en rutine, ikke et prosjekt.</strong> Ett fast
                rom hjemme, én fast handlepose-vane.
              </NumberedItem>
            </ol>

            <p style={pStyle}>
              Vil du ta det videre til hele hjemmet, finner du flere praktiske grep i
              artikkelen om{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                å sortere batteriene riktig hjemme
              </Link>{' '}
              og i vårt perspektiv på{' '}
              <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                fremtidens bærekraftige hjem
              </Link>.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvorfor er de fleste batterier akkurat 1,5 volt?">
                Spenningen bestemmes av kombinasjonen av materialer i anoden og katoden.
                Sink og mangandioksid gir omtrent 1,5 volt per celle, og fordi denne kjemien
                har vært standard i over hundre år, er apparatene våre bygget rundt den. Et
                NiMH-batteri gir 1,2 volt fordi nikkelmetallhydrid har en annen
                materialkombinasjon – det er fullt normalt, ikke et tegn på svakhet.
              </FaqItem>
              <FaqItem question="Bør jeg oppbevare batterier i kjøleskapet?">
                Nei. Rådet stammer fra en tid da batterier hadde høyere selvutlading.
                Moderne alkaliske batterier holder seg godt i årevis ved vanlig
                romtemperatur, og kjøleskapet introduserer et nytt problem: kondens, som kan
                korrodere polene. Et tørt skap eller en lukket boks i stua eller på
                kjøkkenet er bedre.
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg ikke blande gamle og nye batterier?">
                Batterier i serie tvinges til å levere samme strøm. Er ett av dem nesten
                tomt, må det jobbe hardere enn de andre, og det øker risikoen for at
                elektrolytten etser seg ut gjennom kapslingen. Bland heller ikke ulike typer
                eller merker i samme enhet.
              </FaqItem>
              <FaqItem question="Er oppladbare batterier alltid det mest miljøvennlige valget?">
                Som regel, men ikke alltid. Et NiMH-batteri som lades hundrevis av ganger
                erstatter en stor mengde engangsbatterier, og lønner seg både økonomisk og
                miljømessig i utstyr med høyt forbruk. I en røykvarsler eller en veggklokke
                som bruker minimalt over mange år, er et engangsbatteri med lang holdbarhet
                ofte det mest fornuftige. Poenget er å velge etter faktisk bruksmønster.
              </FaqItem>
              <FaqItem question="Hvordan vet jeg om et batteri er tomt?">
                En enkel batteritester eller et multimeter gir svar på sekunder. Uten utstyr
                kan du teste batteriet i en enhet med lavt forbruk – virker det der, er det
                ikke tomt. Poenget er å slippe å gjette, og å slippe å legge et halvfullt
                batteri tilbake blant de nye.
              </FaqItem>
              <FaqItem question="Hva gjør jeg hvis et batteri har lekket?">
                Unngå hudkontakt med det hvite belegget, bruk hansker, og tørk enheten
                forsiktig med en tørr klut eller en bomullspinne. Vask hendene etterpå. Det
                lekke batteriet leveres inn som brukt batteri på vanlig måte – det hører
                aldri hjemme i restavfallet.
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
                Orden i batteriene starter med ett rom
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Når nye og brukte batterier har hver sin faste plass, blir både sikkerheten
                og gjenvinningen en naturlig del av hverdagen – ikke noe du må huske på.
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
                  'Hvordan fungerer batterier', 'Batterikjemi', 'Alkaliske batterier',
                  'Litiumbatterier', 'AA-batterier', 'AAA-batterier', 'Batterisikkerhet',
                  'Batterigjenvinning', 'Oppbevaring av batterier', 'Bærekraftig hjem',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
