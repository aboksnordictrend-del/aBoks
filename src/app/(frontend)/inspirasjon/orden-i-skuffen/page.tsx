import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'orden-i-skuffen',
    title: 'Orden i skuffen – 5 tips for et ryddigere og tryggere hjem',
    description:
      'Orden i skuffen handler om mer enn estetikk. Få 5 praktiske tips for et ryddigere, tryggere og mer bærekraftig hjem – med smart batterioppbevaring og riktig gjenvinning.',
    ogTitle: 'Orden i skuffen – 5 tips for et ryddigere og tryggere hjem | aBoks',
    ogDescription:
      'En praktisk og inspirerende guide til hvordan du skaper varig orden i skuffen. Lær å tømme, soneinndele og få kontroll på batterikaoset, samtidig som du ivaretar brannsikkerhet og riktig gjenvinning – forankret i råd fra DSB og Miljødirektoratet.',
  }),
  keywords: [
    'orden i skuffen', 'rydding', 'hjemorganisering', 'batterioppbevaring',
    'batterigjenvinning', 'brannsikkerhet', 'bærekraftig hjem',
    'skandinavisk design', 'aBoks',
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

function StepItem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', padding: '22px 0', borderBottom: '1px solid #ddd8ce' }}>
      <span style={{
        flexShrink: 0, width: '44px', height: '44px', borderRadius: '50%',
        background: '#5e6a48', color: '#faf6ee',
        fontFamily: 'var(--font-manrope)', fontSize: '16px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <div>
        <p style={{ ...h3Style, margin: '6px 0 6px' }}>{title}</p>
        <p style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.7, color: '#4a4e41', margin: 0 }}>
          {children}
        </p>
      </div>
    </div>
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

function CalloutDark({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 30px', background: '#fff', border: '1px solid #ddd8ce', borderLeft: '4px solid #39402c', borderRadius: '0 16px 16px 0' }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        color: '#39402c', background: '#eee9de', padding: '5px 12px',
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Orden i skuffen</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Hjem &amp; Organisering
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Orden i skuffen – 5 tips for et ryddigere hjem
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Orden i skuffen er ofte det første steget mot et roligere hjem. Den ene
              kjøkkenskuffen der alt havner – batterier, ladere, nøkler og halve
              fjernkontroller – sier mye om hvordan resten av huset fungerer. Her er fem
              gjennomtenkte grep som gjør hverdagen enklere, tryggere og mer bærekraftig.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 6 min · Oppdatert juni 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              De fleste av oss kjenner følelsen. Du åpner skuffen for å finne et nytt
              batteri til fjernkontrollen, og blir møtt av et virvar av løse ledninger,
              gamle kvitteringer og batterier du ikke aner om er fulle eller tomme.
              Skuffekaos er ikke bare irriterende – det stjeler tid, fører til unødvendige
              innkjøp og kan i verste fall utgjøre en sikkerhetsrisiko.
            </p>

            <p style={pStyle}>
              God organisering handler i kjernen om skandinaviske verdier: enkelhet,
              funksjon og varighet. Når hver ting har sin faste plass, bruker du mindre
              energi på å lete, du kaster mindre, og hjemmet føles umiddelbart mer
              harmonisk. I denne artikkelen går vi gjennom fem konkrete tips – fra de
              helt enkle grepene til de litt mer overraskende detaljene de fleste glemmer.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Et ryddig hjem starter ikke med store oppussingsprosjekter, men med én
              skuff om gangen.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Redaksjonens prinsipp
              </footer>
            </blockquote>

            <h2 style={h2Style}>1. Tøm alt ut – og vær ærlig med deg selv</h2>

            <p style={pStyle}>
              Det høres banalt ut, men det viktigste steget er også det mest oversette:
              tøm skuffen helt. Legg alt utover på bordet, og se hva du faktisk har. Du
              kommer garantert til å finne dubletter, ting som hører hjemme et annet sted,
              og gjenstander du ikke har rørt på flere år.
            </p>

            <p style={pStyle}>Sorter innholdet i tre enkle bunker:</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem><strong>Beholde</strong> – ting du bruker jevnlig og som hører hjemme her.</BulletItem>
              <BulletItem><strong>Flytte</strong> – ting som egentlig tilhører et annet rom eller en annen skuff.</BulletItem>
              <BulletItem><strong>Kvitte deg med</strong> – defekt utstyr, tomme penner, gamle batterier og annet som bare tar plass.</BulletItem>
            </ul>

            <p style={pStyle}>
              Husk at «kvitte deg med» ikke betyr restavfall for alt. Mye av det som
              ligger i rotskuffen – batterier, små elektroniske dingser, ladere – skal til
              gjenvinning. Mer om det lenger ned.
            </p>

            <h2 style={h2Style}>2. Gi hver kategori sin egen sone</h2>

            <p style={pStyle}>
              Når skuffen er tom, er det fristende å bare legge alt tilbake. Men
              hemmeligheten bak varig orden er <em>soneinndeling</em>. I stedet for én
              stor skuff med løst innhold, deler du den inn i tydelige rom for ulike
              kategorier.
            </p>

            <p style={pStyle}>
              Bruk skuffeinnsatser, små bokser eller dedikerte oppbevaringsløsninger som
              holder ting adskilt. Da ser du på et blikk hva du har, og det blir nesten
              umulig å rote det til igjen, fordi hver ting har en åpenbar plass å vende
              tilbake til.
            </p>

            <Callout label="Proff-tips">
              Plasser de tingene du bruker oftest fremst i skuffen, og det du sjelden
              trenger lengst bak. Små justeringer i rekkefølgen sparer deg for hundrevis
              av unødvendige bevegelser i løpet av et år.
            </Callout>

            <h2 style={h2Style}>3. Få kontroll på batterikaoset</h2>

            <p style={pStyle}>
              Hvis det er én ting som garantert skaper rot i skuffen, er det batterier.
              De ligger løse, ruller rundt, og du vet sjelden hvilke som er fulle og
              hvilke som er brukt opp. Resultatet er at fungerende batterier kastes i
              frustrasjon, mens tomme blir liggende altfor lenge.
            </p>

            <p style={pStyle}>
              Tallene er talende: ifølge norske brannvesen har en gjennomsnittlig norsk
              husholdning til enhver tid over 70 batterier i hjemmet – fra fjernkontroller
              og røykvarslere til leker, klokker og tannbørster. Det er mange små
              energikilder å holde styr på.
            </p>

            <p style={pStyle}>
              Løsningen er enkel: gi batteriene en fast plass med tydelig skille mellom
              nye og brukte. En dedikert{' '}
              <Link href="/produkter/aboks" style={extLink}>batteriorganisator som aBoks</Link>{' '}
              gjør nettopp dette – den samler nye AA, nye AAA og brukte batterier i hvert
              sitt rom, slik at du alltid har oversikt. Du slipper å kaste gode batterier,
              og de tomme havner ett sted i påvente av gjenvinning.
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Problem i skuffen', 'Smart løsning'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '13px 16px',
                        background: '#39402c', color: '#faf6ee',
                        fontWeight: 600, letterSpacing: '0.02em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Løse batterier som ruller rundt', 'Fast rom for hver batteritype'],
                    ['Vet ikke om batteriet er fullt eller tomt', 'Eget rom for brukte celler'],
                    ['Brukte batterier blir liggende', 'Samlepunkt som minner deg på levering'],
                    ['Kjøper batterier du allerede har', 'Full oversikt = færre dobbeltkjøp'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 3 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top', color: '#4a4e41', lineHeight: 1.6,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={h2Style}>4. Tenk sikkerhet – ikke bare estetikk</h2>

            <p style={pStyle}>
              Orden i skuffen handler ikke bare om hvordan det ser ut. Det handler også
              om sikkerhet, og dette er et punkt overraskende mange overser. Løse, brukte
              batterier kan nemlig kortslutte dersom polene kommer i kontakt med hverandre
              eller med andre metallgjenstander – og en enkelt gnist kan i verste fall
              starte en brann.
            </p>

            <p style={pStyle}>
              Direktoratet for samfunnssikkerhet og beredskap (
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer" style={extLink}>DSB</a>
              ) peker på at batterier var antatt brannårsak i minst 157 branner og
              branntilløp i norske bygninger i 2024. Brannvesenenes klare råd er å teipe
              polene på brukte batterier og oppbevare dem i en branntrygg beholder –
              tradisjonelt har et syltetøyglass med lokk vært et vanlig tips.
            </p>

            <p style={pStyle}>
              Poenget er prinsippet: brukte batterier bør holdes adskilt og oppbevares
              trygt frem til de leveres til gjenvinning. Et eget, lukket rom for brukte
              celler gjør denne rutinen enkel å følge i hverdagen, i stedet for at de
              blir liggende løst sammen med alt annet.
            </p>

            <CalloutDark label="Visste du at...">
              De siste årene har det oppstått over 200 branner i norske avfallsanlegg, og
              en stor andel av brannene med kjent årsak skyldes feilsorterte batterier.
              Riktig oppbevaring hjemme er det første leddet i å forhindre disse hendelsene.
            </CalloutDark>

            <h2 style={h2Style}>5. Bygg en rutine for gjenvinning</h2>

            <p style={pStyle}>
              Den siste – og kanskje viktigste – brikken er at orden skal lede til riktig
              handling. Det hjelper lite å samle brukte batterier hvis de aldri når frem
              til gjenvinning. Og her har Norge fortsatt en jobb å gjøre:{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer" style={extLink}>Miljødirektoratet</a>{' '}
              opplyser at returselskapene i dag oppnår en innsamlingsgrad på rundt 65
              prosent for løse, bærbare batterier. Det betyr at en betydelig andel
              fortsatt forsvinner ut av kretsløpet.
            </p>

            <p style={pStyle}>
              Brukte batterier skal aldri kastes i restavfallet. De inneholder verdifulle
              materialer som kan gjenvinnes, og miljøskadelige stoffer som må håndteres
              forsvarlig. Slik gjør du det enkelt:
            </p>

            <div style={{ margin: '8px 0 28px', borderTop: '1px solid #ddd8ce' }}>
              <StepItem n={1} title="Samle på ett sted">
                La brukte batterier ha en fast samleplass, adskilt fra de nye.
              </StepItem>
              <StepItem n={2} title="Teip polene">
                Sett teip over polene på de brukte batteriene for å hindre kortslutning.
              </StepItem>
              <StepItem n={3} title="Lever jevnlig">
                Ta dem med til butikken eller gjenvinningsstasjonen – butikker som selger
                batterier er pliktige til å ta dem imot gratis.
              </StepItem>
              <StepItem n={4} title="Gjør det til en vane">
                Knytt leveringen til noe du gjør uansett, som den ukentlige handleturen.
              </StepItem>
            </div>

            <p style={pStyle}>
              Et lite triks: legg samlepunktet for brukte batterier et sted du passerer
              ofte, gjerne sammen med handleposene i gangen. Når oppbevaringen er synlig,
              blir det langt lettere å huske å ta dem med ut. Du finner oversikt over
              hvor du kan levere i din kommune på{' '}
              <a href="https://www.sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>sortere.no</a>.
            </p>

            <h2 style={h2Style}>Fra rotskuff til rolig hjem</h2>

            <p style={pStyle}>
              Orden i skuffen er en liten øvelse med store ringvirkninger. Når du tømmer,
              soneinndeler, får kontroll på batteriene, tenker sikkerhet og bygger en
              gjenvinningsrutine, oppnår du noe mer enn et pent interiør. Du sparer penger
              på færre feilkjøp, du reduserer avfall, og du gjør hjemmet ditt tryggere.
            </p>

            <p style={pStyle}>
              Det er nettopp denne kombinasjonen av estetikk, funksjon og ansvar som
              ligger i hjertet av god skandinavisk design – og som gjør at den ene
              ryddige skuffen ofte blir starten på et hjem som rett og slett fungerer
              bedre.
            </p>

            {/* CTA */}
            <div style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(32px,3vw,48px) clamp(28px,3vw,44px)',
              textAlign: 'center', margin: '56px 0 12px',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 500,
                fontSize: 'clamp(26px,2.4vw,34px)', letterSpacing: '-0.015em',
                color: '#faf6ee', margin: '0 0 12px',
              }}>
                Klar for orden i batteriene?
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                aBoks samler nye AA, nye AAA og brukte batterier i én smart boks med tre
                rom – designet i Norge for full oversikt fra dag én.
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

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }}>Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvordan holder jeg orden i en skuff som alltid roter seg til igjen?">
                Nøkkelen er soneinndeling. En skuff roter seg til når innholdet ligger
                løst og ingenting har en fast plass. Bruk innsatser eller dedikerte bokser
                slik at hver kategori – batterier, ladere, verktøy – får sitt eget rom.
                Når hver ting har en åpenbar plass å vende tilbake til, opprettholdes
                ordenen nesten av seg selv.
              </FaqItem>
              <FaqItem question="Hvor mange batterier har en vanlig husholdning egentlig?">
                Ifølge norske brannvesen har en gjennomsnittlig norsk husholdning til
                enhver tid over 70 batterier i hjemmet. De sitter i alt fra fjernkontroller,
                røykvarslere og leker til klokker, vekter og tannbørster – derfor er det
                lett å miste oversikten uten en fast oppbevaringsløsning.
              </FaqItem>
              <FaqItem question="Er det farlig å oppbevare brukte batterier løst i skuffen?">
                Det kan medføre en risiko. Brukte batterier har ofte restenergi, og dersom
                polene kommer i kontakt med metall eller andre batterier, kan de kortslutte.
                Brannvesenenes råd er å teipe polene og oppbevare brukte batterier i en
                branntrygg, adskilt beholder frem til de leveres til gjenvinning.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg brukte batterier til gjenvinning?">
                Brukte batterier skal aldri i restavfallet. Du kan levere dem gratis i
                butikker som selger batterier – de er pliktige til å ta imot – eller på
                nærmeste gjenvinningsstasjon. En oversikt over leveringssteder i din
                kommune finner du på{' '}
                <a href="https://www.sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>sortere.no</a>.
              </FaqItem>
              <FaqItem question="Hvorfor er det viktig å skille nye og brukte batterier?">
                Når nye og brukte batterier ligger om hverandre, er det umulig å vite
                hvilke som fungerer. Det fører til at gode batterier kastes og tomme blir
                liggende. Et tydelig skille – for eksempel egne rom i en batteriorganisator
                som aBoks – gir deg oversikt, reduserer dobbeltkjøp og gjør det enkelt å
                samle brukte celler for gjenvinning.
              </FaqItem>
            </div>

            {/* Sources */}
            <div style={{ paddingTop: '28px', borderTop: '1px solid #ddd8ce' }}>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: '13px', color: '#1a1d17', margin: '0 0 14px',
              }}>
                Kilder og videre lesning
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {[
                  { label: 'Miljødirektoratet', url: 'https://www.miljodirektoratet.no/', note: 'innsamlingsgrad og regelverk for batterier' },
                  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB)', url: 'https://www.dsb.no/', note: 'brannstatistikk og råd om batterier' },
                  { label: 'Statistisk sentralbyrå (SSB)', url: 'https://www.ssb.no/', note: 'avfall og gjenvinning' },
                  { label: 'Sortere.no', url: 'https://www.sortere.no/', note: 'hvor du leverer batterier i din kommune' },
                ].map((s) => (
                  <li key={s.url} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '50%', background: '#696a62', marginTop: '8px' }} />
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6 }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={extLink}>{s.label}</a>
                      {' '}– {s.note}
                    </span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'Orden i skuffen', 'Rydding', 'Hjemorganisering', 'Batterioppbevaring',
                  'Brannsikkerhet', 'Kildesortering', 'Skandinavisk design',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
