import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Hvordan resirkuleres batterier? Fra innsamling til nye råvarer | aBoks',
  description:
    'Hvordan resirkuleres batterier i Norge? Følg reisen fra kjøkkenskuffen til nye råvarer – innsamling, sortering, gjenvinning og hvorfor riktig sortering hjemme er avgjørende.',
  alternates: {
    canonical: '/inspirasjon/hvordan-resirkuleres-batterier',
  },
  keywords: [
    'batterigjenvinning', 'resirkulering', 'batterier', 'bærekraft',
    'kildesortering', 'sirkulærøkonomi', 'brannsikkerhet', 'litium-ion',
    'miljø', 'gjenvinning Norge',
  ],
  openGraph: {
    title: 'Hvordan resirkuleres batterier? Fra innsamling til nye råvarer | aBoks',
    description:
      'En grundig og lettlest guide til hvordan batterier resirkuleres i Norge, steg for steg – fra innsamling og sortering til kjemisk utvinning av sink, bly, nikkel og kobolt. Inkluderer norske gjenvinningskrav, Hydrovolts «svarte masse», brannstatistikk og praktiske råd for trygg innlevering hjemmefra.',
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

function StepItem({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: '18px', background: '#f0ece3',
      borderRadius: '14px', padding: '22px 24px', alignItems: 'flex-start',
    }}>
      <span style={{
        fontFamily: 'var(--font-cormorant)', fontSize: '1.5rem', fontWeight: 600,
        color: '#5e6a48', flexShrink: 0, width: '36px', lineHeight: 1, paddingTop: '2px',
      }}>{n}</span>
      <div>
        <p style={{ ...h3Style, margin: '0 0 6px' }}>{title}</p>
        <p style={{ ...pStyle, margin: 0, fontSize: '0.97rem', color: '#4a4e41' }}>{children}</p>
      </div>
    </div>
  )
}

function Callout({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 28px', background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px' }}>
      <p style={{ ...h3Style, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#5e6a48' }}>
        <span style={{
          width: '28px', height: '28px', background: '#5e6a48', color: '#fff',
          borderRadius: '8px', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '14px', flexShrink: 0,
        }}>{icon}</span>
        {title}
      </p>
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvordan resirkuleres batterier</span>
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
              Hvordan resirkuleres batterier? Fra innsamling til nye råvarer
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Hvordan resirkuleres batterier egentlig, fra det øyeblikket du legger en utbrukt
              celle i en boks hjemme til metallene er på vei inn i et nytt produkt? Reisen er
              overraskende lang, teknisk imponerende – og helt avhengig av ett enkelt grep du
              gjør på kjøkkenet.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av aBoks-redaksjonen · Oppdatert juni 2026 · Lesetid: ca. 8 minutter
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              De fleste av oss tenker sjelden over hva som skjer med batteriene etter at de er
              levert inn. Vi tømmer boksen på gjenvinningsstasjonen, og så er saken ute av syne.
              Men bak den korte handlingen ligger et av Norges mest velfungerende kretsløp – en
              kjede av innsamling, sortering, nøytralisering og kjemisk utvinning som forvandler
              tilsynelatende verdiløst avfall til verdifulle råvarer.
            </p>

            <p style={pStyle}>
              I denne guiden følger vi hele veien: hvordan batterier resirkuleres steg for steg,
              hva som faktisk kan gjenvinnes, hvorfor brann er den store fienden underveis – og
              hvorfor det aller første leddet i kjeden er deg. For sannheten er at den mest
              avanserte gjenvinningsteknologien i verden ikke hjelper hvis batteriet aldri
              kommer frem.
            </p>

            <h2 style={h2Style}>Hvorfor batterier ikke hører hjemme i restavfallet</h2>

            <p style={pStyle}>
              La oss starte med utgangspunktet. Et batteri er ikke vanlig søppel. Enkelte typer
              inneholder helse- og miljøfarlige stoffer som bly, kadmium eller kvikksølv, mens
              andre rommer verdifulle metaller som kan brukes om igjen i nye produkter. Nettopp
              derfor skal alle batterier{' '}
              <a href="https://www.miljodirektoratet.no/ansvarsomrader/avfall/avfallstyper/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                samles inn, behandles trygt og gjenvinnes
              </a>,
              slik Miljødirektoratet beskriver det. Håndteringen er regulert i
              avfallsforskriftens kapittel 3.
            </p>

            <p style={pStyle}>
              Det er også en sikkerhetssak. Et gjennomsnittlig norsk hjem har rundt 75 batterier
              i omløp, ifølge bransjeaktøren Batteriretur. Havner disse i restavfallet, kan de
              bli utsatt for press og varme på avfallsanlegget og utløse såkalt{' '}
              <em>thermal runaway</em> – en kjedereaksjon der batteriet hetes opp ukontrollert
              og kan ta fyr. Statistikk fra gjenvinningsbransjen er nådeløst tydelig: feilsorterte
              batterier er den klart vanligste årsaken til brann på norske avfalls- og
              gjenvinningsanlegg.
            </p>

            <Callout icon="!" title="Visste du dette?">
              I Norsk Industris brannstatistikk for gjenvinningsbransjen har feilsorterte
              batterier i flere år på rad vært den dominerende brannårsaken der årsaken er kjent.
              Hvert eneste batteri du sorterer riktig, er derfor ikke bare gjenvinning – det er
              konkret brannforebygging.
            </Callout>

            <h2 style={h2Style}>Slik resirkuleres batterier – steg for steg</h2>

            <p style={pStyle}>
              Selve gjenvinningen følger en logisk kjede. Her er de fem hovedstegene fra
              innlevering til ny råvare.
            </p>

            <div style={{ display: 'grid', gap: '18px', margin: '36px 0' }}>
              <StepItem n={1} title="Innsamling">
                Batteriene leveres inn via butikker, gjenvinningsstasjoner og returpunkter, og
                samles av godkjente returselskaper. I Norge samles det årlig inn rundt
                16 000 tonn brukte batterier.
              </StepItem>
              <StepItem n={2} title="Sortering">
                Batteriene sorteres etter type – alkaliske, litium-ion, bly, nikkel og
                knappceller. Hver kjemi krever sin egen behandling, så riktig sortering er
                avgjørende for resultatet.
              </StepItem>
              <StepItem n={3} title="Transport & sikkerhet">
                Fordi batterier kan inneholde farlige komponenter, fraktes de i godkjente
                beholdere etter strenge sikkerhets- og miljøkrav frem til behandlingsanlegget.
              </StepItem>
              <StepItem n={4} title="Behandling">
                På anlegget blir batteriene utladet, nøytralisert, kvernet opp og separert i
                ulike fraksjoner. Plast, metaller og elektrolyttvæske skilles fra hverandre.
              </StepItem>
              <StepItem n={5} title="Utvinning av råvarer">
                Gjennom kjemisk behandling trekkes verdifulle råstoffer ut – sink, bly, nikkel,
                kobolt og mer – klare til å bli til nye produkter. En liten rest går til deponi.
              </StepItem>
            </div>

            <p style={pStyle}>
              NORSIRK beskriver kjernen i prosessen omtrent slik: i grove trekk blir batteriene{' '}
              <a href="https://norsirk.no/kildesortering/batteri/slik-gjenvinnes-batteriene/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                utladet, nøytralisert, kvernet opp, separert til ulike bestanddeler og kjemisk
                behandlet
              </a>{' '}
              for å hente ut råstoffer til ny produksjon. Det høres enkelt ut på papiret, men
              presisjonen som kreves er betydelig – og den starter med at batteriene er sortert
              riktig før de kommer inn døra.
            </p>

            <h2 style={h2Style}>Hva blir batteriene egentlig til?</h2>

            <p style={pStyle}>
              Dette er kanskje den mest fascinerende delen av historien. Materialene i et brukt
              batteri forsvinner ikke – de bytter rett og slett identitet. Her er noen eksempler
              på hva ulike batterityper gjenvinnes til:
            </p>

            <div style={{ overflowX: 'auto', margin: '8px 0 28px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Batteritype', 'Hovedmateriale', 'Blir til'].map((h) => (
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
                    ['Alkaliske (AA/AAA)', 'Sink', 'Korrosjonsbeskyttelse på stål, pigment i maling og metallegeringer'],
                    ['Blybatterier', 'Bly & plast', 'Nye blybatterier; plasten blir til hagemøbler, isskraper og bildashbord'],
                    ['Litium-ion', 'Nikkel & kobolt', 'Legeringer i stålindustrien; kobolt som blått fargestoff i keramikk'],
                    ['Knappceller', 'Diverse metaller', 'Behandles spesielt; eldre kvikksølvholdige sendes til sikkert deponi'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 3 ? '1px solid #ece8e1' : 'none',
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

            <p style={pStyle}>
              At plasten fra en gammel bilbatterikasse kan ende opp som et dashbord i en ny bil,
              eller at kobolten fra mobiltelefonbatteriet ditt kan gi den blå glasuren på et
              keramikkfat, er sirkulærøkonomi i sin mest konkrete form. Lite går til spille når
              kjeden fungerer som den skal.
            </p>

            <blockquote style={{
              margin: '40px 0', padding: '28px 32px',
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Et batteri er ikke avfall – det er en samling råvarer som venter på sin neste jobb.
              <cite style={{
                display: 'block', marginTop: '14px',
                fontFamily: 'var(--font-manrope)', fontStyle: 'normal',
                fontSize: '13px', color: '#5e6a48', fontWeight: 600,
              }}>
                – Slik tenker den moderne gjenvinningsindustrien
              </cite>
            </blockquote>

            <h2 style={h2Style}>Norsk teknologi i front: «svart masse»</h2>

            <p style={pStyle}>
              Når det gjelder de store litium-ion-batteriene fra elbiler, har Norge tatt en
              posisjon helt i front. Selskapet Hydrovolt, eid av Hydro og Northvolt, driver et av
              Europas største anlegg for batterigjenvinning i Fredrikstad. Her hentes det ut{' '}
              <a href="https://www.tu.no/artikler/her-blir-gamle-elbilbatterier-til-nye-ravarer/547732" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                over 90 prosent av materialene i store batteripakker
              </a>{' '}
              – inkludert plast, kobber, jern, aluminium og en blanding kalt «svart masse» som
              inneholder nikkel, mangan, kobolt og litium.
            </p>

            <p style={pStyle}>
              Denne svarte massen er gull verdt i bokstavelig forstand: den kan raffineres videre
              til rene metaller som går rett tilbake i produksjonen av nye batterier. Med Norges
              tilnærmet 100 prosent fornybare kraftforsyning kan slike prosesser dessuten kjøres
              med et lavere miljøfotavtrykk enn nesten noe annet sted i Europa, noe også{' '}
              <a href="https://www.regjeringen.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                regjeringens kunnskapsgrunnlag for en nasjonal batteristrategi
              </a>{' '}
              peker på som et konkurransefortrinn for landet.
            </p>

            <h2 style={h2Style}>Kravene som styrer hvor mye som gjenvinnes</h2>

            <p style={pStyle}>
              Gjenvinning er ikke overlatt til velvilje. Avfallsforskriften setter konkrete
              minstekrav til hvor stor andel av batteriets vekt som skal materialgjenvinnes:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                Minst <strong>65 prosent</strong> av blybatteriers gjennomsnittsvekt
              </BulletItem>
              <BulletItem>
                Minst <strong>75 prosent</strong> av nikkel-kadmium-batteriers gjennomsnittsvekt
              </BulletItem>
              <BulletItem>
                Minst <strong>50 prosent</strong> av andre batteriers gjennomsnittsvekt
              </BulletItem>
            </ul>

            <p style={pStyle}>
              I tillegg er selve innsamlingen regulert. Fra 1. januar 2024 økte Miljødirektoratet
              kravet til{' '}
              <a href="https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                innsamlingsgrad for løse, bærbare batterier fra 30 til 65 prosent
              </a>.
              EUs nye batteriforordning skjerper ambisjonene ytterligere mot 73 prosent innen
              2030. Retningen er klar: stadig flere batterier skal tilbake i kretsløpet.
            </p>

            <h2 style={h2Style}>Det svake leddet: batteriene som aldri kommer frem</h2>

            <p style={pStyle}>
              Her møter den imponerende teknologien sin største utfordring. For selv om Norge
              har et av verdens beste retursystemer, er det fortsatt et betydelig gap mellom hva
              som selges og hva som faktisk leveres inn. Tall som NRK har innhentet, viser at av
              batterier under fem kilo solgt i ett år, ble{' '}
              <a href="https://www.nrk.no/norge/mange-batterier-gjenvinnes-ikke_-_-det-utgjor-en-stor-brannfare-1.16473898" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                under halvparten samlet inn igjen
              </a>.
              Resten ble liggende i skuffer – eller, verre, havnet i restavfallet.
            </p>

            <p style={pStyle}>
              Dette er kjernen i saken. Gjenvinningskjeden er bare så sterk som sitt første ledd,
              og det første leddet er hjemmet ditt. Et batteri som blir liggende glemt i en
              rotskuff, kan verken bli til ny sink eller ny kobolt. Det er her gode vaner –
              og litt enkel orden – utgjør hele forskjellen.
            </p>

            <Callout icon="✓" title="Ekspertenes beste tips før innlevering">
              <strong>Teip polene.</strong> Det er ofte litt restenergi igjen i et brukt batteri.
              Ved å sette et stykke teip over polene hindrer du kortslutning og reduserer
              brannfaren under transport og lagring. Et lite grep med stor effekt.
            </Callout>

            <h2 style={h2Style}>Slik gjør du din del enkel – og trygg</h2>

            <p style={pStyle}>
              Du trenger verken et laboratorium eller spesialkunnskap for å bli et godt første
              ledd i kjeden. Det handler om å gjøre riktig handling til den enkleste handlingen.
              Her er en praktisk rutine som faktisk holder:
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberItem n={1}>
                Gi de brukte batteriene en <strong>fast plass</strong> hjemme, atskilt fra de
                nye, slik at de aldri ender i restavfallet ved et uhell.
              </NumberItem>
              <NumberItem n={2}>
                Teip polene på litium- og knappcellebatterier før de legges til side.
              </NumberItem>
              <NumberItem n={3}>
                Ta med boksen og lever gratis i butikken neste gang du handler, eller på
                gjenvinningsstasjonen.
              </NumberItem>
              <NumberItem n={4}>
                Hold de nye batteriene sortert etter type, så du slipper å kaste fullt brukbare
                celler i forvirringen.
              </NumberItem>
            </ol>

            <p style={pStyle}>
              Nettopp dette er tanken bak{' '}
              <Link href="/produkter/aboks" style={extLink}>aBoks</Link>.
              Med tre adskilte rom – ett for nye AA, ett for nye AAA og ett eget rom for brukte
              batterier – får hvert batteri sin faste plass. De brukte samles på ett sted i
              stedet for å bli borte i skuffen, og når rommet er fullt, tar du det rett og slett
              med til gjenvinning. Det lille rommet for brukte celler er ikke et tilbehør; det
              er broen mellom hjemmet ditt og hele gjenvinningskjeden vi nettopp har fulgt.
            </p>

            <p style={pStyle}>
              Vil du gå dypere i selve sorteringen, har vi samlet de praktiske rådene i guiden{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                slik sorterer du batteriene riktig hjemme
              </Link>,
              og du finner mer om motivasjonen i artikkelen om{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>.
            </p>

            <h2 style={h2Style}>Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvor mye av et batteri kan faktisk gjenvinnes?">
                Det varierer med type. Avfallsforskriften krever minst 65 prosent
                materialgjenvinning av blybatteriers vekt, 75 prosent for nikkel-kadmium og
                50 prosent for andre batterier. For store litium-ion-batteripakker klarer
                moderne norske anlegg å hente ut over 90 prosent av materialene.
              </FaqItem>
              <FaqItem question="Hvorfor er det så viktig å sortere batterier riktig?">
                Først og fremst på grunn av brannfare. Feilsorterte batterier i restavfallet
                er den vanligste kjente årsaken til brann på norske gjenvinningsanlegg. I
                tillegg går verdifulle råvarer tapt hvis batteriet ikke kommer inn i riktig
                gjenvinningsstrøm.
              </FaqItem>
              <FaqItem question="Bør jeg teipe batteriene før innlevering?">
                Ja, særlig litium- og knappcellebatterier. Det er ofte litt restenergi igjen,
                og ved å teipe polene hindrer du kortslutning som kan utløse brann under
                lagring og transport. Det tar noen sekunder og øker sikkerheten betydelig.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg inn brukte batterier i Norge?">
                Du kan levere batterier gratis i de fleste butikker som selger dem, samt på
                kommunale gjenvinningsstasjoner. Forhandlere har plikt til å ta imot batterier
                vederlagsfritt, så du trenger ikke kjøpe noe for å levere inn.
              </FaqItem>
              <FaqItem question="Hva skjer med kvikksølv i gamle knappcellebatterier?">
                Kvikksølv er ikke lov å gjenvinne i Norge. Alle knappcellebatterier behandles
                spesielt, og kvikksølvet fra eldre celler sendes til sikkert deponi i stedet
                for å føres tilbake i kretsløpet.
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
                Gi de brukte batteriene en fast plass
              </h2>
              <p style={{
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)',
                lineHeight: 1.7, color: '#c8cebb', margin: '0 0 24px',
              }}>
                Med et eget rom for brukte celler blir veien til gjenvinning kortere – og
                hjemmet ditt tryggere og ryddigere fra dag én.
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
                  { label: 'Miljødirektoratet – Avfallstyper og krav til batterier', url: 'https://www.miljodirektoratet.no/ansvarsomrader/avfall/avfallstyper/' },
                  { label: 'Miljødirektoratet – Ny innsamlingsplikt av løse batterier blir 65 prosent', url: 'https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent' },
                  { label: 'NORSIRK – Slik gjenvinnes batteriene', url: 'https://norsirk.no/kildesortering/batteri/slik-gjenvinnes-batteriene/' },
                  { label: 'Teknisk Ukeblad – Her blir gamle elbilbatterier til nye råvarer (Hydrovolt)', url: 'https://www.tu.no/artikler/her-blir-gamle-elbilbatterier-til-nye-ravarer/547732' },
                  { label: 'Norsk Industri – Brannstatistikk for gjenvinningsbransjen', url: 'https://www.norskindustri.no/bransjer/gjenvinning/aktuelt/brannstatistikk/' },
                  { label: 'NRK – Mange batterier gjenvinnes ikke', url: 'https://www.nrk.no/norge/mange-batterier-gjenvinnes-ikke_-_-det-utgjor-en-stor-brannfare-1.16473898' },
                  { label: 'Regjeringen – Kunnskapsgrunnlag for en nasjonal batteristrategi', url: 'https://www.regjeringen.no/' },
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
                  'Batterigjenvinning', 'Resirkulering', 'Bærekraft',
                  'Kildesortering', 'Sirkulærøkonomi', 'Brannsikkerhet',
                  'Litium-ion', 'Gjenvinning Norge',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
