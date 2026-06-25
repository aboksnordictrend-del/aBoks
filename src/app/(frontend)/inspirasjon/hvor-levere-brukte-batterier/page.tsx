import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Hvor kan man levere brukte batterier? Komplett guide for norske hjem',
  description:
    'Lurer du på hvor du kan levere brukte batterier? Her er den komplette guiden til returpunkter, gjenvinningsstasjoner og trygg oppbevaring hjemme.',
  alternates: {
    canonical: '/inspirasjon/hvor-levere-brukte-batterier',
  },
  keywords: [
    'brukte batterier', 'batteriretur', 'gjenvinning', 'kildesortering',
    'batterisikkerhet', 'miljø', 'hjemmeorganisering', 'farlig avfall',
  ],
  openGraph: {
    title: 'Hvor kan man levere brukte batterier? Komplett guide for norske hjem',
    description:
      'En praktisk og oppdatert oversikt over hvor du leverer brukte batterier i Norge – fra dagligvarebutikken til gjenvinningsstasjonen – med tips til trygg oppbevaring og hvorfor riktig batteriretur er viktig for miljø og brannsikkerhet.',
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

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      margin: '36px 0', padding: '24px 28px',
      background: '#eef0e8', border: '1px solid #cdd2bd',
      borderLeft: '4px solid #5e6a48', borderRadius: '14px',
    }}>
      <p style={{ ...h3Style, color: '#39402c', margin: '0 0 10px' }}>{title}</p>
      <div style={{ ...pStyle, margin: 0 }}>{children}</div>
    </div>
  )
}

function CalloutWarning({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      margin: '36px 0', padding: '24px 28px',
      background: '#fdf3ee', border: '1px solid #e8c9b8',
      borderLeft: '4px solid #b06a4a', borderRadius: '14px',
    }}>
      <p style={{ ...h3Style, color: '#8c3d1e', margin: '0 0 10px' }}>{title}</p>
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvor levere brukte batterier</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Gjenvinning &amp; bærekraft
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvor kan man levere brukte batterier?
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Spørsmålet «hvor kan man levere brukte batterier?» dukker gjerne opp i akkurat det
              øyeblikket du står med en håndfull utladede celler fra fjernkontrollen eller barnas
              leker. Den gode nyheten er at svaret er enklere – og nærmere – enn de fleste tror.
              Her er den komplette guiden til hvor og hvordan du leverer brukte batterier trygt,
              gratis og miljøvennlig.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av aBoks-redaksjonen · Oppdatert 2026 · Lesetid: ca. 6 minutter
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              De fleste av oss samler opp brukte batterier i en skuff eller et syltetøyglass i god
              tro om at de skal leveres «en gang». Problemet er at det «en gang» har en tendens til
              å trekke ut i månedsvis. I mellomtiden ligger batteriene og tar plass – og i verste
              fall utgjør de en brannrisiko. Å vite nøyaktig hvor du kan levere brukte batterier,
              og å gjøre det til en jevnlig vane, er et av de enkleste miljøgrepene du kan ta
              hjemme.
            </p>

            <p style={pStyle}>
              I Norge er innleveringssystemet godt utbygd, og du trenger sjelden å gå langt.
              Likevel havner altfor mange batterier fortsatt i restavfallet. Denne guiden tar deg
              gjennom alle de viktigste leveringsstedene, forklarer hvorfor det er så viktig, og
              viser hvordan litt orden hjemme gjør hele forskjellen.
            </p>

            <h2 style={h2Style}>De viktigste stedene du kan levere brukte batterier</h2>

            <p style={pStyle}>
              Det fine med batteriretur i Norge er at det er gratis, og at du har flere
              alternativer. Du trenger ikke kvittering, og du trenger ikke levere samme merke som
              du opprinnelig kjøpte. Ifølge{' '}
              <a href="https://norsirk.no/kildesortering/batteri/slik-leverer-du-batteriene/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                NORSIRK
              </a>{' '}
              kan batterier returneres til en butikk som fører samme type batterier, uavhengig av
              merke eller fabrikat, og det er kostnadsfritt både hos forhandlerne og på
              gjenvinningsstasjonene.
            </p>

            <h3 style={h3Style}>1. Dagligvarebutikken</h3>
            <p style={pStyle}>
              Dette er sannsynligvis det enkleste og mest tilgjengelige alternativet. De fleste
              store dagligvarekjeder har egne miljøstasjoner eller returpunkter – ofte plassert
              ved pantemaskinen eller inngangen. Her kan du levere brukte husholdningsbatterier
              som AA, AAA, knappcellebatterier og lignende. En grei huskeregel er at hvis butikken
              selger en produkttype, tar de den også imot til gjenvinning.
            </p>

            <h3 style={h3Style}>2. Elektronikk- og jernvarebutikker</h3>
            <p style={pStyle}>
              Butikker som selger elektronikk, verktøy eller jernvare er forpliktet til å ta imot
              batterier av samme type som de selger. Mange av disse har egne innsamlingsbokser ved
              inngangen. Dette er også stedet å levere mer spesielle batterier, som de fra elektrisk
              verktøy eller mindre powerbanker.
            </p>

            <h3 style={h3Style}>3. Gjenvinningsstasjonen</h3>
            <p style={pStyle}>
              Den kommunale gjenvinningsstasjonen tar imot alle typer batterier – fra de minste
              knappcellene til større blybatterier som regnes som farlig avfall. Dette er det rette
              stedet for skadde, hovne eller lekkende batterier, og for batterier du er usikker på
              hvordan skal håndteres. Hvilke ordninger som finnes varierer fra kommune til kommune,
              så det lønner seg å sjekke hva som gjelder der du bor.
            </p>

            <h3 style={h3Style}>4. Miljøstasjoner i nærmiljøet</h3>
            <p style={pStyle}>
              Mange kommuner og borettslag har egne miljøstasjoner eller returpunkter for
              småelektronikk og batterier. Disse er ofte en kort spasertur unna, og gjør det enkelt
              å levere uten å sette seg i bilen.
            </p>

            <Callout title="Slik finner du nærmeste innleveringssted">
              Er du usikker på hvor ditt nærmeste returpunkt ligger? Tjenesten{' '}
              <a href="https://www.sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Sortere.no
              </a>
              , drevet av LOOP, lar deg søke opp adressen din og se nøyaktig hvor i nærheten du
              kan levere brukte batterier og annet avfall. Det tar under et minutt og fjerner
              all tvil.
            </Callout>

            <h2 style={h2Style}>Hvorfor det er så viktig å levere batterier riktig</h2>

            <p style={pStyle}>
              Det er lett å tenke at et lite AA-batteri ikke utgjør noen forskjell. Men summen av
              alle batteriene som havner feil er betydelig – både for miljøet og for sikkerheten.
            </p>

            <p style={pStyle}>
              En vanlig misforståelse er at batterier er helt tomme når de slutter å virke. I
              realiteten kan det fortsatt være en god del restenergi igjen i et «brukt» batteri.
              Det er nettopp denne restenergien som gjør at batterier på avveie kan kortslutte og
              starte brann dersom polene kommer i kontakt med metall eller med hverandre. Brann-
              og redningsvesen over hele landet peker på batterier som en hovedårsak til branner
              i avfallsanlegg og søppelbiler.
            </p>

            <p style={pStyle}>
              I tillegg inneholder batterier verdifulle råstoffer som litium, kobolt, sink og
              nikkel. Når batteriene leveres til gjenvinning, kan disse materialene trekkes ut og
              brukes på nytt i nye produkter – noe som reduserer behovet for gruvedrift og er en
              bærebjelke i en sirkulær økonomi.{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Miljødirektoratet
              </a>{' '}
              har de senere årene skjerpet kravene til hvor stor andel av batteriene som skal
              samles inn, fra 30 til 65 prosent av produsentenes samlede import og produksjon,
              nettopp for å holde flere batterier unna restavfallet og naturen.
            </p>

            <blockquote style={{
              margin: '40px 0', padding: '28px 32px',
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Et brukt batteri er ikke søppel – det er en ressurs på vei tilbake i kretsløpet.
              Det eneste det venter på, er at du tar turen til nærmeste returpunkt.
            </blockquote>

            <h2 style={h2Style}>Slik oppbevarer du batteriene trygt før innlevering</h2>

            <p style={pStyle}>
              Veien fra utladet batteri til gjenvinningsstasjon går nesten alltid via en periode
              med oppbevaring hjemme. Og det er her mange gjør det uten å tenke på sikkerheten.
              Her er det viktigste å huske på:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Tape over polene.</strong> Sett en bit tape over begge endene på
                litiumbatterier og andre celler med restenergi. Dette hindrer kortslutning dersom
                batteriene kommer i kontakt med hverandre eller med metall.
              </BulletItem>
              <BulletItem>
                <strong>Hold brukte batterier adskilt fra nye.</strong> Et eget, dedikert rom for
                de brukte batteriene gjør at du aldri blander det fulle med det tomme – og at de
                brukte faktisk når frem til gjenvinning.
              </BulletItem>
              <BulletItem>
                <strong>Unngå store oppsamlede mengder.</strong> Det tryggeste er å levere jevnlig
                fremfor å la batteriene hope seg opp i månedsvis.
              </BulletItem>
              <BulletItem>
                <strong>Lever skadde batterier som farlig avfall.</strong> Hovne, lekkende eller
                deformerte batterier hører hjemme på gjenvinningsstasjonen, ikke i butikkens
                returboks.
              </BulletItem>
            </ul>

            <CalloutWarning title="Aldri i restavfallet">
              Batterier skal under ingen omstendigheter kastes i restavfallet. De er en kjent
              brannkilde i avfallssystemet og inneholder miljøgifter vi ikke ønsker ut i naturen.
              Alle batterier – uten unntak – skal til gjenvinning.
            </CalloutWarning>

            <h2 style={h2Style}>Oversikt: Hvor leverer du hva?</h2>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Batteritype', 'Anbefalt leveringssted'].map((h) => (
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
                    ['AA, AAA og andre husholdningsbatterier', 'Dagligvarebutikk, returpunkt eller gjenvinningsstasjon'],
                    ['Knappcellebatterier (klokker, høreapparat)', 'Butikkens miljøstasjon eller gjenvinningsstasjon'],
                    ['Verktøybatterier og oppladbare pakker', 'Elektronikk-/jernvarebutikk eller gjenvinningsstasjon'],
                    ['Skadde, hovne eller lekkende batterier', 'Gjenvinningsstasjon (farlig avfall)'],
                    ['Blybatterier og industribatterier', 'Gjenvinningsstasjon (farlig avfall)'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 4 ? '1px solid #ece8e1' : 'none',
                          background: i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top', color: '#4a4e41', lineHeight: 1.6,
                        }}>
                          {j === 0 ? <strong style={{ color: '#1a1d17' }}>{cell}</strong> : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={h2Style}>Gjør innlevering til en enkel vane</h2>

            <p style={pStyle}>
              Det største hinderet for batteriretur er sjelden mangel på leveringssteder – det er
              rot og glemsel. Når brukte batterier ligger spredt i ulike skuffer, sammen med fulle
              batterier og annet smårusk, blir innlevering en oppgave man stadig utsetter.
              Løsningen ligger i en liten endring i hverdagsrutinen: gi de brukte batteriene én
              fast plass.
            </p>

            <p style={pStyle}>
              Det er nettopp dette{' '}
              <Link href="/produkter/aboks" style={extLink}>aBoks</Link>{' '}
              er laget for. Med tre adskilte rom – ett for nye AA, ett for nye AAA og ett eget rom
              for brukte batterier – får hvert batteri sin faste plass. Du ser alltid hva du har
              igjen, og det brukte rommet gjør det enkelt og trygt å samle de utladede cellene
              frem til neste tur innom butikken. Når rommet er fullt, vet du at det er på tide å
              levere – en liten, innebygd påminnelse om å gjøre det riktige.
            </p>

            <p style={pStyle}>
              Vil du ha flere konkrete tips til orden i hjemmet, finner du mer inspirasjon i{' '}
              <Link href="/inspirasjon" style={extLink}>artikkelsamlingen vår</Link>.
              Poenget er enkelt: når systemet ligger der, går resten av seg selv.
            </p>

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
                Orden i batteriene – ett rom om gangen
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                aBoks samler nye og brukte batterier på ett sted, med et eget rom som gjør det
                enkelt å huske å levere til gjenvinning.
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

            <h2 style={h2Style}>Ofte stilte spørsmål om batteriretur</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Koster det noe å levere brukte batterier?">
                Nei. Det er helt gratis å levere brukte batterier, både hos forhandlere som selger
                batterier og på kommunale gjenvinningsstasjoner. Ordningen finansieres gjennom
                produsentansvaret, så du betaler ikke noe ved innlevering.
              </FaqItem>
              <FaqItem question="Må jeg levere batteriene der jeg kjøpte dem?">
                Nei. På et returpunkt er et AA-batteri et AA-batteri, uavhengig av merke og modell.
                Forhandlere er forpliktet til å ta imot batterier av samme type som de selger,
                uansett hvor du opprinnelig kjøpte dem.
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg tape over polene på brukte batterier?">
                Mange batterier har fortsatt restenergi igjen etter bruk. Tape over polene hindrer
                at batteriene kortslutter og utvikler varme dersom de kommer i kontakt med
                hverandre eller med metall – noe som i verste fall kan føre til brann under
                oppbevaring og transport.
              </FaqItem>
              <FaqItem question="Hva gjør jeg med et hovent eller lekkende batteri?">
                Skadde, hovne eller lekkende batterier bør leveres til den kommunale
                gjenvinningsstasjonen som farlig avfall, ikke i butikkens vanlige returboks.
                Håndter dem forsiktig og unngå å lagre dem sammen med andre batterier.
              </FaqItem>
              <FaqItem question="Hvordan finner jeg nærmeste leveringssted?">
                Bruk{' '}
                <a href="https://www.sortere.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  Sortere.no
                </a>{' '}
                og søk opp adressen din, så får du opp en oversikt over returpunkter og
                gjenvinningsstasjoner i nærheten. De fleste dagligvarebutikker har dessuten et
                returpunkt rett innenfor inngangen.
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
                  { label: 'NORSIRK – Slik leverer du batteriene', url: 'https://norsirk.no/kildesortering/batteri/slik-leverer-du-batteriene/' },
                  { label: 'Miljødirektoratet – Returordninger for batterier', url: 'https://www.miljodirektoratet.no/' },
                  { label: 'Sortere.no (LOOP) – Finn nærmeste returpunkt', url: 'https://www.sortere.no/' },
                  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB)', url: 'https://www.dsb.no/' },
                  { label: 'Regjeringen.no – Avfall og gjenvinning', url: 'https://www.regjeringen.no/' },
                ].map((s) => (
                  <li key={s.url} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '50%', background: '#696a62', marginTop: '8px' }} />
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6 }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={extLink}>{s.label}</a>
                    </span>
                  </li>
                ))}
              </ul>

              {/* Tags */}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'Brukte batterier', 'Batteriretur', 'Gjenvinning',
                  'Kildesortering', 'Batterisikkerhet', 'Farlig avfall',
                  'Hjemmeorganisering',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
