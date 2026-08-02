import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'langtidsoppbevaring-oppladbare-batterier',
    title: 'Langtidsoppbevaring av oppladbare batterier – slik gjør du det riktig | aBoks',
    description:
      'Skal du sette bort oppladbare batterier over tid? Få ekspertrådene for riktig ladenivå, temperatur og vedlikeholdslading – og trygg oppbevaring hjemme.',
    ogDescription:
      'Komplett norsk guide til langtidsoppbevaring av oppladbare batterier. Lær forskjellen på NiMH og litium-ion, ideelt ladenivå, temperatur, vedlikeholdslading og hvordan du lagrer batteriene trygt og oversiktlig hjemme.',
  }),
  keywords: [
    'oppladbare batterier', 'langtidsoppbevaring', 'NiMH',
    'litium-ion', 'batterilagring', 'vedlikeholdslading',
    'batterisikkerhet', 'batteriorganisering',
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

function FactBox({ value, unit, children }: { value: string; unit?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 'clamp(18px,2vw,28px)',
      flexWrap: 'wrap', margin: '36px 0', padding: '26px 30px',
      background: '#eee9de', borderRadius: '16px',
    }}>
      <span style={{
        fontFamily: 'var(--font-cormorant)', fontWeight: 600,
        fontSize: 'clamp(38px,4vw,52px)', lineHeight: 1,
        letterSpacing: '-0.02em', color: '#39402c', flexShrink: 0,
      }}>
        {value}
        {unit ? <span style={{ fontSize: '0.45em', marginLeft: '2px' }}>{unit}</span> : null}
      </span>
      <p style={{
        fontFamily: 'var(--font-manrope)', fontSize: 'clamp(14px,1vw,15px)',
        lineHeight: 1.7, color: '#4a4e41', margin: 0, flex: '1 1 260px',
      }}>
        {children}
      </p>
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
  ['Ideelt ladenivå ved lagring', 'Ca. 50–80 %', 'Ca. 50–60 %'],
  ['Selvutlading', 'Høyere (lav for LSD-typer)', 'Svært lav'],
  ['Temperatur', 'Tørr romtemperatur', 'Stabil romtemperatur, ikke kulde'],
  ['Vedlikeholdslading', 'Ca. hver 3. måned (eldre celler)', 'Et par ganger i året'],
  ['Tåler frost i lagring', 'Dårlig under −10 °C', 'Nei – unngå kulde'],
]

const SOURCES = [
  { label: 'DSB – Litiumbatterier, ofte stilte spørsmål', url: 'https://www.dsb.no/farlige-stoffer/transport-av-farlig-gods/veiledning/litiumbatterier---ofte-stilte-sporsmal/' },
  { label: 'Store norske leksikon – Nikkel-metallhydridbatteri', url: 'https://snl.no/nikkel-metallhydridbatteri' },
  { label: 'NORSIRK – gjenvinning av batterier og elektronikk', url: 'https://norsirk.no/' },
  { label: 'Miljødirektoratet – avfall og gjenvinning', url: 'https://www.miljodirektoratet.no/' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Langtidsoppbevaring av oppladbare batterier</span>
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
              <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>Langtidsoppbevaring av oppladbare batterier</em>
              : slik tar du vare på dem riktig
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Riktig langtidsoppbevaring av oppladbare batterier avgjør om de fortsatt leverer
              full kraft neste sesong – eller om de er ubrukelige når du trenger dem. Her er de
              praktiske rådene som faktisk fungerer i et vanlig norsk hjem.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 7 min · Publisert august 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              De fleste av oss har en skuff, en eske eller en pose et sted i huset der de
              oppladbare batteriene havner når sesongen er over. Kamerabatteriene etter
              sommerferien, cellene til den trådløse musen, verktøybatteriet som skal hvile til
              våren. Så går det noen måneder – og når vi endelig trenger dem igjen, er de enten
              helt flate eller merkbart svakere enn de burde være. Det er sjelden batteriene det
              er noe galt med. Det er måten de ble lagret på.
            </p>

            <p style={pStyle}>
              God <strong>langtidsoppbevaring av oppladbare batterier</strong> handler om tre
              ting: riktig ladenivå, riktig temperatur og litt jevnlig ettersyn. Får du disse på
              plass, kan de samme cellene tjene deg trofast i mange år. I denne guiden går vi
              gjennom hva ekspertene faktisk anbefaler, hvilke myter du trygt kan legge fra deg,
              og hvordan du gjør oppbevaringen både trygg og oversiktlig hjemme.
            </p>

            <h2 style={h2Style}>Først: kjenn forskjellen på batteritypene dine</h2>

            <p style={pStyle}>
              Oppladbare batterier er ikke én ting. De to typene folk flest har hjemme, oppfører
              seg ulikt under lagring – og det er nettopp her mange går i baret. Vil du ha den
              fulle oversikten, har vi skrevet en egen guide om{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>
              , men her er kortversjonen for lagringsformål:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>NiMH-batterier</strong> (nikkel-metallhydrid) er de oppladbare AA- og
                AAA-cellene du putter i fjernkontroller, leker, mus og tastatur. De er robuste og
                tilgir mye, men eldre varianter mister strøm relativt raskt når de bare ligger.
              </BulletItem>
              <BulletItem>
                <strong>Litium-ion-batterier</strong> sitter i verktøy, elsykler, kameraer,
                telefoner og annen elektronikk. De har svært lav selvutlading, men er langt mer
                følsomme for både temperatur og ladenivå – og de er den typen som kan innebære en
                reell brannrisiko hvis de behandles feil.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Fordi de spiller etter ulike regler, deler vi rådene opp etter type. Men uansett
              hvilke du har: prinsippet om «tørt, temperert og med kontroll på ladenivået» går
              igjen.
            </p>

            <h2 style={h2Style}>Oppladbare AA- og AAA-batterier (NiMH)</h2>

            <p style={pStyle}>
              De klassiske oppladbare husholdningsbatteriene er de fleste av oss er kjent med.
              Her er det verdt å vite at det finnes en viktig generasjonsforskjell. Eldre
              NiMH-celler har en naturlig selvutlading som{' '}
              <a href="https://snl.no/nikkel-metallhydridbatteri" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                ifølge Store norske leksikon
              </a>{' '}
              kan være så høy som 5–10 prosent det første døgnet, og deretter stabiliserer seg på
              rundt 1 prosent per dag ved romtemperatur. Legger du slike bort helt fulle i mars,
              kan de være nær tomme til høsten.
            </p>

            <p style={pStyle}>
              Den gode nyheten er at moderne <strong>LSD-batterier</strong> (Low Self-Discharge,
              ofte solgt som «ready-to-use») har løst mye av dette. Denne typen beholder mellom 70
              og 85 prosent av kapasiteten etter et helt år på hylla ved 20 °C. Skal du kjøpe nye
              oppladbare AA eller AAA du vet blir liggende mellom sesongene, er LSD-varianten et
              klart bedre valg for langtidslagring.
            </p>

            <FactBox value="70–85" unit="%">
              av kapasiteten er fortsatt igjen etter et helt år på hylla ved 20 °C i moderne
              LSD-batterier – mot langt mindre i eldre NiMH-celler, som taper rundt 1 prosent per
              dag ved romtemperatur.
            </FactBox>

            <h3 style={h3Style}>Slik lagrer du NiMH-batterier over tid</h3>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Lad dem til rundt 50–80 prosent</strong> før de settes bort. Både helt
                tomt og helt fullt er unødvendig belastende over tid.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Oppbevar dem tørt og temperert</strong> – vanlig romtemperatur er
                utmerket. Unngå fuktige boder og varme vinduskarmer.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Hold nye og brukte adskilt.</strong> Ingenting er mer frustrerende enn å
                ikke vite hvilke celler som faktisk har strøm.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Vedlikeholdslad hver tredje måned</strong> hvis du bruker eldre NiMH. En
                kort ladeøkt kvartalsvis hindrer at cellene synker ned i skadelig dyputlading.
              </NumberedItem>
            </ol>

            <Callout label="Forklart" title="Hva er dyputlading – og hvorfor er det farlig for batteriet?">
              Blir et oppladbart batteri liggende helt tomt over lang tid, kan det gå inn i såkalt
              dyputlading. Da synker spenningen så lavt at cellen kan ta varig skade og i verste
              fall ikke lar seg lade opp igjen i det hele tatt. Det er dette den enkle regelen om
              vedlikeholdslading er ment å forhindre – og den viktigste grunnen til at «sett bort
              og glem» er dårlig strategi for oppladbare batterier.
            </Callout>

            <h2 style={h2Style}>Litium-ion-batterier: følsomme, men enkle når du kjenner reglene</h2>

            <p style={pStyle}>
              Litium-ion er teknologien som driver det meste av det kraftigere elektroniske
              utstyret hjemme. Disse cellene har til gjengjeld en stor fordel i
              lagringssammenheng: selvutladingen er svært lav. Kvalitetsbatterier mister ofte bare
              noen få prosent i året. Utfordringen er ikke at de tømmer seg raskt – det er at de
              mistrives ved feil ladenivå og feil temperatur.
            </p>

            <p style={pStyle}>
              Fagfolk er samstemte om at litium-ion trives best i{' '}
              <strong>halvladet tilstand</strong>. I det daglige bør ladenivået helst holdes
              mellom 20 og 80 prosent, og skal batteriet settes bort over lengre tid – for
              eksempel et verktøybatteri gjennom vinteren – er det ideelle rundt 50–60 prosent
              lading. Både helt fullt og helt tomt sliter unødig på cellene.
            </p>

            <p style={pStyle}>
              Temperatur er den andre nøkkelen. Og her lever det en seiglivet myte:
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Litium-ion-batterier liker ikke kulde. Det gamle rådet om å legge batterier i
              kjøleskapet gjelder engangsbatterier – ikke de oppladbare i verktøyet ditt.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Prinsipp for trygg litium-lagring
              </footer>
            </blockquote>

            <p style={pStyle}>
              Litium-ion-celler skal oppbevares ved moderat, stabil romtemperatur – helst i
              området 10–25 °C. Den kalde, uisolerte boden eller garasjen midtvinters er altså
              ikke stedet. Samtidig er direkte sollys og varme like skadelig i motsatt retning;
              høy temperatur akselererer aldringen betydelig. En tørr, temperert innebod eller et
              skap i oppholdssonen er som regel den beste plassen.
            </p>

            <h3 style={h3Style}>Sjekkliste for langtidslagring av litium-ion</h3>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                Lad til rundt <strong>50–60 prosent</strong> før lagring.
              </BulletItem>
              <BulletItem>
                Oppbevar <strong>tørt og ved stabil romtemperatur</strong>, unna både frost og
                direkte sol.
              </BulletItem>
              <BulletItem>
                Sjekk ladenivået <strong>et par ganger i året</strong> og topp opp til rundt
                halvfullt ved behov.
              </BulletItem>
              <BulletItem>
                Inspiser for <strong>faretegn</strong>: deformasjon, misfarging, uvanlig varme
                eller lukt. Et skadet litiumbatteri skal ikke lagres inne – lever det til
                gjenvinning.
              </BulletItem>
            </ul>

            <h2 style={h2Style}>Sammenlign: NiMH mot litium-ion for langtidslagring</h2>

            <DataTable
              headers={['Egenskap', 'NiMH (AA/AAA)', 'Litium-ion']}
              rows={COMPARE_ROWS}
              caption="Kortversjonen for de to vanligste oppladbare batteritypene i hjemmet."
            />

            <h2 style={h2Style}>Ikke glem sikkerheten – også for batterier som «bare ligger»</h2>

            <p style={pStyle}>
              Langtidsoppbevaring handler ikke bare om å bevare kapasitet. Det handler like mye om
              å lagre trygt. Et batteri som ligger uforsiktig, kan bli en risiko selv om det er
              halvtomt.
            </p>

            <p style={pStyle}>
              Den vanligste faren er kortslutning. Kommer polene på et batteri i kontakt med metall
              – en nøkkel, en mynt, eller polen på et annet batteri – kan det oppstå gnister, på
              samme måte som med et tennstål. For engangsbatterier og brukte celler anbefaler{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              derfor å teipe over polene før de leveres til gjenvinning. At batteriene ligger
              ordnet, hver for seg og uten løst metall rundt seg, er et enkelt, men undervurdert
              sikkerhetstiltak.
            </p>

            <p style={pStyle}>
              For litium-ion er innsatsen enda viktigere.{' '}
              <a href="https://norsirk.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                NORSIRK
              </a>{' '}
              og norske brannmyndigheter er tydelige på at skadede litiumbatterier ikke bør
              oppbevares inne, og at batterier du ikke lenger bruker, bør leveres til gjenvinning
              fremfor å bli liggende og slenge. Jo lenger et brukt eller aldrende batteri blir
              liggende ubrukt hjemme, jo viktigere blir det å ha oversikt over hvor det er og
              hvilken tilstand det er i.
            </p>

            <Callout label="Visste du" title="Restenergi er ekte energi">
              Selv et batteri du oppfatter som «tomt» inneholder ofte restenergi. Det er nettopp
              denne restenergien som gjør at feilhåndterte batterier kan antenne på avfallsanlegg.
              Ifølge Norsk Industri skyldes en stor andel av brannene ved gjenvinningsanlegg med
              kjent årsak nettopp feilsorterte batterier. Trygg oppbevaring hjemme er første ledd
              i en kjede som ender med sikker gjenvinning.
            </Callout>

            <h2 style={h2Style}>Orden er halve jobben</h2>

            <p style={pStyle}>
              Her ligger kjernen i det hele: det er nesten umulig å oppbevare oppladbare batterier
              riktig over tid hvis du ikke har oversikt over dem. Når nye og brukte, ladede og
              utladede ligger om hverandre i samme skuff, blir det umulig å vite hvilke som
              trenger vedlikeholdslading, hvilke som fortsatt har strøm, og hvilke som burde vært
              levert til gjenvinning for lengst.
            </p>

            <p style={pStyle}>
              Å gi batteriene en fast plass er derfor ikke bare et estetisk grep – det er selve
              forutsetningen for god langtidsoppbevaring. Med et system der ladede og brukte celler
              holdes adskilt, ser du på et blikk hva som skal lades, hva som er klart til bruk, og
              hva som skal ut av huset. Vil du gå grundigere til verks, har vi samlet flere ideer
              i guiden om{' '}
              <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>orden i skuffen</Link> og i
              artikkelen om hvordan du{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                forlenger levetiden på batteriene dine
              </Link>
              .
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
                Fast plass til nye, brukte og ladede batterier
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                aBoks er utviklet nettopp for å skape den oversikten god batterilagring krever.
                Med egne rom for nye AA, nye AAA og et eget rom for brukte celler som skal til
                gjenvinning, holder du alltid orden på hva du har – og hva som skal lades eller
                leveres. En rolig, tidløs boks som passer like godt på hjemmekontoret som i boden.
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

            <h2 style={h2Style}>Fem vanlige feil ved langtidsoppbevaring – og hva du gjør i stedet</h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Lagre batteriene helt fulle eller helt tomme.</strong> Sett dem heller bort
                halvladet.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Sette litium-ion i kald bod eller garasje.</strong> Gi dem stabil
                romtemperatur i stedet.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Glemme dem i månedsvis.</strong> Vedlikeholdslad jevnlig, særlig eldre
                NiMH.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Blande batterier med løst metall.</strong> Teip poler og hold cellene
                adskilt.
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>La brukte batterier bli liggende «til senere».</strong> Samle dem ett sted
                og lever dem til gjenvinning.
              </NumberedItem>
            </ol>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om langtidsoppbevaring av oppladbare batterier
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Kan jeg oppbevare oppladbare batterier i kjøleskapet?">
                For litium-ion: nei. Disse mistrives i kulde og skal ha stabil romtemperatur. For
                NiMH kan kjølig lagring i teorien redusere selvutladingen, men da må de ligge
                forseglet i en tett beholder og få nå romtemperatur før bruk, slik at det ikke
                dannes kondens. For de fleste er tørr romtemperatur den enkleste og tryggeste
                løsningen.
              </FaqItem>
              <FaqItem question="Hvor lenge kan oppladbare batterier lagres uten å ta skade?">
                Med riktig ladenivå og temperatur kan både NiMH og litium-ion lagres i mange
                måneder, og litium-ion i årevis. Nøkkelen er å hindre dyputlading. Sjekk ladenivået
                et par ganger i året for litium-ion, og hyppigere for eldre NiMH-celler.
              </FaqItem>
              <FaqItem question="Bør oppladbare batterier lades opp før eller etter lagring?">
                Begge deler, egentlig. Lad dem til rundt halvfullt før de settes bort, og topp opp
                jevnlig gjennom lagringsperioden. Rett før du skal bruke dem igjen, gir du dem en
                full lading. Å lagre dem helt utladet er den vanligste og mest skadelige feilen.
              </FaqItem>
              <FaqItem question="Hva gjør jeg med oppladbare batterier som ikke lenger holder på ladingen?">
                Alle oppladbare batterier slites gradvis og mister kapasitet med årene. Når et
                batteri ikke lenger holder på ladingen, skal det ikke i restavfallet, men leveres
                til gjenvinning – i butikk som selger batterier, eller på en gjenvinningsstasjon.
                Se guiden vår om{' '}
                <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                  å levere inn brukte batterier
                </Link>{' '}
                for hvor og hvordan.
              </FaqItem>
              <FaqItem question="Er det farlig å lagre litium-ion-batterier hjemme?">
                Friske, uskadede batterier som lagres tørt og temperert utgjør normalt liten
                risiko. Faren øker med skadede, gamle eller feilbehandlede celler. Inspiser for
                deformasjon, misfarging, lukt eller uvanlig varme, hold dem unna brennbart
                materiale, og lever skadede batterier til gjenvinning fremfor å lagre dem inne.
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
                Klar for orden i batteriene?
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Tre rom, full oversikt og en fast plass for de brukte cellene. Slik blir riktig
                langtidsoppbevaring en vane i stedet for et prosjekt.
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
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva?
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                    Slik sorterer du batteriene riktig hjemme
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et tryggere hjem
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/oppbevare-batterier-trygt-hjemme" style={extLink}>
                    Hvordan oppbevare batterier trygt hjemme?
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
                  'Oppladbare batterier', 'Langtidsoppbevaring', 'NiMH',
                  'Litium-ion', 'Batterilagring', 'Vedlikeholdslading',
                  'Batterisikkerhet', 'Batteriorganisering',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
