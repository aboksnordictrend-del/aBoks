import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Hvorfor det lønner seg å levere inn brukte batterier',
  description:
    'Brukte batterier hører hjemme på gjenvinning – ikke i restavfallet. Slik leverer du inn batterier trygt, hvorfor det lønner seg, og hvordan du får orden hjemme.',
  alternates: {
    canonical: '/inspirasjon/levere-inn-brukte-batterier',
  },
  keywords: [
    'brukte batterier', 'batterigjenvinning', 'levere inn batterier',
    'brannsikkerhet hjemme', 'batteriorganisering', 'kildesortering',
    'miljøvennlig hjem', 'aBoks',
  ],
  openGraph: {
    title: 'Hvorfor det lønner seg å levere inn brukte batterier | aBoks',
    description:
      'En praktisk og tillitvekkende guide til hvorfor du bør levere inn brukte batterier til gjenvinning. Artikkelen forklarer brannrisikoen ved batterier i restavfall, gevinsten for miljøet, hvor du leverer inn gratis, og hvordan enkel batteriorganisering hjemme gjør den gode vanen mulig.',
  },
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

const h3GreenStyle: React.CSSProperties = {
  ...h3Style,
  color: '#5e6a48',
  margin: '0 0 10px',
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

function NumberItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '6px 0' }}>
      <span style={{
        flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
        background: '#39402c', color: '#faf6ee',
        fontFamily: 'var(--font-manrope)', fontSize: '13px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px',
      }}>{n}</span>
      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#4a4e41' }}>
        {children}
      </span>
    </li>
  )
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 28px', background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px' }}>
      <p style={h3Style}>{title}</p>
      <div style={{ ...pStyle, margin: 0 }}>{children}</div>
    </div>
  )
}

function CalloutGreenLight({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 28px', background: '#eef0e8', border: '1px solid #cdd2bd', borderRadius: '16px' }}>
      <p style={h3GreenStyle}>{title}</p>
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Levere inn brukte batterier</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Bærekraft &amp; hjemmeorganisering
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvorfor det lønner seg å levere inn brukte batterier
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Å levere inn brukte batterier er en av de enkleste miljøhandlingene vi gjør
              hjemme – og samtidig en av dem flest glemmer. Her er hvorfor det faktisk
              lønner seg, både for lommeboka, sikkerheten og naturen.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9a9a8e',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av aBoks-redaksjonen · Oppdatert juni 2026 · Lesetid: ca. 6 minutter
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              De fleste norske hjem har dem liggende: en håndfull brukte batterier i en
              kjøkkenskuff, et par i sekken, kanskje noen i garasjen. De er små, de virker
              harmløse, og de blir liggende altfor lenge. Men hvert eneste brukte batteri
              som ikke når gjenvinningen, er både en tapt ressurs og en potensiell
              brannfare. Den gode nyheten er at å levere inn brukte batterier ikke koster
              deg noe – verken penger eller særlig tid – og at gevinsten er overraskende stor.
            </p>

            <p style={pStyle}>
              I denne artikkelen ser vi nærmere på hva som faktisk skjer når du leverer
              batteriene dine til gjenvinning, hvorfor restavfallet er det verste stedet de
              kan havne, og hvordan litt orden hjemme gjør hele forskjellen. Vi bygger på
              råd fra norske myndigheter og returselskaper, og deler praktiske grep du kan
              ta i bruk allerede i dag.
            </p>

            <h2 style={h2Style}>Batterier er ikke søppel – de er ressurser</h2>

            <p style={pStyle}>
              Et batteri er ikke dødt materiale når strømmen tar slutt. Det inneholder
              verdifulle metaller som sink, jern, nikkel, kobolt og litium – råstoffer som
              ellers må graves ut av gruver med stort klimaavtrykk og naturinngrep. Når du
              leverer inn brukte batterier, går disse materialene tilbake i kretsløpet i
              stedet for å gå tapt.
            </p>

            <p style={pStyle}>
              Returselskapene i Norge er blant verdens fremste på området. For vanlige
              alkaliske AA- og AAA-batterier ligger materialgjenvinningen på opptil 75
              prosent, og for blybatterier er innsamlingen i praksis tilnærmet hundre
              prosent. Selv plastkassene batteriene fraktes i, blir til nye kasser. Det er
              sirkulærøkonomi i praksis – men det forutsetter at batteriene faktisk
              kommer fram til mottaket.
            </p>

            <CalloutGreenLight title="Visste du dette?">
              Det samles inn rundt 16 000 tonn brukte batterier i Norge hvert år. Likevel
              oppgir omtrent 7 prosent at de fortsatt kaster batterier i restavfallet.
              Hvert av disse representerer både tapte råstoffer og en unødvendig risiko.
            </CalloutGreenLight>

            <h2 style={h2Style}>Den viktigste grunnen: brannsikkerhet</h2>

            <p style={pStyle}>
              Det er lett å tro at et «tomt» batteri er ufarlig. Det stemmer ikke. Det er
              nesten alltid litt restenergi igjen i brukte batterier, og kommer polene i
              kontakt med metall – en nøkkel, en binders, et annet batteri – kan det
              oppstå en gnist. Litt som et tennstål. Én gnist er nok til å starte en brann.
            </p>

            <p style={pStyle}>
              Konsekvensene er godt dokumentert. Ifølge tall fra avfallsbransjen skyldes
              hele 85 prosent av brannene med kjent årsak på gjenvinningsanlegg nettopp
              batterier.{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer" style={extLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              advarer mot å kaste batterier i restavfallet, fordi det årlig påfører
              samfunnet store kostnader gjennom branner i avfallsbeholdere, i
              renovasjonsbiler og på sorteringsanlegg. Det er en risiko som starter hjemme
              hos den enkelte.
            </p>

            <blockquote style={{
              margin: '40px 0', padding: '28px 32px',
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Selv brukte batterier inneholder restenergi. Et fast, trygt sted for de
              tomme cellene er ikke bare ryddig – det er forebyggende brannvern.
            </blockquote>

            <h3 style={h3Style}>Slik oppbevarer du brukte batterier trygt</h3>

            <p style={pStyle}>Rådene fra brannvesen og returselskaper er enkle og samstemte:</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Teip polene på batteriene</strong> – gjerne med vanlig, gjennomsiktig
                tape. Dette gjelder spesielt 9V-batterier, litiumbatterier og
                knappcellebatterier, der pluss og minus ligger tett.
              </BulletItem>
              <BulletItem>
                <strong>Ha tape lett tilgjengelig</strong> akkurat der du oppbevarer
                batteriene, slik at det blir gjort med en gang.
              </BulletItem>
              <BulletItem>
                <strong>Samle dem på ett trygt sted</strong> med lokk, atskilt fra
                metallgjenstander.
              </BulletItem>
              <BulletItem>
                <strong>Lever jevnlig</strong> – ikke la store mengder hope seg opp hjemme.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Et eget, fast rom for de brukte cellene gjør hele denne rutinen enklere.
              Det er nettopp tanken bak det dedikerte rommet for brukte batterier i{' '}
              <Link href="/produkter/aboks" style={extLink}>aBoks</Link>: når de tomme
              batteriene har en naturlig plass ved siden av de nye, blir innlevering en
              vane i stedet for noe du stadig utsetter.
            </p>

            <h2 style={h2Style}>Norge er gode – men ikke gode nok</h2>

            <p style={pStyle}>
              Her er en sannhet med to sider. Norge er verdensledende på teknologi for
              gjenvinning av litium-ion-batterier fra blant annet elbiler, og innsamlingen
              av blybatterier er svært høy. Samtidig har vi historisk ligget lavt på
              innsamling av små husholdningsbatterier sammenlignet med de beste landene
              i Europa, der over 70 prosent samles inn.
            </p>

            <p style={pStyle}>
              Forskjellen handler sjelden om vilje. Folk vil gjerne gjøre det riktige –
              men de små batteriene blir liggende fordi det mangler et system hjemme. Når
              det ikke finnes et opplagt sted for de brukte, ender de i en skuff, og fra
              skuffen er veien kort til restavfallet ved neste storrydding. Løsningen er
              derfor like mye praktisk som moralsk: gjør det enkelt å gjøre det riktig.
            </p>

            <h2 style={h2Style}>Hvor leverer du brukte batterier?</h2>

            <p style={pStyle}>
              Det fine er at innlevering er gratis og tilgjengelig nesten overalt. Det
              finnes over 20 000 innleveringssteder i Norge. Du trenger ikke kjøre langt
              eller betale noe.
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Hvor', 'Hva du kan levere'].map((h) => (
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
                    [
                      'Dagligvarebutikker og kiosker',
                      'Alle butikker som selger batterier, plikter å ta imot samme type gratis. Mange har en egen batteriboks ved inngangen.',
                    ],
                    [
                      'Miljøstasjoner og gjenvinningsstasjoner',
                      'Tar imot alle typer batterier, også større og oppladbare.',
                    ],
                    [
                      'Elektronikkforhandlere',
                      'Tar ofte imot batterier og elektronikk med innebygde batterier.',
                    ],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 2 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top', color: '#4a4e41', lineHeight: 1.6,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={pStyle}>
              Husk å ta batterier ut av gamle leker, gratulasjonskort med lyd og annet
              elektronikk før du kasserer det – og lever batteriet for seg. Usikker på
              hva som gjelder i din kommune?{' '}
              <a href="https://www.sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Sortere.no
              </a>{' '}
              gir deg en oversikt basert på hvor du bor.
            </p>

            <h2 style={h2Style}>Slik kommer du i gang – fire enkle steg</h2>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberItem n={1}>
                <strong>Gi de brukte batteriene et fast sted.</strong> En egen beholder
                med lokk, atskilt fra de nye, er alt som skal til.
              </NumberItem>
              <NumberItem n={2}>
                <strong>Teip polene</strong> med en gang batteriet er tomt, mens du
                fortsatt husker det.
              </NumberItem>
              <NumberItem n={3}>
                <strong>Sett deg en enkel rutine</strong> – for eksempel å ta med
                batteriboksen på neste handletur når den er full.
              </NumberItem>
              <NumberItem n={4}>
                <strong>Lever inn jevnlig</strong> på butikken eller miljøstasjonen.
                Ferdig.
              </NumberItem>
            </ol>

            <Callout title="Et lite grep som monner">
              Mange av oss feiler ikke fordi vi ikke bryr oss, men fordi systemet hjemme
              mangler. Når nye og brukte batterier har hver sin faste plass, slutter de
              tomme å bli «glemt». Det er derfor god{' '}
              <Link href="/produkter" style={extLink}>batteriorganisering</Link>{' '}
              og riktig gjenvinning henger så tett sammen – orden er det som gjør den
              gode vanen mulig.
            </Callout>

            <h2 style={h2Style}>Vanlige misforståelser</h2>

            <h3 style={h3Style}>«Tomme batterier er helt utladet og dermed ufarlige»</h3>
            <p style={pStyle}>
              Feil. Det er nesten alltid restenergi igjen, og det er nettopp denne energien
              som kan gi gnist og brann ved kortslutning. Teip polene uansett hvor «dødt»
              batteriet føles.
            </p>

            <h3 style={h3Style}>«Det er bare oppladbare batterier som må gjenvinnes»</h3>
            <p style={pStyle}>
              Alle batterier, uansett type, er definert som farlig avfall i Norge og skal
              leveres til gjenvinning. Ingen batterier hører hjemme i restavfallet –
              heller ikke vanlige alkaliske AA og AAA.
            </p>

            <h3 style={h3Style}>«Ett lite batteri i søpla gjør ingen forskjell»</h3>
            <p style={pStyle}>
              Et enkelt feilsortert litiumbatteri i et gratulasjonskort har gjentatte
              ganger startet branner på norske avfallsmottak. Summen av mange små feil
              blir stor – men det samme blir summen av mange små, riktige valg.
            </p>

            <h2 style={h2Style}>Hva skjer egentlig med batteriet etter innlevering?</h2>

            <p style={pStyle}>
              Etter at du har levert inn, hentes batteriene av et godkjent returselskap og
              fraktes til sortering. Der deles de inn etter kjemisk sammensetning, fordi
              hver type krever sin egen behandling. I grove trekk blir batteriene utladet,
              nøytralisert, kvernet opp og separert til ulike bestanddeler, før metallene
              trekkes ut til ny produksjon. Nikkel går til stålindustrien, bly blir til nye
              blybatterier, og fra litium-ion-batterier hentes verdifull nikkel og kobolt
              ut igjen.
            </p>

            <p style={pStyle}>
              Resultatet er at vi sparer naturen for ny gruvedrift, kutter
              klimagassutslipp og holder giftstoffer ute av jord og vann. For
              litium-ion-batterier fra elbiler kan norske anlegg gjenvinne over 90 prosent
              av materialene – og produsere nye batterier med langt lavere karbonavtrykk
              enn om råstoffene kom fra jomfruelige kilder. Det lille batteriet du leverer
              på butikken, er en del av akkurat dette kretsløpet.
            </p>

            <h2 style={h2Style}>Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Må jeg virkelig teipe polene på vanlige AA-batterier?">
                Det anbefales sterkt, særlig hvis du samler mange batterier sammen.
                Teipingen hindrer at polene kortslutter mot hverandre eller mot metall.
                Det er spesielt viktig for 9V-, litium- og knappcellebatterier, men en
                god vane for alle typer.
              </FaqItem>
              <FaqItem question="Koster det noe å levere inn brukte batterier?">
                Nei. Innlevering er gratis. Alle butikker som selger batterier plikter å
                ta imot samme type uten betaling, og miljøstasjoner tar imot alle typer
                kostnadsfritt.
              </FaqItem>
              <FaqItem question="Kan jeg samle batterier over lang tid før jeg leverer?">
                Det anbefales å levere jevnlig fremfor å hope opp store mengder hjemme.
                Oppbevar dem trygt med teipede poler i en beholder med lokk, atskilt fra
                metall, og lever når beholderen er full.
              </FaqItem>
              <FaqItem question="Hva gjør jeg med batterier som sitter fast i elektronikk?">
                Forsøk å ta batteriet ut og lever det for seg. Er batteriet helt innebygd,
                leveres hele produktet som elektronisk avfall (EE-avfall) på en
                gjenvinningsstasjon eller hos en elektronikkforhandler.
              </FaqItem>
              <FaqItem question="Hvor finner jeg nærmeste innleveringssted?">
                Nesten alle dagligvarebutikker har en batteriboks. For en fullstendig
                oversikt tilpasset din kommune kan du sjekke{' '}
                <a href="https://www.sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  sortere.no
                </a>.
              </FaqItem>
            </div>

            {/* CTA */}
            <div style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(32px,3vw,48px) clamp(28px,3vw,44px)',
              textAlign: 'center', marginBottom: '48px',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 500,
                fontSize: 'clamp(26px,2.4vw,34px)', letterSpacing: '-0.015em',
                color: '#faf6ee', margin: '0 0 14px',
              }}>
                Gjør den gode vanen enkel
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                Når brukte batterier har sin egen faste plass, blir innlevering naturlig
                – ikke noe du stadig utsetter. aBoks samler nye og brukte batterier i
                én smart boks med tre rom, designet i Norge.
              </p>
              <Link
                href="/produkter/aboks"
                data-btn
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontFamily: 'var(--font-manrope)', fontWeight: 600,
                  fontSize: '14px', letterSpacing: '0.01em',
                  padding: '13px 32px', borderRadius: '999px',
                  background: '#5e6a48', color: '#faf6ee',
                  textDecoration: 'none',
                }}
              >
                Se aBoks
              </Link>
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
                  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB)', url: 'https://www.dsb.no/', note: 'om brannrisiko ved batterier i restavfall' },
                  { label: 'Miljødirektoratet', url: 'https://www.miljodirektoratet.no/', note: 'avfallsforskriften og krav til gjenvinning' },
                  { label: 'NORSIRK', url: 'https://norsirk.no/', note: 'slik gjenvinnes batteriene' },
                  { label: 'Statistisk sentralbyrå (SSB)', url: 'https://www.ssb.no/', note: 'avfalls- og gjenvinningsstatistikk' },
                  { label: 'Sortere.no', url: 'https://www.sortere.no/', note: 'innleveringssteder i din kommune' },
                ].map((s) => (
                  <li key={s.url} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '50%', background: '#9a9a8e', marginTop: '8px' }} />
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6 }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={extLink}>{s.label}</a>
                      {' '}– {s.note}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Tags */}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'Brukte batterier', 'Batterigjenvinning', 'Levere inn batterier',
                  'Brannsikkerhet', 'Batteriorganisering', 'Kildesortering',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
