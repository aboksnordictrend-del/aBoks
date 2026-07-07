import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'global-oppvarming-i-dag-hva-venter-oss',
    title: 'Global oppvarming i dag – hva venter oss i fremtiden?',
    description:
      'Global oppvarming er ikke lenger noe fjernt. Se hvordan klimaet i Norge allerede har endret seg, hva forskerne venter fremover, og hvilke grep som gjør hjemmet ditt tryggere.',
    ogTitle: 'Global oppvarming i dag – hva venter oss i fremtiden? | aBoks',
    ogDescription:
      'En grundig, kildebasert gjennomgang av global oppvarming i norsk kontekst – med fakta fra Miljødirektoratet og SSB, fremtidsscenarier, og praktiske råd om beredskap og bærekraft i hjemmet.',
  }),
  keywords: [
    'global oppvarming', 'klimaendringer', 'bærekraft', 'beredskap',
    'egenberedskap', 'batterier', 'Norge', 'aBoks',
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Global oppvarming i dag</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Bærekraftig hjem
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Global oppvarming i dag – hva venter oss i fremtiden?
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Global oppvarming er ikke lenger noe som skjer et annet sted, en gang i
              fremtiden. Den er allerede en del av hverdagen i Norge – i nedbørsmengden, i
              strømregningen og i beredskapsskapet. Her er en grundig og oppdatert
              gjennomgang av hva vi vet, hva som venter oss, og hvilke små grep i eget hjem
              som faktisk gjør en forskjell.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 8 min · Oppdatert juli 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <h2 style={{ ...h2Style, marginTop: 0 }}>Hva er global oppvarming, egentlig?</h2>

            <p style={pStyle}>
              Begrepet brukes ofte om hverandre med «klimaendringer», men de to tingene
              betyr ikke helt det samme. Global oppvarming beskriver konkret at den
              gjennomsnittlige temperaturen i atmosfæren og havet stiger, mens
              klimaendringer er en videre betegnelse som også omfatter endringer i
              nedbørsmønster, havstrømmer og ekstremvær. Drivhuseffekten er i
              utgangspunktet en helt naturlig og nødvendig prosess som gjør at jorden er
              levelig for oss. Problemet oppstår når menneskeskapte utslipp av CO₂, metan
              og andre klimagasser forsterker denne effekten langt utover det naturlige
              nivået.
            </p>

            <p style={pStyle}>
              Så godt som hele det internasjonale forskersamfunnet er enige om at denne
              utviklingen i all hovedsak er menneskeskapt, og at forbrenning av kull, olje
              og gass er den klart største kilden til utslippene som driver oppvarmingen
              videre.
            </p>

            <h2 style={h2Style}>Slik har klimaet i Norge allerede endret seg</h2>

            <p style={pStyle}>
              Mange tenker på global oppvarming som noe som først og fremst rammer andre
              deler av verden – smeltende isbreer i Arktis, tørke i Sør-Europa, stigende
              havnivå i Stillehavet. Men tallene fra norske fagmyndigheter viser at
              endringene allerede er godt synlige her hjemme også.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>Gjennomsnittstemperaturen i Norge har økt med rundt 1,4 grader siden 1901, og økningen har gått raskere de siste tiårene.</BulletItem>
              <BulletItem>Nedbørsmengdene over landet har i samme periode økt med omtrent 21 prosent.</BulletItem>
              <BulletItem>Flere av breene i Norge har blitt mindre, med Langfjordjøkelen i Finnmark som har krympet raskest.</BulletItem>
              <BulletItem>Permafrostområdene i myr og fjell er halvert sammenlignet med midten av 1900-tallet.</BulletItem>
              <BulletItem>Antallet varme sommerdager og kraftige styrtregn-episoder øker år for år, ifølge Meteorologisk institutt.</BulletItem>
            </ul>

            <p style={pStyle}>
              Samtidig går de norske klimagassutslippene sakte nedover. Foreløpige tall
              fra SSB viser at Norge slapp ut 44,1 millioner tonn CO₂-ekvivalenter i 2025,
              en nedgang på 13,9 prosent siden 1990 – men fortsatt et godt stykke unna
              målet om å kutte utslippene med minst 55 prosent innen 2030, slik Norge har
              forpliktet seg til gjennom Parisavtalen. Det aller meste av utslippene
              kommer fortsatt fra olje- og gassvirksomhet, industri og veitrafikk, mens
              husholdningenes direkte utslipp fra oppvarming utgjør en liten, men ikke
              ubetydelig andel.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Klimaendringene er ikke lenger en fremtidsprognose – de er en observert
              virkelighet i norsk natur, fra breene i nord til nedbørsmønsteret på
              Vestlandet.
            </blockquote>

            <h2 style={h2Style}>Hva sier fremskrivningene om fremtiden?</h2>

            <p style={pStyle}>
              Klimaforskere jobber med ulike utslippsscenarioer for å beregne hvor varmt
              det kan bli fremover. Disse spenner fra et lavutslippsscenario, hvor verden
              kutter kraftig, til et høyutslippsscenario der utslippene fortsetter å øke.
              Norsk klimaservicesenter har på oppdrag fra Miljødirektoratet oppdatert
              beregningene for hva de ulike banene kan bety for Norge frem mot slutten av
              århundret.
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Scenario', 'Global temperaturøkning', 'Hva det betyr for Norge'].map((h) => (
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
                    ['Lavutslipp', 'Rundt 1,5–2 °C', 'Moderat økning i nedbør og temperatur, håndterbare endringer med god tilpasning'],
                    ['Middels utslipp', 'Rundt 2–3 °C', 'Tydelig mer nedbør og flere styrtregn-episoder, kortere vintersesong'],
                    ['Høyutslipp', '2,8–4,6 °C', 'Gjennomsnittstemperaturen i Norge kan øke med ytterligere rundt 3,4 grader mot slutten av århundret, sammenlignet med perioden 1991–2020'],
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
              Uansett scenario peker forskningen i samme retning: mer nedbør, hyppigere
              styrtregn, økt risiko for flom og jordskred i utsatte områder, og et hav som
              blir varmere, surere og stiger langs kysten i lang tid fremover – selv om
              utslippene skulle kuttes kraftig i morgen. Det siste skyldes at havet bruker
              svært lang tid på å ta opp og fordele varme, som beskrevet av{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer" style={extLink}>Miljødirektoratet</a>.
            </p>

            <h2 style={h2Style}>Hvordan påvirker dette norske hjem og hverdagen vår?</h2>

            <p style={pStyle}>
              For de fleste av oss merkes ikke global oppvarming som en dramatisk
              hendelse, men som en serie små endringer: en kraftigere høststorm, et
              strømbrudd som varer noen timer for lenge, en flomstor bekk som plutselig
              når nærmere huset. Det er nettopp summen av slike hendelser som gjør at
              norske myndigheter nå oppfordrer alle husstander til å tenke gjennom egen
              beredskap på en helt annen måte enn for bare noen år siden.
            </p>

            <h3 style={h3Style}>Mer ekstremvær setter strømnettet på prøve</h3>

            <p style={pStyle}>
              Kraftigere og hyppigere uvær øker belastningen på strømnettet, og lengre
              strømbrudd blir en mer reell del av hverdagen enn tidligere. Norske
              myndigheter peker på at vi lever i en stadig mer urolig verden, blant annet
              som følge av klimaendringer, og at vi må være forberedt på at ekstremvær kan
              ramme oss.{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer" style={extLink}>Direktoratet for samfunnssikkerhet og beredskap (DSB)</a>{' '}
              anbefaler nå at husstander er rustet til å klare seg selv i opptil en uke
              dersom strøm, vann eller mobilnett faller ut.
            </p>

            <h3 style={h3Style}>Beredskap handler om enkle, konkrete ting</h3>

            <p style={pStyle}>
              Det høres kanskje dramatisk ut, men rådene fra DSB er påfallende praktiske.
              Blant det myndighetene trekker frem som viktigst å ha liggende hjemme er
              nettopp batterier, ladede powerbanker og en batteridrevet eller
              sveivedrevet DAB-radio, i tillegg til lommelykter, varme klær og lagret
              drikkevann. Poenget er ikke å skape unødig bekymring, men å gjøre familien i
              stand til å håndtere de små og store forstyrrelsene som et endret klima
              fører med seg – uten panikk og uten kaos.
            </p>

            <Callout label="Visste du dette?">
              Under uvær er det gjerne akkurat da man trenger lommelykten eller radioen at
              batteriene viser seg å være tomme, bortkomne i en skuff, eller feil
              størrelse. God beredskap handler minst like mye om orden som om innkjøp.
            </Callout>

            <h2 style={h2Style}>Praktiske grep for et mer bærekraftig og forberedt hjem</h2>

            <p style={pStyle}>
              Du kommer ikke til å løse den globale klimakrisen alene fra stuen din. Men
              et bevisst og velorganisert hjem gjør faktisk en forskjell – både for
              klimaregnskapet og for hvor godt rustet du er når været slår om. Her er noen
              konkrete grep som monner:
            </p>

            <div style={{ margin: '8px 0 28px', borderTop: '1px solid #ddd8ce' }}>
              <StepItem n={1} title="Reduser strømforbruket der du kan">
                Bytt til LED-belysning, senk innetemperaturen noen grader og bruk smarte
                tidsstyringer på varmekilder.
              </StepItem>
              <StepItem n={2} title="Bygg opp en enkel beredskapsreserve">
                Lagre vann, holdbar mat, lommelykt og ekstra batterier på et fast sted du
                husker under stress.
              </StepItem>
              <StepItem n={3} title="Sørg for at brukte batterier faktisk går til gjenvinning">
                Batterier som blir liggende eller kastes i restavfallet, går tapt for
                både miljøet og råvarekretsløpet. Les mer i vår guide om{' '}
                <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                  hvorfor det lønner seg å levere inn brukte batterier
                </Link>.
              </StepItem>
              <StepItem n={4} title="Velg kvalitet fremfor engangsforbruk">
                Oppladbare batterier og produkter som varer lenger, reduserer både avfall
                og unødvendig ressursbruk.
              </StepItem>
              <StepItem n={5} title="Hold oversikt i hjemmet generelt">
                Ryddige skuffer og faste plasser for utstyr gjør at du faktisk finner og
                bruker det du har, i stedet for å kjøpe nytt i panikk.
              </StepItem>
            </div>

            <h2 style={h2Style}>Batterier, beredskap og global oppvarming – en overraskende sammenheng</h2>

            <p style={pStyle}>
              Det er lett å tenke på batterier som en detalj i en mye større
              klimasamtale. Men i praksis er batterier noe av det aller mest sentrale når
              strømmen faktisk forsvinner en kald novemberkveld. Problemet i de fleste
              norske hjem er sjelden mangel på batterier – det er mangel på oversikt. Nye
              og brukte AA- og AAA-batterier havner om hverandre i en skuff, og når krisen
              først oppstår, er det ingen som vet hvilke som er fulle.
            </p>

            <p style={pStyle}>
              Dette er nøyaktig problemet <Link href="/" style={extLink}>aBoks</Link> er
              designet for å løse. Med tre adskilte rom for nye AA-batterier, nye
              AAA-batterier og et eget rom for brukte celler, gir boksen deg full
              oversikt på et øyeblikk – akkurat når du trenger det som mest. Samtidig blir
              det enklere å samle de brukte batteriene på ett sted, slik at de faktisk når
              frem til gjenvinning i stedet for å bli glemt i en skuff. Vil du vite mer om
              hvordan batterityper egner seg til ulikt bruk og oppbevaring, kan du lese
              vår guide til{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>.
            </p>

            <p style={pStyle}>
              Å ha en fast, oversiktlig plass for batteriene sine er et lite, konkret
              eksempel på noe større: at et bærekraftig og godt organisert hjem også er
              et tryggere hjem. Det handler om å redusere unødvendig forbruk, sørge for
              at ressurser faktisk gjenvinnes, og være forberedt på de endringene klimaet
              allerede fører med seg. Se flere av våre tanker om dette i artikkelen om{' '}
              <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                aBoks og fremtidens bærekraftige hjem
              </Link>.
            </p>

            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '40px 0' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les også</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                    Slik sorterer du batteriene riktig hjemme
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et ryddigere og tryggere hjem
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
              </ul>
            </div>

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
                Klar for et mer oversiktlig og forberedt hjem?
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                aBoks samler nye og brukte batterier på ett sted, slik at du alltid har
                oversikt – enten det er en helt vanlig hverdag eller kvelden strømmen går.
              </p>
              <Link
                href="/produkter/aboks?variant=ABOKS-OLIVE-001"
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

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }}>Ofte stilte spørsmål om global oppvarming</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hva er egentlig forskjellen på global oppvarming og klimaendringer?">
                Global oppvarming beskriver den målbare økningen i jordens
                gjennomsnittstemperatur, mens klimaendringer er et bredere begrep som
                også dekker endringer i nedbør, vind, havnivå og ekstremvær. I
                dagligtale brukes ofte begrepene om hverandre.
              </FaqItem>
              <FaqItem question="Hvor mye har det blitt varmere i Norge så langt?">
                Gjennomsnittstemperaturen i Norge har økt med rundt 1,4 grader siden
                1901, ifølge Miljødirektoratet, med en klart raskere endringstakt de
                siste tiårene enn tidligere i perioden.
              </FaqItem>
              <FaqItem question="Går klimagassutslippene i Norge opp eller ned?">
                Utslippene går gradvis nedover. Foreløpige tall fra SSB viser 44,1
                millioner tonn CO₂-ekvivalenter i 2025, en nedgang på 13,9 prosent
                siden 1990 – men fortsatt langt unna målet om 55 prosent kutt innen
                2030.
              </FaqItem>
              <FaqItem question="Hvordan kan jeg forberede hjemmet mitt på klimaendringer?">
                DSB anbefaler at husstander er rustet til å klare seg selv i inntil en
                uke uten strøm, vann eller mobilnett. Det innebærer blant annet lagret
                drikkevann, holdbar mat, lommelykter, en batteridrevet radio og et sett
                med ekstra batterier på en fast, lett tilgjengelig plass.
              </FaqItem>
              <FaqItem question="Hva kan jeg gjøre selv for å bidra i det små?">
                Redusert strømforbruk, riktig sortering og gjenvinning av batterier,
                bevisste kjøp av holdbare produkter, og et ryddig hjem der du faktisk
                finner og bruker det du eier, er alle konkrete grep som monner over
                tid.
              </FaqItem>
            </div>

            {/* Sources */}
            <div style={{ paddingTop: '28px', borderTop: '1px solid #ddd8ce' }}>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: '13px', color: '#1a1d17', margin: '0 0 14px',
              }}>
                Kilder
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {[
                  { label: 'Miljødirektoratet', url: 'https://www.miljodirektoratet.no/', note: 'dagens og fremtidens klima for Norge' },
                  { label: 'Statistisk sentralbyrå (SSB)', url: 'https://www.ssb.no/', note: 'utslipp til luft' },
                  { label: 'Regjeringen.no', url: 'https://www.regjeringen.no/', note: 'klimatilpasning i Norge' },
                  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB)', url: 'https://www.dsb.no/', note: 'råd om egenberedskap' },
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
                  'Global oppvarming', 'Klimaendringer', 'Bærekraft', 'Beredskap',
                  'Egenberedskap', 'Batterier', 'Norge',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
