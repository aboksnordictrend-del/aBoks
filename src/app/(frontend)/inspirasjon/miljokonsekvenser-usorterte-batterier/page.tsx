import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Miljøkonsekvensene av usorterte batterier – hvorfor sortering betyr noe',
  description:
    'Millioner av batterier kastes feil hvert år i Norge. Se hvilke miljøkonsekvenser usorterte batterier fører til – og hvordan riktig sortering hjemme gjør en reell forskjell.',
  alternates: {
    canonical: '/inspirasjon/miljokonsekvenser-usorterte-batterier',
  },
  keywords: [
    'miljøkonsekvenser usorterte batterier', 'batterier', 'resirkulering',
    'farlig avfall', 'brannsikkerhet', 'sirkulær økonomi', 'kildesortering', 'miljø',
  ],
  openGraph: {
    title: 'Miljøkonsekvensene av usorterte batterier – hvorfor sortering betyr noe | aBoks',
    description:
      'Artikkelen forklarer hvorfor batterier er farlig avfall, hvordan feilsortering skaper brannrisiko på avfallsanlegg, hva som går tapt av verdifulle råstoffer, og gir konkrete, praktiske råd for riktig sortering hjemme – med aBoks som naturlig løsning.',
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Miljøkonsekvensene av usorterte batterier</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Bærekraft &amp; gjenvinning
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Miljøkonsekvensene av usorterte batterier – hvorfor riktig resirkulering er viktig
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Hvert år ender millioner av batterier i restavfallet i norske hjem. Det de
              fleste ikke tenker over, er hvor store miljøkonsekvensene av usorterte
              batterier faktisk er – for naturen, for brannsikkerheten og for ressursene
              vi ellers kunne gjenvunnet. Her er hva som skjer når batteriene går den gale
              veien, og hvordan du enkelt kan gjøre det riktig.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 9 min · Oppdatert juli 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Det starter alltid like udramatisk: et tomt batteri fra fjernkontrollen, et
              dødt AA-batteri fra en lykt, en gammel mobil som ikke lades opp lenger. Du
              legger det i skuffen «til du får tid», eller enda verre – rett i
              restavfallet. Ingenting eksploderer. Ingen alarm går. Men et sted mellom
              kjøkkenbenken og avfallsanlegget starter en kjede av hendelser som få av oss
              ser konsekvensene av.
            </p>

            <p style={pStyle}>
              Miljøkonsekvensene av usorterte batterier handler ikke om en enkelt
              dramatisk hendelse, men om summen av mange små, usynlige feil. Og ifølge
              norske myndigheter og avfallsbransjen er dette et større problem enn de
              fleste tror.
            </p>

            <h2 style={h2Style}>Hvorfor batterier regnes som farlig avfall</h2>

            <p style={pStyle}>
              Alle batterier – uansett størrelse eller type – er definert som farlig
              avfall i Norge. Det er ikke en formalitet, men en konsekvens av hva
              batteriene faktisk inneholder. Alkaliske batterier inneholder blant annet
              sink og mangan, mens oppladbare batterier kan inneholde nikkel, kadmium,
              kobolt og litium, avhengig av kjemien. Blybatterier, som de i bilen eller
              båtmotoren, inneholder naturlig nok bly og svovelsyre.
            </p>

            <p style={pStyle}>
              Når disse stoffene havner i naturen istedenfor i et godkjent
              gjenvinningsanlegg, kan de lekke ut i jord og grunnvann. Tungmetaller brytes
              ikke ned – de hoper seg opp i økosystemer over tid, og kan til slutt påvirke
              både dyreliv og drikkevannskilder.{' '}
              <a
                href="https://www.miljodirektoratet.no/ansvarsomrader/kjemikalier/den-norske-prioritetslista/tungmetaller/"
                target="_blank" rel="noopener noreferrer" style={extLink}
              >
                Miljødirektoratet
              </a>{' '}
              fører en egen prioritetsliste over tungmetaller og andre miljøgifter
              nettopp fordi disse stoffene utgjør en langvarig risiko selv i små mengder.
            </p>

            <h3 style={h3Style}>Det er ikke bare naturen som er sårbar</h3>

            <p style={pStyle}>
              Det er lett å tenke at «et batteri i skuffen» ikke gjør noen skade.
              Problemet oppstår derimot ofte hjemme, lenge før batteriet når naturen.
              Løse, brukte batterier kan kortslutte dersom polene kommer i kontakt med
              metallgjenstander som mynter, nøkler eller andre batterier. Det er en av
              grunnene til at det anbefales å tape over polene på brukte litium- og
              knappcellebatterier før de legges til side for levering.
            </p>

            <h2 style={h2Style}>Brannrisikoen få snakker om</h2>

            <p style={pStyle}>
              Dette er kanskje den mest underkommuniserte konsekvensen av feilsortering:
              batterier som havner i restavfallet, er en betydelig brannrisiko. I Oslo
              alene rykket brannvesenet ut til rundt 30 branner og branntilløp i
              renovasjonsbiler og avfallsanlegg i løpet av ett år, og på landsbasis skjer
              dette i gjennomsnitt hver uke.<Cite n={1} />
            </p>

            <p style={pStyle}>
              Årsaken er nesten alltid feilsorterte batterier eller annet farlig avfall
              som antenner avfallet rundt seg. Plukkanalyser fra Oslo viser at rundt to
              millioner batterier hvert år havner i renovasjonsbilene og videre inn i
              sorteringsanleggene for husholdningsavfall – det tilsvarer omtrent tre
              batterier per innbygger.<Cite n={1} /> Når renovasjonsbilens komprimator
              presser sammen avfallet, kan batterier gnisse mot hverandre eller andre
              metallgjenstander, og i verste fall selvantenne.
            </p>

            <p style={pStyle}>
              Litium-ion-batterier er spesielt utfordrende i denne sammenhengen. De kan
              gjennomgå det som kalles spontan antennelse med høy brannenergi, og brannen
              produserer svært giftig røyk som er vanskelig å slukke.<Cite n={1} /> Norsk
              Industris egen brannstatistikk for gjenvinningsbransjen bekrefter mønsteret
              år etter år: feilsorterte batterier i restavfall utgjør den klart største
              brannrisikoen på norske avfalls- og gjenvinningsanlegg.<Cite n={2} />
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Feilsorterte batterier forårsaker klart flest brannhendelser på avfalls- og
              gjenvinningsanlegg i Norge – et mønster som har vært stabilt over flere år.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Norsk Industris brannstatistikk for gjenvinningsbransjen
              </footer>
            </blockquote>

            <p style={pStyle}>
              Det handler altså ikke bare om naturen på lang sikt, men om reell risiko for
              liv, helse og materielle verdier i dag – i din egen kommune, ofte uten at du
              vet om det.
            </p>

            <Callout label="Visste du dette?">
              Et brukt batteri kan fortsatt ha betydelig restenergi igjen, selv om det
              ikke lenger driver produktet det sto i. Det er derfor et «tomt» batteri
              aldri er helt ufarlig å håndtere – og hvorfor sikker oppbevaring hjemme er
              like viktig som riktig levering.
            </Callout>

            <h2 style={h2Style}>Hva går egentlig tapt når batteriene ikke gjenvinnes riktig?</h2>

            <p style={pStyle}>
              Miljøkonsekvensene av usorterte batterier handler ikke bare om det som
              lekker ut – men også om alt vi går glipp av. Batterier inneholder
              verdifulle råstoffer som kan brukes på nytt, gang etter gang, dersom de
              behandles riktig.
            </p>

            <p style={pStyle}>
              Når batterier leveres til et godkjent behandlingsanlegg, blir de utladet,
              sortert etter kjemisk sammensetning og videre behandlet for å hente ut
              råstoffer. Blybatterier kvernes opp, og blyet gjenvinnes til nye batterier,
              mens plasten smeltes om til granulat for nye produkter. Alkaliske batterier
              inneholder blant annet sink, som etter resirkulering kan brukes som
              korrosjonsbeskyttelse på stål eller som pigment i maling og
              metallegeringer.<Cite n={3} />
            </p>

            <p style={pStyle}>
              Avfallsforskriften setter konkrete krav til hvor mye som skal
              materialgjenvinnes: minst 65 prosent av blybatterienes gjennomsnittsvekt,
              minst 75 prosent for nikkel-kadmium-batterier, og minst 50 prosent for andre
              batterityper.<Cite n={3} /> Dette er ikke frivillige mål – det er lovfestede
              krav produsenter og returselskaper må innfri.
            </p>

            <h3 style={h3Style}>En ressurs vi ikke kan ta for gitt</h3>

            <p style={pStyle}>
              Litium, kobolt og nikkel er mineraler som ofte utvinnes under krevende
              forhold i andre deler av verden. Hver gang et batteri gjenvinnes riktig i
              Norge, reduseres behovet for å utvinne nye råvarer et annet sted. Det er
              derfor riktig resirkulering ikke bare er en lokal miljøsak, men også har en
              internasjonal dimensjon knyttet til ressursbruk og bærekraftig
              forsyningskjede.
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 8px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Batteritype', 'Hovedinnhold', 'Krav til materialgjenvinning'].map((h) => (
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
                    ['Blybatteri (bil, båt)', 'Bly, svovelsyre, plast', 'Minst 65 %'],
                    ['Nikkel-kadmium', 'Nikkel, kadmium', 'Minst 75 %'],
                    ['Alkalisk (AA/AAA)', 'Sink, mangan', 'Minst 50 %'],
                    ['Litium-ion (oppladbart)', 'Litium, kobolt, nikkel', 'Minst 50 %'],
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
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#8a8a8a', margin: '0 0 28px' }}>
              Kilde: Avfallsforskriften, referert av NORSIRK<Cite n={3} />
            </p>

            <h2 style={h2Style}>Hvorfor «det er bare ett batteri» er en myte</h2>

            <p style={pStyle}>
              En vanlig misforståelse er at ett enkelt batteri i restavfallet ikke gjør
              noen forskjell. Statistikken viser noe annet. Når to millioner batterier
              havner feil hvert år bare i Oslo, er det nettopp fordi hver enkelt av oss
              tenker at vårt bidrag er ubetydelig.<Cite n={1} /> Summen av mange små
              handlinger blir i dette tilfellet noe betydelig større: en jevn strøm av
              branntilløp, tapte ressurser og potensiell forurensning som kunne vært
              unngått med noen få sekunders innsats per batteri.
            </p>

            <p style={pStyle}>
              En annen misforståelse er at bare oppladbare litiumbatterier er farlige. I
              realiteten er alle batterityper – også de vanlige alkaliske
              engangsbatteriene fra fjernkontrollen – definert som farlig avfall og skal
              sorteres ut for seg selv, uansett hvor «vanlige» eller «svake» de
              virker.<Cite n={4} />
            </p>

            <h2 style={h2Style}>Slik gjør du det riktig hjemme</h2>

            <p style={pStyle}>
              Den gode nyheten er at løsningen på dette problemet ikke krever store
              endringer i hverdagen – bare noen enkle, faste vaner:
            </p>

            <div style={{ margin: '8px 0 28px', borderTop: '1px solid #ddd8ce' }}>
              <StepItem n={1} title="Gi batteriene en fast plass">
                Sett av et eget rom eller en egen beholder for brukte batterier, gjerne
                rett ved der du oppbevarer de nye. Da unngår du at de forsvinner ned i
                skuffer eller, verre, i restavfallet.
              </StepItem>
              <StepItem n={2} title="Tape over polene">
                På brukte litium- og knappcellebatterier før du legger dem til side.
                Dette reduserer risikoen for kortslutning betydelig.
              </StepItem>
              <StepItem n={3} title="Ta ut batteriene">
                Fra elektriske og elektroniske produkter før du kasserer selve produktet.
              </StepItem>
              <StepItem n={4} title="Lever samlet">
                Til nærmeste butikk med batteriinnsamling eller til kommunens
                gjenbruksstasjon – de aller fleste elektronikkbutikker og supermarkeder
                er pålagt å ta imot brukte batterier gratis.
              </StepItem>
            </div>

            <p style={pStyle}>
              Hvis du ønsker en mer detaljert gjennomgang av selve sorteringsprosessen,
              kan du lese vår guide om{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                hvordan du sorterer batteriene riktig hjemme
              </Link>. Der går vi grundigere gjennom akkurat hvilke batterier som skal
              sorteres hvor, og hvorfor.
            </p>

            <Callout label="Der aBoks kommer inn i bildet">
              Det som ofte avgjør om et batteri faktisk blir levert til gjenvinning, er
              ikke kunnskapen om at man bør gjøre det – det er hvor enkelt det er i
              praksis. <strong>aBoks</strong> er designet nettopp for dette: en
              batteriboks med tre adskilte rom, hvor ett rom er dedikert til brukte
              batterier som skal videre til gjenvinning. I stedet for at tomme batterier
              blir liggende løst i skuffer, sekker eller garasjehyller, får de en fast
              plass fra dag én – slik at neste tur til butikken eller gjenbruksstasjonen
              blir en rutine, ikke en glemt oppgave. Boksen finnes i tre farger og passer
              naturlig inn i de fleste hjem, fra kjøkkenbenken til hjemmekontoret.
            </Callout>

            <h2 style={h2Style}>Fra hverdagsvane til del av den sirkulære økonomien</h2>

            <p style={pStyle}>
              Norge har lenge vært et foregangsland innen innsamling av elektronisk
              avfall og batterier, med en av de høyeste gjenvinningsgradene i
              Europa.<Cite n={5} /> Denne posisjonen er ikke en selvfølge – den er
              resultatet av at både myndigheter, returselskaper som NORSIRK og vanlige
              husholdninger gjør sin del av jobben. Regjeringens strategi for sirkulær
              økonomi peker nettopp på riktig avfallshåndtering som en forutsetning for å
              redusere presset på jomfruelige råvarer og redusere klimagassutslipp
              knyttet til utvinning av nye mineraler.
            </p>

            <p style={pStyle}>
              Sett i dette lyset er hver batteriboks, hver gjenbruksstasjon og hver
              husholdning som sorterer riktig, en liten men reell del av et større
              system. Det er ikke overdramatisert å si at gode vaner hjemme er en
              forutsetning for at Norge skal kunne opprettholde og forbedre sine
              gjenvinningstall i årene som kommer, spesielt i takt med at batteribruken i
              samfunnet øker kraftig gjennom elsykler, elsparkesykler og annet
              batteridrevet utstyr.
            </p>

            <p style={pStyle}>
              Ønsker du å gå enda lenger og forlenge batterienes levetid før de i det
              hele tatt blir avfall, kan du lese mer i vår artikkel om{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                hvordan du forlenger levetiden på batteriene dine
              </Link>.
            </p>

            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '40px 0' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les også</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                    Hvorfor det lønner seg å levere inn brukte batterier
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva? Den komplette guiden
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/aboks-fremtidens-baerekraftige-hjem" style={extLink}>
                    aBoks og fremtidens bærekraftige hjem
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
                Gjør riktig sortering til en vane – ikke en oppgave
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                Med aBoks får de brukte batteriene en fast plass i hjemmet, slik at de
                faktisk finner veien til gjenvinning i stedet for restavfallet.
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

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }}>Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Er alle batterier farlig avfall, selv vanlige AA-batterier?">
                Ja. Alle batterityper, inkludert alminnelige alkaliske AA- og
                AAA-batterier, er definert som farlig avfall i Norge og skal aldri
                kastes i restavfallet. De skal sorteres ut og leveres til godkjent
                innsamlingssted, uavhengig av hvor «uskyldige» de kan virke.
              </FaqItem>
              <FaqItem question="Hva er den største miljørisikoen ved usorterte batterier?">
                De to største risikoene er lekkasje av tungmetaller og andre miljøgifter
                til jord og grunnvann dersom batteriene havner i naturen eller på
                deponi, samt brann i avfallsanlegg og renovasjonsbiler forårsaket av
                feilsorterte batterier, spesielt litium-ion-typer.
              </FaqItem>
              <FaqItem question="Hvor skal jeg levere brukte batterier i Norge?">
                De fleste elektronikkbutikker, supermarkeder og gjenbruksstasjoner har
                egne innsamlingsbeholdere for batterier, og er lovpålagt å ta imot dem
                gratis. Sjekk gjerne{' '}
                <a href="https://www.sortere.no" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  Sortere.no
                </a>{' '}
                for nærmeste innsamlingspunkt i din kommune.
              </FaqItem>
              <FaqItem question="Bør jeg tape over polene på brukte batterier?">
                Ja, særlig for litium- og knappcellebatterier. Å tape over polene
                reduserer risikoen for kortslutning betydelig når batteriet oppbevares
                eller transporteres sammen med andre batterier eller metallgjenstander.
              </FaqItem>
              <FaqItem question="Hvorfor skjer det branner i avfallsbiler og gjenvinningsanlegg på grunn av batterier?">
                Når batterier feilsorteres i restavfallet, kan de bli utsatt for trykk
                og gnisning i renovasjonsbilens komprimator, eller komme i kontakt med
                metall og annet avfall. Dette kan utløse kortslutning og i verste fall
                spontan antennelse, spesielt hos litium-ion-batterier som utvikler høy
                brannenergi og giftig røyk.
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
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {[
                  { label: 'Oslo kommune, «Små batterier, store branner»', url: 'https://aktuelt.oslo.kommune.no/sma-batterier-store-branner' },
                  { label: 'Norsk Industri, Brannstatistikk for gjenvinningsbransjen', url: 'https://www.norskindustri.no/bransjer/gjenvinning/aktuelt/brannstatistikk/' },
                  { label: 'NORSIRK, «Slik gjenvinnes batteriene»', url: 'https://norsirk.no/kildesortering/batteri/slik-gjenvinnes-batteriene/' },
                  { label: 'DSB, veiledning om brannrisiko ved lagring og transport av litiumbatterier', url: 'https://www.dsb.no/' },
                  { label: 'Miljødirektoratet, om batteriforskrift og produsentansvar', url: 'https://www.miljodirektoratet.no/' },
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
                  'Batterier', 'Resirkulering', 'Farlig avfall', 'Brannsikkerhet',
                  'Sirkulær økonomi', 'Kildesortering', 'Miljø',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
