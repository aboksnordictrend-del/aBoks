import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'hvilke-batterier-passer-til-hva',
    title: 'Hvilke batterier passer til hva? Den komplette guiden for hjemmet',
    description:
      'Hvilke batterier passer til hva? Lær forskjellen på alkaliske, litium og oppladbare AA- og AAA-batterier – og hvordan du velger riktig, oppbevarer trygt og gjenvinner rett.',
    ogTitle: 'Hvilke batterier passer til hva? Den komplette guiden for hjemmet | aBoks',
    ogDescription:
      'En praktisk og tillitsvekkende guide til batterityper for norske hjem. Vi forklarer hvilke batterier som passer til hva, vanlige misforståelser, brannsikker oppbevaring og riktig gjenvinning – med fersk innsikt fra norske miljømyndigheter.',
  }),
  keywords: [
    'batterityper', 'AA batterier', 'AAA batterier', 'alkaliske batterier',
    'litiumbatterier', 'oppladbare batterier', 'batterigjenvinning',
    'brannsikkerhet', 'hjemmeorganisering', 'batterioppbevaring',
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

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '34px 0', padding: '24px 30px', background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px' }}>
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvilke batterier passer til hva</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Hjem &amp; bærekraft
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(32px,4vw,56px)', letterSpacing: '-0.024em',
              lineHeight: 1.08, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvilke batterier passer til hva? Den komplette guiden for hjemmet
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Spørsmålet «hvilke batterier passer til hva?» dukker opp oftere enn de
              fleste tror – som regel idet fjernkontrollen dør midt i en film, eller når
              røykvarsleren piper klokka tre om natta. Denne guiden gir deg oversikten:
              hvilke batterityper som finnes, hvor de hører hjemme, og hvordan du
              oppbevarer og gjenvinner dem trygt.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen i aBoks · Oppdatert juni 2026 · Lesetid ca. 7 minutter
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Etter tjue år med å skrive om hjem, design og bærekraft har vi sett det
              samme mønsteret igjen og igjen: folk kjøper feil batteri til feil enhet,
              kaster batterier som fortsatt er fulle, og lar de brukte bli liggende altfor
              lenge. Resultatet er unødvendig pengebruk, dårligere ytelse på utstyret –
              og i verste fall en reell brannfare. Den gode nyheten er at det skal lite
              til for å rydde opp. Det starter med å forstå forskjellene.
            </p>

            <h2 style={h2Style}>De vanligste batteritypene – og hva de er gode til</h2>

            <p style={pStyle}>
              Husholdningsbatteriene våre er stort sett enten alkaliske eller
              litiumbaserte, og kommer i kjente størrelser som AA og AAA. Selv om to
              batterier kan se helt like ut på utsiden, kan kjemien inni gjøre stor
              forskjell for hvor lenge utstyret ditt fungerer.
            </p>

            <h3 style={h3Style}>Alkaliske batterier (AA, AAA, C, D)</h3>
            <p style={pStyle}>
              Dette er arbeidshesten i de fleste hjem. Et alkalisk batteri leverer 1,5
              volt og er bygget på en reaksjon mellom sink og mangandioksid. De er
              rimelige, finnes overalt og passer ypperlig til enheter med lavt og jevnt
              strømforbruk. Tenk fjernkontroller, veggur, vekkerklokker, datamus og
              enkle leker. Til hverdagsbruk gir alkaliske batterier rett og slett best
              valuta for pengene.
            </p>

            <h3 style={h3Style}>Litiumbatterier (engangs)</h3>
            <p style={pStyle}>
              Engangs litiumbatterier bruker litiummetall og leverer en stabilere
              spenning over lengre tid. De er lettere, tåler kulde langt bedre og holder
              seg gode i mange år ved lagring. Dette gjør dem til et trygt valg for
              utstyr der pålitelighet er kritisk: røykvarslere, digitalkameraer, GPS-er,
              friluftsutstyr og enheter som står ute i kulda. Du betaler mer per batteri,
              men slipper å bytte like ofte.
            </p>

            <h3 style={h3Style}>Oppladbare batterier (NiMH og litium-ion)</h3>
            <p style={pStyle}>
              Oppladbare NiMH-batterier i AA- og AAA-format kan lades hundrevis av ganger
              og er det mest miljøvennlige valget til utstyr du bruker mye – trådløse mus,
              spillkontrollere, blitser og leker som tømmer batteriene raskt. Litium-ion
              finner du som faste, innebygde batterier i mobiler, klokker, elektriske
              tannbørster og verktøy. Ett godt oppladbart batteri kan erstatte hundrevis
              av engangsbatterier over tid.
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Batteritype', 'Passer best til', 'Styrke'].map((h) => (
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
                    ['Alkalisk AA/AAA', 'Fjernkontroller, ur, mus, enkle leker', 'Rimelig og lett tilgjengelig'],
                    ['Litium (engangs)', 'Røykvarslere, kamera, friluftsutstyr', 'Lang levetid, tåler kulde'],
                    ['Oppladbar NiMH', 'Spillkontroller, blits, leker med høyt forbruk', 'Gjenbrukbar, miljøvennlig'],
                    ['Litium-ion (innebygd)', 'Mobil, klokke, verktøy, tannbørste', 'Høy energitetthet'],
                    ['Knappcelle (CR2032 m.fl.)', 'Bilnøkler, vekt, hørselsapparat', 'Kompakt og stabil'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 4 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top', color: '#4a4e41', lineHeight: 1.6,
                          fontWeight: j === 0 ? 600 : 400,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={h2Style}>Vanlige misforståelser om batterier</h2>

            <p style={pStyle}>
              Når vi rådfører oss med fagfolk i gjenvinningsbransjen, går de samme
              misforståelsene igjen. Her er de tre vi oftest møter:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>«Større batteri = mer kraft.»</strong> Ikke nødvendigvis. Et AA
                og et AAA leverer samme spenning (1,5 V) – forskjellen er kapasitet og
                fysisk størrelse. Bruk alltid den størrelsen enheten er laget for.
              </BulletItem>
              <BulletItem>
                <strong>«Jeg kan blande gamle og nye batterier.»</strong> Det bør du la
                være. Ytelsen styres av det svakeste batteriet, og en blanding av nytt og
                gammelt – eller ulike typer – kan føre til lekkasje og dårlig drift.
              </BulletItem>
              <BulletItem>
                <strong>«Et tomt batteri er helt tomt.»</strong> Det er nesten alltid
                litt restenergi igjen. Det er nettopp derfor brukte batterier må håndteres
                riktig.
              </BulletItem>
            </ul>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Et batteri er ikke dødt selv om det er «brukt opp». Det vil alltid ha litt
              restenergi igjen – og nettopp derfor må alle batterier leveres til
              gjenvinning.
            </blockquote>

            <h2 style={h2Style}>Sikkerhet først: hvorfor brukte batterier ikke kan ligge løst</h2>

            <p style={pStyle}>
              Dette er den delen flest hopper over – og den som betyr mest. Selv et
              tilsynelatende tomt batteri kan ha nok strøm igjen til å skape gnister hvis
              polene kommer i kontakt med metall eller med hverandre. I en roteskuff full
              av løse batterier, binders og nøkler er det en reell risiko for kortslutning.
            </p>

            <p style={pStyle}>
              Ifølge{' '}
              <a href="https://www.norskindustri.no/bransjer/gjenvinning/ikke-kast-brukte-batterier-i-restavfallet/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Norsk Industri
              </a>{' '}
              skyldes nesten 85 % av brannene på gjenvinningsanlegg med kjent årsak
              feilsorterte batterier. Renovasjonsselskaper melder om hundrevis av
              branntilløp hvert år, og{' '}
              <a href="https://norsirk.no/" target="_blank" rel="noopener noreferrer" style={extLink}>
                Norsirk
              </a>{' '}
              understreker at feilsorterte batterier utgjør en risiko gjennom hele kjeden
              – fra hjemmet ditt til bossbilen og anlegget. Brannvesenet og
              gjenvinningsbransjen gir derfor det samme, enkle rådet:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberItem n={1}><strong>Teip polene</strong> på brukte batterier, slik at de ikke kan kortslutte mot hverandre.</NumberItem>
              <NumberItem n={2}><strong>Samle dem ett fast sted</strong> i en trygg beholder – ikke spredt utover i skuffer og sekker.</NumberItem>
              <NumberItem n={3}><strong>Lever inn regelmessig</strong> i stedet for å samle store mengder hjemme.</NumberItem>
            </ol>

            <Callout label="Visste du at…">
              Nordmenn kjøper over 2 000 tonn husholdningsbatterier i året. Materialene
              – sink, kobolt, litium og nikkel – kan brukes om igjen i nye batterier hvis
              vi leverer dem til gjenvinning i stedet for å la dem ligge i en skuff.
            </Callout>

            <h2 style={h2Style}>Slik gjenvinner du batterier riktig i Norge</h2>

            <p style={pStyle}>
              Det norske systemet er nesten overraskende enkelt. Alle som selger batterier
              er lovpålagt å ta dem imot igjen – helt gratis. Du kan altså levere brukte
              batterier i butikken der du handler, eller på en bemannet
              gjenvinningsstasjon. Et godt knep er å ta dem med samtidig som du panter
              flasker; da blir det en naturlig del av rutinen.
            </p>

            <p style={pStyle}>
              Husk hovedregelen, som{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer" style={extLink}>
                miljømyndighetene
              </a>{' '}
              er tydelige på: batterier regnes som farlig avfall og skal aldri i
              restavfallet. Det gjelder også de små som skjuler seg i bursdagskort med
              lyd, gamle leker og elektroniske dingser. Innebygde batterier i utstyr du
              ikke lenger bruker, bør leveres samlet med produktet til godkjent mottak.
            </p>

            <h2 style={h2Style}>Det enkle systemet som binder det hele sammen</h2>

            <p style={pStyle}>
              Når du først forstår hvilke batterier som passer til hva, er den neste
              utfordringen praktisk: hvordan holder du orden på de fulle, de brukte og de
              ulike størrelsene – uten at det blir kaos? Det er her et fast
              oppbevaringssystem gjør hverdagen merkbart enklere.
            </p>

            {/* Product callout */}
            <div style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(28px,3vw,44px) clamp(24px,3vw,40px)',
              margin: '44px 0',
            }}>
              <h3 style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 500,
                fontSize: 'clamp(22px,2vw,30px)', letterSpacing: '-0.01em',
                color: '#faf6ee', margin: '0 0 14px',
              }}>
                aBoks – orden i batterikaoset
              </h3>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.7, color: '#c8cebb', margin: '0 0 14px' }}>
                <Link href="/produkter/aboks" style={{ color: '#faf6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>aBoks</Link>{' '}
                er en norskdesignet batteriboks med tre adskilte rom: ett for nye
                AA-batterier, ett for nye AAA og ett eget rom for de brukte som skal til
                gjenvinning. Du ser på et blikk hva du har igjen og hva som skal leveres
                inn – og de brukte batteriene får et trygt sted å være frem til neste tur
                til butikken, i stedet for å ligge løst i skuffen.
              </p>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(14px,1vw,16px)', lineHeight: 1.7, color: '#c8cebb', margin: '0 0 22px' }}>
                Med plass til 20 AA- og 36 AAA-batterier, et matt og slitesterkt design
                og fire farger å velge mellom, passer den like godt på kjøkkenbenken som
                i boden eller på hytta. Det er den lille vanen som gjør at gode batterier
                ikke kastes, og at brukte faktisk når gjenvinningen.
              </p>
              <Link
                href="/produkter/aboks"
                data-btn
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                  letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                  background: '#5e6a48', color: '#faf6ee', textDecoration: 'none',
                }}
              >
                Se aBoks her
              </Link>
            </div>

            <h2 style={h2Style}>Nye trender: mot mer litium og smartere lading</h2>

            <p style={pStyle}>
              Utviklingen går tydelig i én retning. Stadig flere enheter vi før kjørte på
              alkaliske batterier – inkludert mange røykvarslere – leveres nå med
              litiumbatterier for lengre levetid. Samtidig blir oppladbare NiMH-batterier
              laget av resirkulert materiale stadig mer utbredt, uten at det går på
              bekostning av ytelsen. For deg som forbruker betyr det at det å velge
              riktig batteri i økende grad også er et bærekraftsvalg.
            </p>

            <p style={pStyle}>
              Vårt råd til de fleste hjem: ha alkaliske AA og AAA til hverdagsutstyret,
              litium til det viktige og kalde, og oppladbare til det du tømmer ofte. Da
              har du alltid riktig batteri for hånden – og færre batterier som havner på
              avveie.
            </p>

            <div style={{ height: '1px', background: '#ddd8ce', margin: '52px 0' }} />

            <h2 style={{ ...h2Style, margin: '0 0 18px' }}>Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvilke batterier passer til røykvarsler?">
                De fleste røykvarslere bruker 9V- eller AA-batterier, og mange nyere
                modeller leveres med litiumbatterier for lengre levetid. Sjekk alltid
                manualen, og velg gjerne litium der det er mulig – de tåler
                temperaturvariasjoner og holder lenger.
              </FaqItem>
              <FaqItem question="Kan jeg blande alkaliske og oppladbare batterier i samme enhet?">
                Nei. Bland aldri ulike batterityper – eller gamle og nye batterier – i
                samme enhet. Ytelsen begrenses av det svakeste batteriet, og det øker
                risikoen for lekkasje. Bytt alltid alle batteriene i en enhet samtidig.
              </FaqItem>
              <FaqItem question="Hva er forskjellen på AA og AAA?">
                Begge leverer 1,5 volt, men AAA er fysisk mindre og har lavere kapasitet.
                Bruk alltid størrelsen enheten er laget for – et AAA passer ikke i et
                AA-rom, og omvendt.
              </FaqItem>
              <FaqItem question="Må jeg virkelig teipe polene på brukte batterier?">
                Ja, det anbefales sterkt. Selv «tomme» batterier har restenergi. Når
                polene kommer i kontakt med metall eller andre batterier, kan det oppstå
                kortslutning og i verste fall brann. En liten bit teip over hver pol
                fjerner risikoen.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg brukte batterier?">
                Alle butikker som selger batterier er pliktige til å ta imot brukte
                batterier gratis. Du kan også levere dem på en gjenvinningsstasjon. Lever
                inn jevnlig fremfor å samle opp store mengder hjemme.
              </FaqItem>
            </div>

            {/* Sources */}
            <div style={{ paddingTop: '28px', borderTop: '1px solid #ddd8ce' }}>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: '13px', color: '#1a1d17', margin: '0 0 14px',
              }}>
                Kilder og videre lesing
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                {[
                  { label: 'Miljødirektoratet', url: 'https://www.miljodirektoratet.no/', note: 'om farlig avfall og avfallsforskriften' },
                  { label: 'Norsirk', url: 'https://norsirk.no/', note: 'produsentansvar og gjenvinning av batterier' },
                  { label: 'Norsk Industri', url: 'https://www.norskindustri.no/bransjer/gjenvinning/ikke-kast-brukte-batterier-i-restavfallet/', note: 'brannrisiko ved feilsortering' },
                  { label: 'SSB', url: 'https://www.ssb.no/', note: 'statistikk om avfall og gjenvinning' },
                  { label: 'DSB', url: 'https://www.dsb.no/', note: 'brannsikkerhet i hjemmet' },
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

              {/* Tags */}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {['Batterityper', 'AA batterier', 'AAA batterier', 'Oppladbare', 'Batterigjenvinning', 'Brannsikkerhet'].map((t) => (
                  <Tag key={t} label={t} />
                ))}
              </div>

              {/* Disclaimer */}
              <p style={{
                marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #ece8e1',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#696a62', lineHeight: 1.7, fontStyle: 'italic',
              }}>
                Denne artikkelen er utarbeidet av redaksjonen i aBoks med utgangspunkt i
                råd fra norske miljø- og gjenvinningsmyndigheter. Innholdet er ment som
                veiledning og erstatter ikke produsentens egne anvisninger for din
                spesifikke enhet.
              </p>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
