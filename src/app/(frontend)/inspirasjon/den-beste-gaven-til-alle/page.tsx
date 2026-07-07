import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'den-beste-gaven-til-alle',
    title: 'Den beste gaven til alle – praktisk, enkel og alltid nyttig',
    description:
      'Sliter du med å finne en gave som passer alle? Få kriteriene for den perfekte allround-gaven, pluss konkrete idéer som treffer uansett hvem du gir til.',
    ogTitle: 'Den beste gaven til alle – praktisk, enkel og alltid nyttig | aBoks',
    ogDescription:
      'En komplett guide til hvordan du velger en praktisk gave til alle – med sjekkliste, konkrete gaveidéer, bærekraftstips og ekspertråd fra norske kilder som DSB, NORSIRK og Miljødirektoratet.',
  }),
  keywords: [
    'praktisk gave til alle', 'gavetips', 'praktiske gaver', 'bærekraftige gaver',
    'batteriboks', 'hjemorganisering', 'gjenvinning',
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

function ProductHighlight({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#39402c', borderRadius: '20px', padding: 'clamp(28px,3vw,40px)', margin: '40px 0' }}>
      <p style={{
        fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(20px,1.8vw,26px)',
        letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 16px',
      }}>
        {title}
      </p>
      <div style={{ ...pStyle, color: '#c8cebb', margin: 0 }}>{children}</div>
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

function Cite({ n }: { n: number }) {
  return (
    <sup>
      <a href={`#kilde-${n}`} style={{ color: '#39402c', fontWeight: 700, textDecoration: 'none' }}>
        {n}
      </a>
    </sup>
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Den beste gaven til alle</span>
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
              Den beste gaven til alle – praktisk, enkel og alltid nyttig
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Den beste gaven til alle er sjeldnere den mest spektakulære, og oftere den
              som faktisk blir brukt. Her får du kriteriene en erfaren gavegiver ser
              etter, og noen konkrete idéer som treffer uansett hvem du gir til.
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

            <p style={pStyle}>
              Du kjenner situasjonen. Bursdagen nærmer seg, eller julen kommer snikende
              slik den alltid gjør, og du står der med et navn på en liste og ingen
              anelse om hva du skal gi. Vedkommende «har jo alt», eller så kjenner du dem
              ikke godt nok til å vite akkurat hvilken farge, størrelse eller smak som
              treffer. I den situasjonen er det fristende å gripe til det første som
              virker trygt – et gavekort, en boks konfekt, kanskje et lys. Men det finnes
              en tredje vei, og den handler ikke om å finne noe unikt og overraskende for
              hver eneste person. Den handler om å forstå hva som gjør en gave god,
              uansett hvem som pakker den opp.
            </p>

            <h2 style={h2Style}>Hvorfor «trygge» gaver ofte bommer</h2>

            <p style={pStyle}>
              Ifølge Virkes prognoser for julehandelen bruker hver av oss i gjennomsnitt
              rundt 26 700 kroner på julegaver, mat og drikke i løpet av november og
              desember.<Cite n={1} /> Det er betydelige summer som legges ned i noe som i
              altfor mange tilfeller ender i en skuff, en garasje eller – i verste fall –
              i restavfallet i januar. Problemet er sjelden at giveren mangler godvilje.
              Problemet er at vi ofte forveksler «personlig» med «unikt», og «unikt» med
              «komplisert».
            </p>

            <p style={pStyle}>
              En vanlig misforståelse er at en god gave må være overraskende eller
              original for å vise omtanke. I praksis er det ofte motsatt: de gavene som
              blir brukt lengst, og som mottakeren husker best, er de som løser et lite
              problem i hverdagen på en elegant måte. Det trenger ikke å skinne for å bety
              noe.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              En gave som fortsatt er i bruk et år senere, har gitt mer glede enn ti
              gaver som ble lagt vekk samme kveld.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Erfaring fra tjue år med redaksjonelt arbeid med hjem og livsstil
              </footer>
            </blockquote>

            <h2 style={h2Style}>Sju kriterier for den universelle gaven</h2>

            <p style={pStyle}>
              Når du skal finne en gave som passer «alle» – kollegaen, svigerfar, en
              nabo, eller en venn du ikke har sett på en stund – er det noen kjennetegn
              som går igjen hos gaver som faktisk lander godt:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem><strong>Den løser et konkret problem.</strong> Ikke en drøm eller et ønske, men en liten friksjon i hverdagen som forsvinner.</BulletItem>
              <BulletItem><strong>Den krever ingen forkunnskap om mottakeren.</strong> Du trenger ikke vite størrelse, stil eller musikksmak.</BulletItem>
              <BulletItem><strong>Den har lang levetid.</strong> Kvalitet fremfor kvantitet – noe som holder i årevis, ikke uker.</BulletItem>
              <BulletItem><strong>Den er nøytral i uttrykk.</strong> Passer inn i de fleste hjem, uavhengig av innredningsstil.</BulletItem>
              <BulletItem><strong>Den er lett å pakke inn og transportere.</strong> Ingen skjøre deler, ingen kompliserte størrelser.</BulletItem>
              <BulletItem><strong>Den har en bærekraftig side.</strong> Noe som reduserer avfall eller forlenger levetiden på noe annet, gir gaven en ekstra dimensjon.</BulletItem>
              <BulletItem><strong>Den gir mening også etter at emballasjen er kastet.</strong> Den beste gaven glemmes ikke i skuffen – den blir en del av rutinen.</BulletItem>
            </ul>

            <p style={pStyle}>
              Legg merke til at «dyrt» ikke er på listen. Prisen sier lite om hvor godt
              en gave treffer. Det gjør derimot hvor ofte gjenstanden faktisk tas i bruk.
            </p>

            <h2 style={h2Style}>Konkrete gaveidéer som passer (nesten) alle</h2>

            <p style={pStyle}>
              Med kriteriene over som bakteppe, er det noen kategorier av gaver som
              gjennomgående scorer høyt – enten du gir til familie, kolleger eller
              naboer:
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Gavekategori', 'Hvorfor den fungerer', 'Passer til'].map((h) => (
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
                    ['Smart oppbevaringsløsning (f.eks. batteriboks)', 'Løser et konkret rotproblem de fleste hjem har, uten å kreve stil- eller smaksvalg', 'Alle aldre og boligtyper'],
                    ['Gjenbrukbart kjøkkentilbehør', 'Erstatter engangsprodukter, brukes daglig', 'Alle som lager mat'],
                    ['Opplevelsesgave', 'Ingen fysisk gjenstand å plassere, skaper minner fremfor ting', 'De som «har alt»'],
                    ['Gavekort til en butikk med bevisst profil', 'Gir mottakeren frihet til å velge selv, uten bomkjøp', 'Når du er usikker på smak'],
                    ['Kvalitetsprodukt til hverdagsbruk', 'Lang levetid gjør at gaven «betaler tilbake» over tid', 'Kolleger, naboer, fjernere familie'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 4 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top', color: '#4a4e41', lineHeight: 1.6,
                        }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={h2Style}>Den lille tingen ingen tenker på – men alle trenger</h2>

            <p style={pStyle}>
              Blant kategoriene over er det én som skiller seg ut, nettopp fordi den er
              så usynlig i hverdagen at nesten ingen kjøper den til seg selv – men nesten
              alle har behov for den. Det handler om batterier. De fleste hjem har en
              skuff, en pose eller en boks fylt med løse AA- og AAA-batterier, blandet
              med brukte celler ingen helt vet om er tomme eller ikke. Det er akkurat den
              typen rot som gjør en oppbevaringsløsning til en overraskende god gave: den
              er nyttig fra dag én, den krever ingen smak, og den er noe folk sjelden
              prioriterer å kjøpe selv.
            </p>

            <p style={pStyle}>
              Her kommer også sikkerhetsaspektet inn.{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer" style={extLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              peker på at feil håndtering av batterier – blant annet at poler kommer i
              kontakt med metall eller andre batterier – kan utgjøre en
              brannrisiko.<Cite n={2} /> Løse batterier i en skuff sammen med nøkler
              eller mynt er nettopp en slik risikosituasjon. En gave som gir batteriene
              en fast, adskilt plass, er derfor ikke bare praktisk – den er også et lite
              bidrag til et tryggere hjem.
            </p>

            <ProductHighlight title="Derfor er aBoks en gave som treffer bredt">
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                <Link href="/produkter/aboks?variant=ABOKS-OLIVE-001" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks
                </Link>{' '}
                er designet nettopp for denne hverdagsutfordringen: én boks, tre
                atskilte rom – ett for nye AA-batterier, ett for nye AAA-batterier, og
                ett eget rom for de brukte som venter på levering til gjenvinning. Boksen
                kommer i tre nøytrale farger som passer i de fleste hjem, enten den står
                på kjøkkenbenken, i entreen eller på hjemmekontoret. Det gjør den til en
                gave du kan gi uten å kjenne mottakerens interiørsmak i detalj – noe som
                er sjelden i gavekategorien «praktiske produkter».
              </p>
              <p style={{ ...pStyle, color: '#c8cebb', margin: 0 }}>
                Fordi den også gir brukte batterier en tydelig, egen plass, gjør aBoks
                det enklere for mottakeren å faktisk levere dem til gjenvinning i stedet
                for at de blir liggende. Det er en liten detalj som følger prinsippet om
                at den beste gaven ikke bare gleder i øyeblikket, men fortsetter å gjøre
                nytte for seg lenge etter at papiret er kastet.
              </p>
            </ProductHighlight>

            <h2 style={h2Style}>Bærekraft: gaven som fortsetter å gi</h2>

            <p style={pStyle}>
              Norge har et regulert system for batterigjenvinning, forankret i
              avfallsforskriften, hvor importører og produsenter har et lovpålagt
              produsentansvar for innsamling og behandling.<Cite n={3} /> Returselskaper
              som NORSIRK sørger for at batteriene sorteres etter kjemi og behandles slik
              at verdifulle metaller kan gå tilbake inn i produksjon av nye produkter,
              samtidig som helse- og miljøskadelige stoffer som kvikksølv i
              knappcellebatterier tas hånd om på en trygg måte.<Cite n={4} /> Skal dette
              systemet fungere i praksis, er det avhengig av at batteriene faktisk finner
              veien ut av skuffen og til en innsamlingsboks – noe som starter med gode
              vaner hjemme.
            </p>

            <p style={pStyle}>
              Å gi en gave som gjør denne jobben litt enklere for mottakeren, er derfor
              mer enn en praktisk gest. Det er en liten investering i
              sirkulærøkonomien, helt konkret og målbart. Miljødirektoratet arbeider
              løpende med å styrke datagrunnlaget for avfall og gjenvinning i
              Norge,<Cite n={5} /> og hver husholdning som sorterer riktig bidrar til et
              bedre kunnskapsgrunnlag og en renere materialstrøm.
            </p>

            <h3 style={h3Style}>Andre bærekraftige gavevalg å vurdere</h3>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem><strong>Bivokspapir eller gjenbrukbare matposer</strong> – erstatter plastfolie i kjøkkenet, brukes om igjen i årevis.</BulletItem>
              <BulletItem><strong>Gavekort med utløpsdato langt frem i tid</strong> – reduserer risikoen for bomkjøp og impulskjøp mottakeren ikke ønsker.</BulletItem>
              <BulletItem><strong>Opplevelser i naturen eller nærmiljøet</strong> – ingen emballasje, ingen produksjonsavfall, bare minner.</BulletItem>
              <BulletItem><strong>Reparasjon eller vedlikeholdssett</strong> – forlenger levetiden på noe mottakeren allerede eier.</BulletItem>
            </ul>

            <h2 style={h2Style}>Slik pakker du inn en praktisk gave med stil</h2>

            <p style={pStyle}>
              En praktisk gave trenger ikke se kjedelig ut. Bruk enkelt papir i
              naturlige farger – kraftpapir, resirkulert papir eller stoff i
              furoshiki-stil – og legg gjerne ved et personlig kort som forklarer
              hvorfor du valgte akkurat denne gaven. Det er detaljen som gjør at selv
              den mest nøkterne gjenstand føles gjennomtenkt. Unngå glanset og laminert
              gavepapir dersom du ønsker at innpakningen også skal være miljøvennlig;
              slikt papir kan ikke materialgjenvinnes og skal i restavfallet.<Cite n={6} />
            </p>

            <p style={pStyle}>
              Vil du gå enda lenger i den bærekraftige retningen, kan selve emballasjen
              være en del av gaven – en liten kurv, et glass eller en boks som
              mottakeren kan bruke videre. Da får du to gaver i én: innpakningen og
              innholdet.
            </p>

            <Callout label="Rask sjekkliste før du kjøper">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>Løser gaven et konkret problem, eller er den bare «fin å ha»?</BulletItem>
                <BulletItem>Vil den fortsatt være i bruk om ett år?</BulletItem>
                <BulletItem>Passer den inn uansett stil og smak?</BulletItem>
                <BulletItem>Har den en bærekraftig dimensjon?</BulletItem>
              </ul>
            </Callout>

            <p style={pStyle}>
              Hvis du kan svare ja på minst tre av disse fire spørsmålene, er sjansen
              stor for at du har funnet en gave som treffer. Enkelhet er ofte
              undervurdert i gavesammenheng – men det er nettopp enkelheten som gjør at
              en gave kan gis til nesten hvem som helst, uten å måtte gjette seg frem til
              smak og preferanser.
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
                Klar for å gi en gave som faktisk blir brukt?
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                aBoks samler nye og brukte batterier i én oversiktlig boks – en liten,
                gjennomtenkt gave som gir orden fra dag én.
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

            <p style={pStyle}>
              Se også vår guide til{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                hvordan du sorterer batteriene riktig hjemme
              </Link>, eller les mer om{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>{' '}
              dersom mottakeren av gaven også trenger påfyll av batterier.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }}>Ofte stilte spørsmål om praktiske gaver</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hva er den mest universelle gaven man kan gi?">
                Gaver som løser en liten, konkret hverdagsutfordring – som orden,
                oppbevaring eller redusert avfall – treffer bredest, fordi de ikke
                krever kunnskap om mottakerens personlige smak eller stil.
              </FaqItem>
              <FaqItem question="Er praktiske gaver mindre personlige enn andre gaver?">
                Ikke nødvendigvis. Det personlige ligger ofte i hvordan gaven
                presenteres – et håndskrevet kort, en gjennomtenkt innpakning eller en
                forklaring på hvorfor du valgte akkurat denne gaven – ikke i hvor
                uvanlig selve gjenstanden er.
              </FaqItem>
              <FaqItem question="Hvordan vet jeg om en gave er bærekraftig?">
                Se etter produkter med lang levetid, som reduserer bruk av
                engangsmateriell, eller som gjør det enklere å sortere og gjenvinne
                avfall riktig. Norske returselskaper som NORSIRK og myndigheter som
                Miljødirektoratet publiserer oppdatert informasjon om gjenvinning og
                produsentansvar.
              </FaqItem>
              <FaqItem question="Hvorfor er en batteriboks en god gave?">
                Fordi nesten alle hjem har løse batterier liggende, men svært få
                prioriterer å kjøpe en ordentlig oppbevaringsløsning selv. Det gjør en
                batteriboks til en gave som er nyttig fra første dag, samtidig som den
                bidrar til tryggere oppbevaring og enklere gjenvinning.
              </FaqItem>
              <FaqItem question="Hva bør jeg unngå når jeg gir gaver til noen jeg ikke kjenner så godt?">
                Unngå gjenstander som krever kunnskap om størrelse, stil eller smak,
                som klær eller smykker. Velg heller noe funksjonelt og nøytralt som
                passer inn i de fleste hjem og hverdager.
              </FaqItem>
            </div>

            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les også</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et ryddigere og tryggere hjem
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
                  <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                    aBoks og fremtidens bærekraftige hjem
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva? Den komplette guiden
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
                Kilder
              </p>
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {[
                  { label: 'Virke, Prognoser for julehandelen', url: 'https://www.virke.no/analyse/julehandel/' },
                  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB)', url: 'https://www.dsb.no/' },
                  { label: 'NORSIRK, Slik gjenvinnes batteriene', url: 'https://norsirk.no/kildesortering/batteri/slik-gjenvinnes-batteriene/' },
                  { label: 'NORSIRK, Produsentansvar: Batteri', url: 'https://info.norsirk.no/produsentansvar/batteri' },
                  { label: 'Miljødirektoratet', url: 'https://www.miljodirektoratet.no/' },
                  { label: 'Avfallsservice, Julegaver, gavepapir og bånd, hvor skal det kastes?', url: 'https://www.avfallsservice.no/post/julegaver-gavepapir-og-b%C3%A5nd-hvor-skal-det-kastes' },
                ].map((s, i) => (
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
                  'Gavetips', 'Praktiske gaver', 'Bærekraftige gaver', 'Batteriboks',
                  'Hjemorganisering', 'Gjenvinning',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
