import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Slik sorterer du batteriene riktig hjemme | Trygg guide',
  description:
    'Lær å sortere batteriene riktig hjemme – trygt, enkelt og miljøvennlig. Praktiske råd om oppbevaring, teiping av poler og levering til gjenvinning.',
  alternates: {
    canonical: '/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme',
  },
  keywords: [
    'batterisortering', 'kildesortering', 'batterigjenvinning',
    'brannsikkerhet hjemme', 'bærekraftig hjem', 'oppbevaring batterier',
    'skandinavisk design', 'smart hverdag',
  ],
  openGraph: {
    title: 'Slik sorterer du batteriene riktig hjemme | Trygg guide – aBoks',
    description:
      'En komplett guide til hvordan du sorterer batteriene riktig hjemme. Få vite hvorfor det forebygger brann, hvilke batterier som skal hvor, og hvordan en fast plass for nye og brukte batterier gir orden, sikkerhet og mindre sløsing.',
  },
}

/* ── Shared style tokens ── */
const p: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,17px)',
  lineHeight: 1.8,
  color: '#4a4e41',
  margin: '0 0 22px',
}

const h2: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(26px,2.4vw,34px)',
  letterSpacing: '-0.015em',
  lineHeight: 1.15,
  color: '#1a1d17',
  margin: '56px 0 18px',
}

const h3: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: 'clamp(16px,1.3vw,19px)',
  color: '#1a1d17',
  margin: '36px 0 14px',
}

const externalLink: React.CSSProperties = {
  color: '#39402c',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

const internalLink = externalLink

/* ── Bullet list item ── */
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

/* ── Numbered list item ── */
function NumberItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '6px 0' }}>
      <span style={{
        flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
        background: '#39402c', color: '#faf6ee',
        fontFamily: 'var(--font-manrope)', fontSize: '13px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: '4px',
      }}>{n}</span>
      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#4a4e41' }}>
        {children}
      </span>
    </li>
  )
}

/* ── Callout blocks ── */
function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      margin: '36px 0', padding: '24px 28px',
      background: '#fff', border: '1px solid #ddd8ce',
      borderRadius: '16px',
    }}>
      <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '14px', color: '#5e6a48', margin: '0 0 10px' }}>
        {title}
      </p>
      <div style={{ ...p, margin: 0 }}>{children}</div>
    </div>
  )
}

function CalloutGreen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      margin: '36px 0', padding: '24px 28px',
      background: '#39402c', borderRadius: '16px',
    }}>
      <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '14px', color: '#a9c08f', margin: '0 0 10px' }}>
        {title}
      </p>
      <div style={{ ...p, color: '#e8e4d9', margin: 0 }}>{children}</div>
    </div>
  )
}

/* ── FAQ item ── */
function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details style={{ borderBottom: '1px solid #ddd8ce' }}>
      <summary style={{
        cursor: 'pointer', padding: '18px 4px',
        fontFamily: 'var(--font-manrope)', fontWeight: 700,
        fontSize: 'clamp(15px,1.1vw,16px)', color: '#1a1d17',
        listStyle: 'none',
      }}>
        {question}
      </summary>
      <div style={{ padding: '0 4px 20px', ...p, margin: 0 }}>{children}</div>
    </details>
  )
}

/* ── Tag pill ── */
function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: '#eee9de', border: '1px solid #d8d2c7',
      borderRadius: '999px', padding: '5px 14px',
      margin: '4px 6px 4px 0',
      fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#4a4e41',
    }}>
      {label}
    </span>
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Slik sorterer du batteriene riktig hjemme</span>
        </div>

        {/* Article */}
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
              Slik sorterer du batteriene riktig hjemme
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Å sortere batteriene riktig hjemme er en av de enkleste tingene du kan gjøre
              for et tryggere hjem og en renere natur – og likevel er det få vaner som glipper
              så ofte. Et tomt AA-batteri fra fjernkontrollen havner i en skuff, et brukt
              knappcellebatteri ender i restavfallet, og før du vet ordet av det ligger det
              løse celler i kjøkkenskuffen, i sekken og i garasjen. I denne guiden går vi
              gjennom hvordan du får orden på batteriene én gang for alle, hvorfor det betyr
              mer enn de fleste tror, og hvilke grep som faktisk fungerer i en travel hverdag.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px',
              borderBottom: '1px solid #ddd8ce',
            }}>
              Skrevet av redaksjonen i aBoks · Oppdatert juni 2026 · Lesetid ca. 7 minutter
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <h2 style={h2}>Hvorfor riktig sortering av batterier betyr mer enn du tror</h2>

            <p style={p}>
              Vi tenker sjelden på batterier som farlig avfall. De er små, hverdagslige og
              virker harmløse når de er «tomme». Men et batteri er aldri helt tomt.{' '}
              <a href="https://norsirk.no/kildesortering/batteri/slik-leverer-du-batteriene/"
                target="_blank" rel="noopener noreferrer" style={externalLink}>
                Returselskapet NORSIRK
              </a>{' '}
              påpeker at det alltid er litt restenergi igjen, selv i et batteri som ikke lenger
              får liv i leken eller drillen. Kommer polene i kontakt med metall – en nøkkel,
              en mynt eller et annet batteri – kan det oppstå en gnist. Og en gnist i feil
              omgivelser er nok.
            </p>

            <p style={p}>
              Konsekvensene ser vi i statistikken.{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer" style={externalLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              registrerer i snitt én brann hver virkedag i norske avfallsanlegg, og rundt åtte
              av ti av disse skyldes batterier. I Oslo alene anslår plukkanalyser at omtrent
              to millioner batterier havner i restavfallet hvert år – bare rundt tre per
              innbygger, men nok til at brannvesenet rykker ut gang på gang til
              renovasjonsbiler og sorteringsanlegg som tar fyr.
            </p>

            <p style={p}>
              Det handler ikke bare om brann. Batterier inneholder verdifulle råstoffer som
              sink, nikkel, jern og litium. Når de leveres riktig, kan store deler av
              materialene{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer" style={externalLink}>
                gjenvinnes og brukes på nytt
              </a>{' '}
              – og vi slipper å hente nye ressurser ut av naturen. Sortering hjemme er med
              andre ord første ledd i en sirkulær kjede.
            </p>

            <blockquote style={{
              margin: '40px 0', padding: '28px 32px',
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '12px',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              «Det skal så lite til. Et tomt syltetøyglass er perfekt til oppbevaring –
              men det skal også lite til for å unngå brann: alle batterier kan leveres
              tilbake til butikken der du kjøpte dem.»
              <cite style={{
                display: 'block', marginTop: '14px',
                fontFamily: 'var(--font-manrope)', fontStyle: 'normal',
                fontSize: '13px', color: '#6b6f63',
              }}>
                Inspirert av Oslo brann- og redningsetat og Oslo kommune
              </cite>
            </blockquote>

            <h2 style={h2}>De vanligste misforståelsene om batterisortering</h2>

            <p style={p}>
              Mange tror de gjør alt riktig, men noen seiglivede myter lever fortsatt
              videre. Her er de vi møter oftest:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>«Vanlige AA-batterier kan kastes i restavfallet.»</strong> Det har
                vært forbudt å kaste batterier i restavfallet i Norge siden 2012. Alle
                batterier, også de helt alminnelige alkaliske, skal leveres til gjenvinning.
              </BulletItem>
              <BulletItem>
                <strong>«Bare litiumbatterier er farlige.»</strong> Litiumbatterier er særlig
                brannfarlige, men også vanlige husholdningsbatterier kan kortslutte og antenne
                hvis polene møter metall.
              </BulletItem>
              <BulletItem>
                <strong>«Et tomt batteri er ufarlig.»</strong> Det finnes alltid restenergi
                igjen. Derfor anbefales det å teipe polene før batteriet legges til side.
              </BulletItem>
              <BulletItem>
                <strong>«Jeg må kjøre til en gjenvinningsstasjon.»</strong> Du kan levere
                små batterier gratis i enhver butikk som selger samme type –
                dagligvarebutikker tar imot de vanligste.
              </BulletItem>
            </ul>

            <h2 style={h2}>Slik sorterer du batteriene riktig hjemme – steg for steg</h2>

            <p style={p}>
              God sortering begynner lenge før du leverer batteriene. Den begynner med et
              fast system hjemme. Slik gjør du det:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberItem n={1}>
                <strong>Skill nye fra brukte.</strong> Det største problemet i de fleste hjem
                er at fulle og tomme batterier ligger om hverandre. Da kaster vi gode
                batterier og lar de brukte bli liggende altfor lenge. Gi de nye og de brukte
                hver sin faste plass.
              </NumberItem>
              <NumberItem n={2}>
                <strong>Teip polene på brukte batterier.</strong> En liten bit plasttape over
                plusspolen hindrer kortslutning. Plast leder ikke strøm, så batteriet holder
                seg trygt selv om det kommer i kontakt med metall eller andre celler.
              </NumberItem>
              <NumberItem n={3}>
                <strong>Samle de brukte ett sted.</strong> Bruk en egen beholder – et
                lokk-glass, en boks eller et eget rom – slik at de brukte cellene faktisk når
                frem til gjenvinning og ikke ender i en skuff.
              </NumberItem>
              <NumberItem n={4}>
                <strong>Oppbevar trygt og tørt.</strong> Unngå å lagre løse batterier
                sammen med mynter, nøkler eller verktøy. Hold beholderen utenfor barns
                rekkevidde, særlig knappcellebatterier, som er farlige å svelge.
              </NumberItem>
              <NumberItem n={5}>
                <strong>Lever når beholderen er full.</strong> Ta med batteriene neste gang
                du uansett er innom butikken eller gjenvinningsstasjonen. Gjør det til en
                fast rutine, ikke et eget ærend.
              </NumberItem>
            </ol>

            <Callout title="Et lite triks som forhindrer brann">
              Teiping av polene er det enkleste og mest effektive sikkerhetstiltaket du kan
              gjøre hjemme. Det tar to sekunder per batteri og fjerner risikoen for at
              restenergien skaper varme sammen med andre batterier. Har du barn i huset,
              er dette spesielt viktig.
            </Callout>

            <h2 style={h2}>Hvilke batterier skal hvor?</h2>

            <p style={p}>
              Ikke alle batterier behandles likt. De minste kan du som regel levere i butikk,
              mens de store hører hjemme på gjenvinningsstasjonen. Her er en enkel oversikt:
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <caption style={{
                  textAlign: 'left', fontSize: '12px', color: '#6b6f63',
                  marginBottom: '10px', captionSide: 'top',
                }}>
                  Oversikt over vanlige batterityper og levering
                </caption>
                <thead>
                  <tr>
                    {['Batteritype', 'Hvor finnes de?', 'Hvor leveres de?'].map((h) => (
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
                    ['AA, AAA, 9V (alkaliske)', 'Fjernkontroll, leker, røykvarsler', 'Butikk eller gjenvinningsstasjon'],
                    ['Knappcellebatterier', 'Klokker, høreapparat, biltnøkkel', 'Butikk (teip polene først)'],
                    ['Litium-ion (oppladbare)', 'Mobil, PC, verktøy, elsykkel', 'Butikk eller gjenvinningsstasjon'],
                    ['Innebygde batterier', 'Elektronikk, leketøy med lyd/lys', 'Lever hele produktet som EE-avfall'],
                    ['Store batterier (bil, elsykkel)', 'Kjøretøy, større verktøy', 'Gjenvinningsstasjon eller forhandler'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 4 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top',
                          color: '#4a4e41',
                          lineHeight: 1.6,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ ...p, fontSize: '13px', color: '#6b6f63' }}>
              Kilder:{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer" style={externalLink}>DSB</a>,{' '}
              <a href="https://norsirk.no/" target="_blank" rel="noopener noreferrer" style={externalLink}>NORSIRK</a>{' '}
              og returordningene for batterier i Norge.
            </p>

            <h2 style={h2}>Nye trender: fra rot til system</h2>

            <p style={p}>
              De siste årene har flere norske renovasjonsselskap begynt å hente batterier
              rett fra husstandene i egne gjenvinningsposer, slik at terskelen for å sortere
              riktig blir lavere. Samtidig vokser interessen for smarte
              oppbevaringsløsninger i hjemmet – ikke som nok et plastprodukt, men som en
              gjennomtenkt del av interiøret.
            </p>

            <p style={p}>
              Det er her den skandinaviske tankegangen kommer til sin rett: en god løsning
              skal være enkel, vakker og funksjonell på samme tid. Når oppbevaringen ser
              bra ut og står fremme, blir den faktisk brukt. Et system som er gjemt bort i
              en skuff, glemmes. Et system som står synlig på kjøkkenbenken eller ved TV-en,
              blir en vane.
            </p>

            <h3 style={h3}>Når en fast plass gjør hele forskjellen</h3>

            <p style={p}>
              Det er nettopp denne tanken{' '}
              <Link href="/produkter/aboks" style={internalLink}>aBoks</Link>{' '}
              bygger på. Boksen gir hvert batteri sin egen plass – ett rom for nye AA, ett
              for nye AAA, og et eget rom for de brukte som skal til gjenvinning. Du ser på
              et blikk hva du har igjen, og hva som skal leveres. Det lille rommet for brukte
              batterier løser nettopp problemet de fleste sliter med: at de tomme cellene
              blir liggende i stedet for å nå frem til gjenvinningen.
            </p>

            <p style={p}>
              For mindre behov finnes også{' '}
              <Link href="/produkter/aboks-mini" style={internalLink}>aBoks Mini</Link>,
              med separate rom for nye og brukte AA-batterier. Begge er designet i Norge,
              med en matt finish som passer like godt på hjemmekontoret som på hytta.
              Poenget er ikke produktet i seg selv, men prinsippet: når brukte batterier
              har et eget, trygt rom, blir riktig sortering det enkleste valget –
              ikke det vanskeligste.
            </p>

            <CalloutGreen title="Tre vaner som monner">
              Skill nye fra brukte. Teip polene. Lever når beholderen er full. Gjør du
              disse tre tingene fast, har du i praksis fjernet både brannrisikoen og
              dårlig samvittighet – og bidratt til at verdifulle råstoffer kommer tilbake
              i kretsløpet. Vil du lese mer, finner du gode råd hos{' '}
              <a href="https://www.norsirk.no/" target="_blank" rel="noopener noreferrer"
                style={{ color: '#a9c08f', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                NORSIRK
              </a>.
            </CalloutGreen>

            <h2 style={h2}>Et tryggere og mer bærekraftig hjem</h2>

            <p style={p}>
              Riktig batterisortering er sjelden det første man tenker på når man vil ha et
              mer organisert hjem. Men det er et godt sted å begynne, nettopp fordi det er
              så konkret: en liten vane med store ringvirkninger for sikkerhet, miljø og ro
              i hverdagen. Når batteriene har en fast plass, slipper du å lete, du kaster
              færre gode batterier, og de brukte havner der de skal.
            </p>

            <p style={p}>
              Det er god skandinavisk husholdning i et nøtteskall – mindre rot, mindre
              sløsing, og litt mer omtanke for det vi har. Begynn med batteriene.
              Resten av hjemmet følger gjerne etter.
            </p>

            <h2 style={h2}>Ofte stilte spørsmål om batterisortering</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Kan jeg kaste vanlige AA-batterier i restavfallet?">
                Nei. Det har vært forbudt å kaste batterier i restavfallet i Norge siden
                2012. Alle batterier, også vanlige alkaliske AA- og AAA-batterier, skal
                leveres til gjenvinning – gratis i butikk eller på gjenvinningsstasjon.
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg teipe polene på brukte batterier?">
                Fordi det alltid er restenergi igjen i et brukt batteri. Hvis polene
                kommer i kontakt med metall eller andre batterier, kan det oppstå
                kortslutning og i verste fall brann. En bit plasttape over polene hindrer
                dette, fordi plast ikke leder strøm.
              </FaqItem>
              <FaqItem question="Hvor kan jeg levere brukte batterier?">
                Små husholdningsbatterier kan leveres gratis i alle butikker som selger
                samme type batteri – dagligvarebutikker tar imot de vanligste. Du kan
                også levere dem på nærmeste gjenvinningsstasjon. Større batterier, som
                bil- og elsykkelbatterier, leveres på gjenvinningsstasjon eller
                hos forhandler.
              </FaqItem>
              <FaqItem question="Er det farlig å oppbevare batterier hjemme?">
                Det er trygt så lenge du oppbevarer dem riktig: hold batteriene unna
                metallgjenstander, teip polene på brukte celler, og oppbevar dem tørt
                og utenfor barns rekkevidde. Knappcellebatterier er spesielt viktige
                å holde borte fra barn, da de er farlige å svelge.
              </FaqItem>
              <FaqItem question="Hva er den enkleste måten å holde orden på batteriene?">
                Gi nye og brukte batterier hver sin faste plass. Mange bruker et
                syltetøyglass med lokk til de brukte, mens andre velger en dedikert
                oppbevaringsboks med egne rom – som{' '}
                <Link href="/produkter/aboks" style={internalLink}>aBoks</Link> – slik at
                både nye AA, nye AAA og brukte batterier har sin egen plass og full
                oversikt.
              </FaqItem>
            </div>

            {/* Tags */}
            <div style={{
              paddingTop: '28px', borderTop: '1px solid #ddd8ce',
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63',
            }}>
              <span style={{ marginRight: '8px' }}>Tags:</span>
              {[
                'Batterisortering', 'Kildesortering', 'Gjenvinning',
                'Brannsikkerhet', 'Bærekraftig hjem', 'Skandinavisk design',
              ].map((t) => <Tag key={t} label={t} />)}
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
