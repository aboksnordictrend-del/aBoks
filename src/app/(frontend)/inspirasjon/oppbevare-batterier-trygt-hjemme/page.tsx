import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'oppbevare-batterier-trygt-hjemme',
    title: 'Hvordan oppbevare batterier trygt hjemme? Komplett guide | aBoks',
    description:
      'Slik oppbevarer du batterier trygt hjemme: teip poler, hold nye og brukte adskilt, og unngå brannfare. Praktisk guide basert på råd fra DSB og norske brannvesen.',
    ogDescription:
      'En grundig, praktisk guide til hvordan du oppbevarer batterier trygt hjemme. Dekker brannfare, kortslutning, teiping av poler, riktig lagringstemperatur, ulike batterityper, barnesikkerhet og innlevering til gjenvinning – med kilder fra DSB, Norsk Industri og Miljødirektoratet.',
  }),
  keywords: [
    'oppbevare batterier', 'batterisikkerhet', 'brannfare batterier',
    'litiumbatterier', 'teipe poler', 'batterioppbevaring',
    'gjenvinning batterier', 'trygt hjem', 'DSB', 'batteriboks',
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

const TYPE_ROWS: string[][] = [
  ['Alkaliske (AA/AAA)', 'Fjernkontroller, leker, klokker', 'Oppbevares tørt og kjølig. Kan lekke ved lang lagring – sjekk jevnlig.'],
  ['Oppladbare (NiMH)', 'Kamera, spillkontroller, lykter', 'Tåler mange ladesykluser. Lades ikke helt tomme før lagring.'],
  ['Litium-ion', 'Mobil, verktøy, elsykkel', 'Mest brannfarlig. Lagres helst halvladet, unngå slag og varme.'],
  ['Knappceller', 'Høreapparat, bilnøkkel, kort', 'Svelgefare for barn. Teip og oppbevar utilgjengelig.'],
]

const SOURCES = [
  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) – råd om litiumbatterier og brannsikkerhet', url: 'https://www.dsb.no/' },
  { label: 'Norsk Industri – årlig brannstatistikk for gjenvinningsbransjen', url: 'https://www.norskindustri.no/bransjer/gjenvinning/aktuelt/brannstatistikk/' },
  { label: 'Miljødirektoratet – regelverk for batterier og farlig avfall', url: 'https://www.miljodirektoratet.no/' },
  { label: 'NORSIRK – returordning og gjenvinning av batterier', url: 'https://www.norsirk.no/' },
  { label: 'Regjeringen.no – Meld. St. 16 om brann- og redningsvesenet', url: 'https://www.regjeringen.no/' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Oppbevare batterier trygt hjemme</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Sikkerhet &amp; bærekraft
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvordan{' '}
              <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>oppbevare batterier trygt hjemme</em>?
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Å oppbevare batterier trygt hjemme er et av de enkleste og mest oversette grepene
              for et tryggere hjem. Med noen få rutiner holder du både brannfaren nede,
              batteriene lenger friske og naturen fri for skadelige stoffer.
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
              De fleste av oss tenker sjelden over batteriene i huset før fjernkontrollen dør
              eller røykvarsleren piper midt på natten. Likevel omgir vi oss med langt flere av
              dem enn vi aner. Ifølge norske brannvesen har en gjennomsnittlig norsk husholdning
              til enhver tid over 70 batterier liggende – i klokker, leker, tannbørster, verktøy,
              høreapparater og et vell av andre dingser. Når så mange små energikilder samler seg
              i skuffer og skap, blir spørsmålet om{' '}
              <strong>hvordan oppbevare batterier trygt hjemme</strong> plutselig veldig relevant.
            </p>

            <p style={pStyle}>
              Den gode nyheten er at trygg oppbevaring ikke krever avanserte løsninger. Det
              handler først og fremst om å forstå hvorfor batterier kan være en risiko, og
              deretter etablere noen enkle vaner som varer. I denne guiden går vi gjennom de
              vanligste feilene, hva ekspertene faktisk anbefaler, og hvordan litt orden hjemme
              gjør hele forskjellen – både for sikkerheten og for miljøet.
            </p>

            <h2 style={h2Style}>Hvorfor riktig oppbevaring er viktigere enn folk tror</h2>

            <p style={pStyle}>
              Batterier er små energilagre, og energi som er lagret må håndteres med respekt.
              Selv et «tomt» batteri har nesten alltid litt restenergi igjen. Kommer polene i
              kontakt med metall – en mynt, en nøkkel, et annet batteri – kan det oppstå en
              kortslutning. En enkelt gnist er nok til å starte en brann.
            </p>

            <p style={pStyle}>
              Dette er ikke et teoretisk problem. Feilsorterte batterier er den klart vanligste
              årsaken til brann på norske avfalls- og gjenvinningsanlegg. Bransjeorganisasjonen{' '}
              <a href="https://www.norskindustri.no/bransjer/gjenvinning/aktuelt/brannstatistikk/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Norsk Industri
              </a>
              , som samler inn brannstatistikk hvert år, anslår at rundt tre av fire branner på
              gjenvinningsanlegg skyldes brukte batterier. Ser man kun på hendelsene der årsaken
              er kjent, er andelen enda høyere. Tall fra Direktoratet for samfunnssikkerhet og
              beredskap (DSB) viser at batteri var antatt brannårsak i minst 157 branner og
              branntilløp i bygninger i Norge i løpet av ett enkelt år.
            </p>

            <FactBox value="~75" unit="%">
              av brannene på norske gjenvinningsanlegg skyldes brukte batterier, ifølge Norsk
              Industris årlige brannstatistikk. Mesteparten starter med noe så enkelt som en
              kortslutning.
            </FactBox>

            <p style={pStyle}>
              Særlig litium-ion-batteriene, som i dag sitter i alt fra mobiler og smartklokker til
              elsparkesykler og verktøy, krever ekstra oppmerksomhet. De lagrer mye energi på
              liten plass, og når de først antennes, kan temperaturen bli så høy at brannen er
              nærmest umulig å slukke med vanlige slukkemidler. Fenomenet kalles «thermal
              runaway», eller termisk rømning, og er grunnen til at brannvesen advarer så tydelig
              mot å la skadede batterier ligge og slenge hjemme.
            </p>

            <h2 style={h2Style}>De vanligste feilene folk gjør</h2>

            <p style={pStyle}>
              Før vi ser på hva du bør gjøre, er det nyttig å vite hva du bør unngå. Mange
              trygghetsfeller er nemlig så vanlige at vi knapt tenker over dem:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Løse brukte batterier i skuffen.</strong> Når tomme batterier ligger
                sammen med mynter, binders og nøkler, øker sjansen for kortslutning betraktelig.
              </BulletItem>
              <BulletItem>
                <strong>Nye og brukte om hverandre.</strong> Uten et system er det nesten umulig
                å huske hvilke batterier som fortsatt har strøm – og hvilke som burde vært levert
                til gjenvinning for lenge siden.
              </BulletItem>
              <BulletItem>
                <strong>Batterier i restavfallet.</strong> Brukte batterier skal aldri i
                restavfallet. Der utgjør de en direkte brannfare i søppelbøtta, i
                renovasjonsbilen og på anlegget.
              </BulletItem>
              <BulletItem>
                <strong>Å samle på gamle batteriprodukter.</strong> Ødelagte mobiler, leker og
                verktøy med innebygde litiumbatterier bør ikke lagres i huset over tid – de bør
                leveres til gjenvinning.
              </BulletItem>
              <BulletItem>
                <strong>Lading i rømningsveier.</strong> DSB fraråder å lade elsparkesykler og
                andre litium-kjøretøy i ganger og trapperom, siden en brann her kan blokkere
                fluktveien.
              </BulletItem>
            </ul>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Det er alltid noe restenergi igjen i brukte batterier. Teip derfor polene og finn
              en branntrygg beholder – en gnist er nok til å starte en brann.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                aBoks redaksjon
              </footer>
            </blockquote>

            <h2 style={h2Style}>Slik oppbevarer du batterier trygt – steg for steg</h2>

            <p style={pStyle}>
              De offisielle rådene fra brannvesen og DSB er heldigvis både enkle og rimelige. Her
              er de viktigste grepene, i praktisk rekkefølge:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Teip polene på brukte batterier.</strong> Et lite stykke teip over pluss-
                og minuspolen hindrer at batteriet kortslutter mot metall eller andre batterier.
                Dette gjelder spesielt 9V-batterier og litiumceller, der polene sitter tett.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Bruk en branntrygg beholder.</strong> Brannvesen anbefaler å samle brukte
                batterier i noe ikke-brennbart – tradisjonelt et syltetøyglass med lokk, eller en
                egnet boks med et adskilt rom for de brukte cellene.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Hold nye og brukte adskilt.</strong> Et fast system der du ser hva som er
                fullt og hva som skal leveres, gjør at brukte batterier faktisk når gjenvinningen
                i stedet for å hope seg opp.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Oppbevar nye batterier kjølig og tørt.</strong> Romtemperatur eller litt
                under er ideelt. Fukt kan føre til korrosjon og lekkasje, mens sterk varme og
                direkte sollys reduserer levetiden.
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>Ikke bland gamle og nye batterier i samme apparat.</strong> Et svakt
                batteri drar ned de sterke, og risikoen for lekkasje øker. Bytt alle samtidig.
              </NumberedItem>
              <NumberedItem n={6}>
                <strong>Lever jevnlig til gjenvinning.</strong> Alle butikker som selger
                batterier plikter å ta imot brukte, og gjenvinningsstasjonene tar imot alt. Gjør
                det til en fast rutine – for eksempel når du handler batterier neste gang.
              </NumberedItem>
            </ol>

            <Callout label="Myte" title="«Batterier holder lenger i fryseren»">
              Det stemmer at kjølig oppbevaring bremser den naturlige selvutladingen i alkaliske
              batterier. Men fryseren er sjelden lurt: kondens og fukt kan skade batteriet når det
              tas ut igjen. Et tørt skap i romtemperatur er som regel både tryggere og godt nok
              for vanlige husholdningsbatterier.
            </Callout>

            <h2 style={h2Style}>Ulike batterityper krever ulik omtanke</h2>

            <p style={pStyle}>
              Ikke alle batterier oppfører seg likt. En rask oversikt gjør det lettere å behandle
              hver type riktig:
            </p>

            <DataTable
              headers={['Batteritype', 'Typisk bruk', 'Viktigst å huske']}
              rows={TYPE_ROWS}
              caption="Oppbevaringsråd etter batteritype. Er du i tvil, behandle batteriet som litium – det er alltid det tryggeste utgangspunktet."
            />

            <p style={pStyle}>
              Vil du gå mer i dybden på forskjellene, har vi laget en egen oversikt over{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>
              . Og er du usikker på hvordan du får mest mulig ut av dem, finner du praktiske råd
              om{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                å forlenge levetiden på batteriene dine
              </Link>
              .
            </p>

            <h2 style={h2Style}>Trygg oppbevaring med barn i huset</h2>

            <p style={pStyle}>
              Har du små barn, er det ett moment som fortjener ekstra oppmerksomhet:
              knappcellebatterier. De små, blanke cellene i bilnøkler, gratulasjonskort og enkelte
              leker ligner mistenkelig på godteri, og svelging kan gi alvorlige indre skader på
              svært kort tid. Oppbevar derfor både nye og brukte knappceller utilgjengelig for
              barn, gjerne i en lukket boks høyt oppe. Det samme prinsippet gjelder egentlig alle
              løse batterier – en fast, utilgjengelig plass er tryggere enn en åpen skuff.
            </p>

            <h2 style={h2Style}>Fra kaos i skuffen til fast plass</h2>

            <p style={pStyle}>
              Her møtes sikkerhet og hverdagsorden. Den vanligste grunnen til at brukte batterier
              aldri når gjenvinningen, er rett og slett at det ikke finnes et naturlig sted å
              legge dem. Da blir de liggende i en skuff, blandet med nye, til ingen lenger vet hva
              som er hva.
            </p>

            <p style={pStyle}>
              Løsningen er å gi batteriene en fast plass med tydelig skille mellom nye og brukte.
              Nettopp derfor lagde vi{' '}
              <Link href="/produkter/aboks" style={extLink}>aBoks</Link> – en batteriboks med tre
              adskilte rom: ett for nye AA, ett for nye AAA, og et eget rom for de brukte som skal
              leveres til gjenvinning. Du ser på et blikk hva du har igjen, og hva som skal ut av
              huset. Det lille rommet for brukte batterier gjør det enkelt å samle dem trygt frem
              til de leveres inn – i tråd med rådet om å holde brukte celler adskilt og oppbevart
              forsvarlig.
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
              }}>Smart batteriorganisering</span>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(20px,1.8vw,26px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 16px',
              }}>
                Én boks. Tre rom. Full oversikt.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                aBoks gir hvert batteri sin faste plass – nye AA, nye AAA og et eget rom for de
                brukte. Designet i Norge, i et matt, tidløst uttrykk som passer på
                kjøkkenbenken, hjemmekontoret eller i boden.
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
                  Slik fungerer det
                </Link>
              </div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9fb08f', margin: '16px 0 0' }}>
                Designet i Norge · fri frakt over kr 650
              </p>
            </div>

            <p style={pStyle}>
              Vil du ha veggmontert løsning for å spare plass, finnes også{' '}
              <Link href="/produkter/aboks-vegg" style={extLink}>aBoks Vegg</Link>, som gir den
              samme oversikten stående eller på veggen. Uansett hvilken løsning du velger, er
              poenget det samme: når batteriene har en fast plass, blir trygg oppbevaring en vane
              i stedet for et prosjekt.
            </p>

            <h2 style={h2Style}>Det siste steget: lever inn</h2>

            <p style={pStyle}>
              Trygg oppbevaring hjemme er ikke målet i seg selv – det er broen til riktig
              gjenvinning. Når batteriene er samlet, teipet og adskilt, gjenstår bare å levere dem
              inn. Alle butikker som selger batterier er pålagt å ta imot brukte, og på
              gjenvinningsstasjonen kan du levere alt. Materialene gjenvinnes, miljøgiftene tas
              hånd om, og du fjerner brannfaren fra hjemmet ditt.
            </p>

            <p style={pStyle}>
              Vil du lese mer om selve innleveringen, har vi samlet rådene i guiden om{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>
              . Og trenger du et system for selve sorteringen, hjelper artikkelen om{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                å sortere batteriene riktig hjemme
              </Link>{' '}
              deg godt i gang.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om oppbevaring av batterier
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Er det farlig å oppbevare brukte batterier hjemme?">
                Enkeltvis er risikoen lav, men brukte batterier har alltid litt restenergi. Ligger
                de løst sammen med metall eller andre batterier, kan de kortslutte og i verste
                fall ta fyr. Teip polene og oppbevar dem i en branntrygg beholder med et eget rom
                for brukte, så holder du risikoen på et minimum.
              </FaqItem>
              <FaqItem question="Bør jeg oppbevare batterier i kjøleskapet eller fryseren?">
                Kjølig oppbevaring bremser selvutladingen i alkaliske batterier, men fryseren
                frarådes fordi kondens og fukt kan skade cellene. Et tørt skap i romtemperatur,
                unna varmekilder og direkte sollys, er som regel både trygt og godt nok for
                vanlige husholdningsbatterier.
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg teipe polene på brukte batterier?">
                Fordi selv tomme batterier har restenergi. Teip over pluss- og minuspolen hindrer
                at batteriet kortslutter mot mynter, nøkler eller andre batterier. Det er spesielt
                viktig for 9V-batterier og litiumceller, der polene sitter tett sammen.
              </FaqItem>
              <FaqItem question="Kan jeg blande nye og gamle batterier i samme apparat?">
                Nei. Ytelsen begrenses av det svakeste batteriet, og faren for lekkasje øker. Bytt
                derfor alltid ut alle batteriene i et apparat samtidig, og bruk samme type, merke
                og alder.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg brukte batterier?">
                Alle butikker som selger batterier plikter å ta imot brukte batterier gratis, og
                gjenvinningsstasjonene tar imot alt. Gjør det til en fast rutine – for eksempel
                neste gang du handler batterier – så unngår du at de hoper seg opp hjemme.{' '}
                <Link href="/inspirasjon/hvor-levere-brukte-batterier" style={extLink}>
                  Her er den komplette oversikten
                </Link>
                .
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
                Klar for trygg oppbevaring?
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Tre rom, full oversikt og en fast plass for de brukte cellene. Slik blir trygg
                batterioppbevaring en vane som varer.
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
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva?
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/beste-losninger-batterioppbevaring-hjemme" style={extLink}>
                    De beste løsningene for batterioppbevaring hjemme
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
                  'Oppbevare batterier', 'Batterisikkerhet', 'Brannfare batterier',
                  'Litiumbatterier', 'Teipe poler', 'Batterioppbevaring',
                  'Gjenvinning batterier', 'Trygt hjem', 'DSB', 'Batteriboks',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
