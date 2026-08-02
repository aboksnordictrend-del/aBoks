import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'beste-losninger-batterioppbevaring-hjemme',
    title: 'De beste løsningene for batterioppbevaring hjemme | aBoks',
    description:
      'Riktig batterioppbevaring hjemme gir tryggere hus, mindre rot og bedre gjenvinning. Se ekspertråd, vanlige feil og de smarteste løsningene for AA, AAA og brukte batterier.',
    ogDescription:
      'En praktisk guide til batterioppbevaring hjemme – hvorfor det er viktig for brannsikkerhet og miljø, de vanligste feilene folk gjør, en steg-for-steg-rutine og nye trender innen trygg, bærekraftig batteriorganisering i norske hjem.',
  }),
  keywords: [
    'batterioppbevaring', 'batterisikkerhet', 'brannsikkerhet hjemme',
    'batteriorganisering', 'gjenvinning batterier', 'litiumbatterier',
    'ryddig hjem', 'bærekraftig hjem', 'AA og AAA batterier', 'aBoks',
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
  ['Alkaliske (AA/AAA)', 'Fjernkontroller, leker, klokker', 'Tørt og kjølig. Skill nye fra brukte.'],
  ['Litium (celler og knappceller)', 'Røykvarslere, nøkkelbrikker, elektronikk', 'Ekstra viktig med teipede poler og branntrygg oppbevaring.'],
  ['Oppladbare (NiMH)', 'Kameraer, kontrollere, hverdagselektronikk', 'Lagres best halvladet. Merk gjerne ladedato.'],
  ['9V-batterier', 'Røykvarslere, instrumenter', 'Teip alltid polene – begge sitter i samme ende.'],
]

const SOURCES = [
  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) – litiumbatterier, ofte stilte spørsmål', url: 'https://www.dsb.no/farlige-stoffer/transport-av-farlig-gods/veiledning/litiumbatterier---ofte-stilte-sporsmal/' },
  { label: 'Miljødirektoratet – ny innsamlingsplikt for løse batterier blir 65 prosent', url: 'https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent' },
  { label: 'Miljødirektoratet – avfallstyper og batterier', url: 'https://www.miljodirektoratet.no/ansvarsomrader/avfall/avfallstyper/' },
  { label: 'Regjeringen.no – avfalls- og batteriregelverk', url: 'https://www.regjeringen.no/' },
  { label: 'NORSIRK – trygg håndtering av batterier', url: 'https://norsirk.no/' },
  { label: 'Statistisk sentralbyrå (SSB) – avfall og gjenvinning', url: 'https://www.ssb.no/' },
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Batterioppbevaring hjemme</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Hjem &amp; sikkerhet
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              De beste løsningene for{' '}
              <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>batterioppbevaring hjemme</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              God batterioppbevaring hjemme handler om langt mer enn å rydde bort en roteskuff.
              Det handler om å redusere brannfare, ta vare på verdifulle ressurser og gjøre
              hverdagen enklere. Her er de smarteste, tryggeste og mest bærekraftige måtene å
              oppbevare batteriene dine på.
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
              De fleste norske hjem har flere batterier enn beboerne aner. Fjernkontroller,
              røykvarslere, leker, tastaturer, veggur, tannbørster og hodelykter går alle på
              strøm fra små celler – og de blir gjerne liggende spredt i skuffer, vesker og skap.
              Ifølge bransjetall har en gjennomsnittlig norsk husholdning til enhver tid over 70
              batterier i omløp hjemme. Når så mange batterier befinner seg på så mange ulike
              steder, blir god batterioppbevaring plutselig et spørsmål om både orden, økonomi og
              sikkerhet.
            </p>

            <p style={pStyle}>
              Den gode nyheten er at riktig oppbevaring er enkelt når du først har systemet på
              plass. I denne guiden går vi gjennom hvorfor det er viktig, hvilke feil folk flest
              gjør, og hvilke løsninger som faktisk fungerer i en travel hverdag.
            </p>

            <h2 style={h2Style}>Hvorfor batterioppbevaring hjemme er viktigere enn du tror</h2>

            <p style={pStyle}>
              Det er lett å tenke på løse batterier som harmløse. I virkeligheten er de en av de
              mest oversette risikofaktorene i norske hjem. Brann- og redningsetater over hele
              landet advarer mot nettopp den klassiske roteskuffen, der batterier ligger sammen
              med nøkler, mynter, binders og annet metall.
            </p>

            <p style={pStyle}>
              Problemet oppstår når polene på et batteri kommer i kontakt med metall. Selv et
              tilsynelatende «tomt» batteri har restenergi igjen, og et kortsluttet batteri kan
              bli varmt nok til å antenne brennbart materiale i nærheten. En eneste gnist er nok.
              Med det økende antallet{' '}
              <a href="https://www.dsb.no/farlige-stoffer/transport-av-farlig-gods/veiledning/litiumbatterier---ofte-stilte-sporsmal/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                litiumbaserte batterier
              </a>{' '}
              i hjemmet – de sitter nå i alt fra fjernkontroller til røykvarslere – har denne
              risikoen bare blitt større.
            </p>

            <p style={pStyle}>
              Konsekvensene rekker langt utenfor eget hjem. I 2022 var batterier årsaken til{' '}
              <strong>77 prosent</strong> av brannene med kjent årsak ved norske avfallsanlegg,
              ifølge statistikk innhentet av Norsk Industri. Feilsorterte og feillagrede
              batterier er blitt et så alvorlig problem at det truer selve muligheten til å
              forsikre gjenvinningsanleggene. Måten du oppbevarer batteriene på hjemme, er altså
              begynnelsen på en lang kjede – og den kjeden starter i din egen skuff.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Sikker batterioppbevaring starter hjemme. Får hvert batteri sin faste plass,
              forsvinner både rotet og mye av risikoen.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                aBoks redaksjon
              </footer>
            </blockquote>

            <h2 style={h2Style}>De vanligste feilene folk gjør</h2>

            <p style={pStyle}>
              Før vi ser på løsningene, er det verdt å kjenne igjen fallgruvene. De fleste av dem
              er så vanlige at vi knapt tenker over dem:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Alt i én skuff.</strong> Nye og brukte batterier ligger om hverandre,
                sammen med metallgjenstander som kan forårsake kortslutning.
              </BulletItem>
              <BulletItem>
                <strong>Ingen skille mellom nytt og brukt.</strong> Du kaster fungerende
                batterier fordi du ikke vet hvilke som fortsatt har strøm, eller du sliter med å
                finne et som virker.
              </BulletItem>
              <BulletItem>
                <strong>Brukte batterier blir liggende.</strong> De havner ikke til gjenvinning,
                men blir værende i huset i måneder – eller ender i restavfallet der de ikke hører
                hjemme.
              </BulletItem>
              <BulletItem>
                <strong>Oppbevaring på feil sted.</strong> Direkte sollys, fukt og høye
                temperaturer tapper batteriene raskere og øker risikoen, særlig for
                litiumbatterier som trives best kjølig og tørt.
              </BulletItem>
              <BulletItem>
                <strong>Ubeskyttede poler.</strong> Særlig 9V-batterier har begge poler i samme
                ende og kortslutter lett hvis de berører hverandre.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Kjenner du deg igjen i flere av punktene, er du i godt selskap. Poenget er ikke å
              føle skyld, men å innse hvor enkelt det er å rette opp.
            </p>

            <h2 style={h2Style}>Slik oppbevarer du batteriene riktig – steg for steg</h2>

            <p style={pStyle}>
              En god rutine for batterioppbevaring bygger på tre prinsipper: skille det nye fra
              det brukte, beskytte polene, og sørge for at brukte batterier faktisk når frem til
              gjenvinning. Slik gjør du det i praksis:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}>
                <strong>Samle alt på ett sted.</strong> Gå gjennom hjemmet og samle løse
                batterier fra skuffer, vesker og skap. Én fast plass gir umiddelbar oversikt.
              </NumberedItem>
              <NumberedItem n={2}>
                <strong>Skill nytt fra brukt.</strong> Hold fulle batterier for seg og tomme for
                seg, gjerne i egne rom eller beholdere. Da slipper du å teste og gjette.
              </NumberedItem>
              <NumberedItem n={3}>
                <strong>Teip polene på brukte batterier.</strong> Et lite stykke teip over polene
                hindrer kortslutning frem til levering. Dette gjelder spesielt 9V- og
                litiumbatterier.
              </NumberedItem>
              <NumberedItem n={4}>
                <strong>Oppbevar tørt og kjølig.</strong> Unngå direkte sollys, fukt og varme.
                Romtemperatur i et skap eller på en hylle er ideelt.
              </NumberedItem>
              <NumberedItem n={5}>
                <strong>Lever jevnlig til gjenvinning.</strong> Ta med brukte batterier neste
                gang du er innom en butikk med innleveringspunkt eller på gjenvinningsstasjonen.
              </NumberedItem>
            </ol>

            <Callout label="Ekspertråd" title="Bruk en branntrygg beholder">
              Flere norske brannvesen anbefaler å oppbevare brukte batterier i en branntrygg
              beholder – tradisjonelt et syltetøyglass med lokk. Prinsippet er godt: batteriene
              holdes adskilt fra brennbart materiale og fra hverandre. En dedikert batteriboks
              med et eget rom for brukte celler bygger på nøyaktig samme tanke, bare i en form
              som ser bedre ut på benken og gjør det lettere å holde systemet ved like.
            </Callout>

            <h2 style={h2Style}>Ulike batterityper krever litt ulik behandling</h2>

            <p style={pStyle}>
              Ikke alle batterier er like. En kjapp oversikt gjør det enklere å oppbevare og
              gjenvinne riktig:
            </p>

            <DataTable
              headers={['Batteritype', 'Vanlig bruk', 'Oppbevaringstips']}
              rows={TYPE_ROWS}
              caption="Oppbevaringsråd etter batteritype. Er du i tvil, behandle batteriet som litium – det er alltid det tryggeste utgangspunktet."
            />

            <p style={pStyle}>
              Vil du gå dypere inn i forskjellene, har vi laget en egen oversikt over{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>
              . Der finner du også råd om hvordan du{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                forlenger levetiden på batteriene dine
              </Link>{' '}
              og sparer både penger og avfall.
            </p>

            <h2 style={h2Style}>Nye trender: fra roteskuff til bevisst system</h2>

            <p style={pStyle}>
              Batterioppbevaring har utviklet seg fra å være noe vi ikke tenkte på, til å bli en
              naturlig del av et velfungerende hjem. Tre tydelige trender driver utviklingen:
            </p>

            <h3 style={h3Style}>1. Sirkulær tankegang i hverdagen</h3>
            <p style={pStyle}>
              Stadig flere ser batteriene som en ressurs, ikke som søppel. Når batterier
              gjenvinnes, tas verdifulle materialer som kan brukes på nytt, vare på. EUs nye
              batteriforordning skjerper kravene ytterligere, og Norge har allerede et{' '}
              <a href="https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                mål om å samle inn minst 65 prosent
              </a>{' '}
              av alle løse, bærbare batterier. Det målet nås bare hvis batteriene faktisk kommer
              seg ut av skuffene og frem til innlevering.
            </p>

            <h3 style={h3Style}>2. Design som inviterer til gode vaner</h3>
            <p style={pStyle}>
              En løsning som ser bra ut og har sin naturlige plass, blir brukt. Det er kjernen i
              skandinavisk designtenkning: form og funksjon som samarbeider. En batteriboks som
              får stå fremme fordi den er pen, gjør at rutinen vedlikeholder seg selv.
            </p>

            <h3 style={h3Style}>3. Sikkerhet som standard, ikke ettertanke</h3>
            <p style={pStyle}>
              Med flere litiumbatterier i hjemmet er brannsikkerhet blitt et hverdagstema.
              Løsninger som holder brukte batterier adskilt og beskyttet, er ikke lenger
              forbeholdt spesielt forsiktige – det er blitt sunn fornuft.
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
              }}>Løsningen i praksis</span>
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
                er utviklet nettopp for å løse batterikaoset på en trygg og elegant måte. Boksen
                har egne rom for nye AA-, nye AAA- og brukte batterier, slik at du alltid ser hva
                du har og hva som skal gjenvinnes. Det egne rommet for brukte celler gjør det
                enkelt å samle dem trygt frem til de leveres inn – helt i tråd med rådene fra
                norske brannvesen.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Designet i Norge, i en diskré matt finish som passer like godt ved TV-en, på
                kjøkkenet eller på hjemmekontoret. Vil du heller frigjøre benkeplass, gir{' '}
                <Link href="/produkter/aboks-vegg" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks Vegg
                </Link>{' '}
                samme oversikt montert på veggen.
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
              Vil du forstå hvordan et slikt system fungerer i praksis, kan du lese mer om{' '}
              <Link href="/slik-fungerer-det" style={extLink}>
                slik fungerer aBoks
              </Link>{' '}
              – fra utpakking til innlevering i fire enkle steg. Og hvis du ønsker konkrete tips
              til å få bukt med kaoset, gir vår guide til{' '}
              <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                orden i skuffen
              </Link>{' '}
              deg fem grep som varer.
            </p>

            <h2 style={h2Style}>Bærekraft: oppbevaring er første steg mot gjenvinning</h2>

            <p style={pStyle}>
              Riktig batterioppbevaring hjemme og god gjenvinning henger uløselig sammen. Et
              batteri kan ikke gjenvinnes hvis det aldri forlater huset. Ved å gi brukte
              batterier en fast plass, senker du terskelen for det viktigste steget: å faktisk
              levere dem inn.
            </p>

            <p style={pStyle}>
              Enkelte batterier inneholder farlige stoffer som bly, kadmium eller kvikksølv, som
              kan skade naturen dersom de havner på avveie. Andre inneholder verdifulle
              materialer som kan brukes i nye produkter. Derfor skal batterier alltid samles inn
              og behandles trygt – aldri kastes i restavfallet. Du kan lese mer om{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>
              , og om hvordan du kan bygge et mer{' '}
              <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                bærekraftig hjem for fremtiden
              </Link>
              .
            </p>

            <p style={pStyle}>
              Å oppbevare batteriene riktig er med andre ord ikke bare en praktisk detalj. Det er
              en liten, konkret handling som gjør hjemmet tryggere, hverdagen ryddigere og naturen
              renere – alt på én gang.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om batterioppbevaring
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvor bør jeg oppbevare batterier hjemme?">
                På et tørt, kjølig sted uten direkte sollys, gjerne i et skap eller på en hylle
                ved romtemperatur. Det aller viktigste er å holde nye og brukte batterier
                adskilt, og å beskytte polene på brukte batterier slik at de ikke kortslutter mot
                metall eller mot hverandre.
              </FaqItem>
              <FaqItem question="Er det farlig å ha løse batterier i en skuff?">
                Det kan være det. Ligger batterier løst sammen med mynter, nøkler eller andre
                batterier, kan polene kortslutte og bli varme nok til å antenne brennbart
                materiale. Derfor anbefaler brannvesen å oppbevare batterier adskilt og gjerne
                teipe polene på brukte celler.
              </FaqItem>
              <FaqItem question="Hvorfor bør jeg teipe polene på brukte batterier?">
                Selv brukte batterier har restenergi. Teip over polene hindrer at strømmen
                kortslutter i kontakt med metall eller andre batterier. Dette er spesielt viktig
                for 9V- og litiumbatterier, der polene lett kommer i kontakt med hverandre.
              </FaqItem>
              <FaqItem question="Hvor lenge kan jeg lagre nye batterier?">
                Uåpnede alkaliske batterier holder vanligvis i mange år hvis de oppbevares tørt
                og kjølig. Oppladbare batterier taper litt kapasitet over tid og lagres best
                halvladet. Sjekk gjerne holdbarhetsdatoen som er trykt på batteriet, og bruk de
                eldste først.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg inn brukte batterier?">
                Butikker som selger batterier er som regel pålagt å ta imot brukte batterier
                gratis, og de fleste dagligvarebutikker har en innsamlingsboks. Du kan også
                levere dem på gjenvinningsstasjonen. En fast plass hjemme for brukte batterier
                gjør det enkelt å samle dem opp mellom hver innlevering.{' '}
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
                Klar for orden i batteriene?
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
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les også</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                    Slik sorterer du batteriene riktig hjemme
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva? Den komplette guiden
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et ryddigere hjem
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/produkter" style={extLink}>
                    Se aBoks – smart batteriorganisering
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
                  'Batterioppbevaring', 'Batterisikkerhet', 'Brannsikkerhet hjemme',
                  'Batteriorganisering', 'Gjenvinning batterier', 'Litiumbatterier',
                  'Ryddig hjem', 'Bærekraftig hjem', 'AA og AAA batterier', 'aBoks',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
