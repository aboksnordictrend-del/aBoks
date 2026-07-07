import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = buildArticleMetadata({
  slug: 'forleng-levetiden-pa-batteriene',
  title: 'Slik forlenger du levetiden på batteriene dine | aBoks',
  description:
    'Lær hvordan du forlenger levetiden på batteriene dine med riktig oppbevaring, temperatur og smarte rutiner. Praktiske råd for et tryggere, mer bærekraftig hjem.',
})

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 500,
  fontSize: 'clamp(26px,3vw,36px)',
  letterSpacing: '-0.015em',
  lineHeight: 1.2,
  color: '#1a1d17',
  margin: '52px 0 18px',
}

const h3Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 600,
  fontSize: 'clamp(19px,1.8vw,22px)',
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
  color: '#1a1d17',
  margin: '32px 0 10px',
}

const pStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(14px,1vw,16px)',
  lineHeight: 1.75,
  color: '#4a4e41',
  margin: '0 0 20px',
}

const linkStyle: React.CSSProperties = {
  color: '#5e6a48',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '12px' }}>
      <span
        style={{
          flexShrink: 0,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#5e6a48',
          marginTop: '8px',
        }}
      />
      <p style={{ ...pStyle, margin: 0 }}>{children}</p>
    </div>
  )
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details
      style={{
        background: '#f3ede2',
        borderRadius: '14px',
        marginBottom: '10px',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          padding: '20px 52px 20px 22px',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 700,
          fontSize: 'clamp(14px,1vw,16px)',
          color: '#1a1d17',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {q}
        <span
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--font-manrope)',
            fontSize: '22px',
            fontWeight: 300,
            color: '#5e6a48',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <div style={{ padding: '0 22px 22px' }}>
        <p style={{ ...pStyle, margin: 0 }}>{children}</p>
      </div>
    </details>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'var(--font-manrope)',
        fontWeight: 600,
        fontSize: '11px',
        letterSpacing: '0.06em',
        color: '#5e6a48',
        background: '#eee9de',
        borderRadius: '100px',
        padding: '5px 14px',
        marginRight: '8px',
        marginBottom: '8px',
      }}
    >
      {children}
    </span>
  )
}

export default function ForlengLevetidenPage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: 'clamp(28px,4vw,56px) clamp(20px,5vw,48px) clamp(80px,10vw,120px)',
        }}
      >

        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            marginBottom: '40px',
          }}
        >
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <Link href="/inspirasjon" style={{ color: '#6b6f63', textDecoration: 'none' }}>Inspirasjon</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Batterilevetid</span>
        </div>

        {/* Header */}
        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '0 0 16px',
            textAlign: 'center',
          }}
        >
          Bærekraft &amp; smart hverdag
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(32px,5vw,56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            color: '#1a1d17',
            margin: '0 0 22px',
            textAlign: 'center',
          }}
        >
          Slik forlenger du levetiden på batteriene dine
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: 'clamp(16px,1.3vw,18px)',
            lineHeight: 1.65,
            color: '#4a4e41',
            margin: '0 0 28px',
            textAlign: 'center',
          }}
        >
          Med noen enkle grep kan du forlenge levetiden på batteriene dine betydelig – spare penger,
          redusere avfall og gjøre hjemmet både tryggere og mer bærekraftig.
        </p>

        {/* Meta */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px 24px',
            fontFamily: 'var(--font-manrope)',
            fontSize: '13px',
            color: '#6b6f63',
            paddingBottom: '28px',
            borderBottom: '1px solid #ddd8ce',
            marginBottom: '36px',
          }}
        >
          <span>Av <strong style={{ color: '#1a1d17', fontWeight: 600 }}>redaksjonen i aBoks</strong></span>
          <span>Oppdatert <strong style={{ color: '#1a1d17', fontWeight: 600 }}>juni 2026</strong></span>
          <span>Lesetid <strong style={{ color: '#1a1d17', fontWeight: 600 }}>ca. 7 min</strong></span>
        </div>

        {/* Intro */}
        <p style={pStyle}>
          Vi tenker sjelden over batteriene før de svikter. Fjernkontrollen som plutselig dør midt i en
          film, røykvarsleren som piper klokken tre om natta, eller leken som stopper på julaften – det er
          som regel først da batteriene får oppmerksomheten vår. Men sannheten er at hvordan du oppbevarer
          og bruker batteriene, har mye å si for hvor lenge de varer. Å forlenge levetiden på batteriene
          dine handler ikke om dyre dingser eller kompliserte triks, men om noen gode vaner som er enkle å
          innføre i hverdagen.
        </p>

        <p style={pStyle}>
          I en gjennomsnittlig norsk husstand finnes det til enhver tid{' '}
          <a
            href="https://www.rogbr.no/tips-om-brannsikkerhet/h%C3%A5ndtering-av-brukte-batterier"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            over 70 batterier
          </a>{' '}
          – i klokker, leker, tannbørster, fjernkontroller, røykvarslere og utallige andre ting. Med så
          mange batterier i omløp blir det fort både dyrt og lite miljøvennlig dersom de tørker ut eller
          kastes før tiden. Den gode nyheten er at små endringer gir stor effekt.
        </p>

        {/* H2: Hvorfor mister batterier kraft */}
        <h2 style={h2Style}>Hvorfor mister batterier kraft – også når de ligger ubrukt?</h2>

        <p style={pStyle}>
          For å ta vare på batteriene er det nyttig å forstå hva som faktisk skjer inni dem. Et batteri
          lader nemlig sakte ut seg selv, selv når det ligger urørt i en skuff. Dette fenomenet kalles
          selvutlading, og det skjer fordi de kjemiske reaksjonene inni batteriet aldri er helt i ro.
        </p>

        <p style={pStyle}>
          Selvutladingen er sterkt temperaturavhengig. En tommelfingerregel fra batteribransjen er at
          selvutladingen omtrent halveres for hver tiende grad temperaturen synker. Motsatt går det også:
          ifølge fagfolk dobles utladingshastigheten for hver tiende grad temperaturen stiger over det
          ideelle. Det betyr at et batteri som ligger varmt og lyst, taper kraft langt raskere enn ett
          som oppbevares kjølig og mørkt.
        </p>

        <p style={pStyle}>
          For vanlige alkaliske batterier – de aller fleste har hjemme – er det også verdt å vite at de
          kan begynne å lekke dersom de blir for gamle eller ligger for varmt. En lekkasje kan ødelegge
          apparatet batteriet sitter i, og rydningsjobben er sjelden hyggelig.
        </p>

        {/* H2: De viktigste grepene */}
        <h2 style={h2Style}>De viktigste grepene for å forlenge levetiden</h2>

        <p style={pStyle}>
          La oss gå rett på det som virker. Her er de rådene som faktisk har mest å si for hvor lenge
          batteriene dine varer.
        </p>

        <h3 style={h3Style}>1. Oppbevar batteriene kjølig og tørt</h3>
        <p style={pStyle}>
          Temperatur er den enkeltfaktoren som påvirker batterienes levetid mest. Alkaliske batterier
          trives best i et stabilt miljø mellom rundt 15 og 25 grader. Et kjølig, tørt rom – uten direkte
          sollys og langt unna ovner og varmekilder – er ideelt. Fuktighet er en fiende: damp og smuss kan
          skape små krypstrømmer mellom polene og øke selvutladingen.
        </p>

        <h3 style={h3Style}>2. Hold nytt og brukt fra hverandre</h3>
        <p style={pStyle}>
          En av de mest undervurderte feilene er å blande fulle og tomme batterier i samme skuff. Da vet
          du aldri hva du faktisk har, gode batterier blir kastet «for sikkerhets skyld», og tomme celler
          blir liggende altfor lenge. Å gi nye og brukte batterier hver sin faste plass er kanskje det
          enkleste organisatoriske grepet som finnes – og det sparer deg for både penger og frustrasjon.
        </p>

        <h3 style={h3Style}>3. Ikke bland gamle og nye batterier i samme apparat</h3>
        <p style={pStyle}>
          Når du bytter batterier i en lommelykt eller en leke, bør alle byttes samtidig. Et eldre,
          svakere batteri vil dra ned de nye, og hele settet tappes raskere. Bruk batterier av samme type
          og merke sammen.
        </p>

        <h3 style={h3Style}>4. Velg riktig batteri til riktig apparat</h3>
        <p style={pStyle}>
          Noen apparater – digitalkameraer, gamingkontrollere og annet strømkrevende utstyr – tærer hardt
          på batteriene. Til slikt bruk lønner det seg ofte med oppladbare batterier av god kvalitet, mens
          en stillegående veggklokke eller en fjernkontroll fint klarer seg med rimelige alkaliske. Sjekk
          gjerne baksiden av pakken, der står det som regel hva batteriet er beregnet for.
        </p>

        <h3 style={h3Style}>5. Ta ut batteriene fra ting du ikke bruker</h3>
        <p style={pStyle}>
          Skal sommerleken, lommelykta eller den sesongbaserte dekorasjonen ligge ubrukt i månedvis? Ta
          ut batteriene. Da unngår du både unødvendig utlading og risikoen for at et glemt batteri lekker
          og ødelegger apparatet.
        </p>

        {/* Blockquote */}
        <blockquote
          style={{
            borderLeft: '4px solid #5e6a48',
            margin: '40px 0',
            padding: '20px 28px',
            background: '#eee9de',
            borderRadius: '0 12px 12px 0',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(20px,2.2vw,26px)',
              lineHeight: 1.4,
              color: '#1a1d17',
              margin: 0,
              fontStyle: 'italic',
            }}
          >
            Det handler ikke om å eie færre batterier, men om å ha oversikt over dem du allerede har.
            Orden er den billigste formen for bærekraft.
          </p>
        </blockquote>

        {/* H2: Oppladbare batterier */}
        <h2 style={h2Style}>Oppladbare batterier krever litt andre vaner</h2>

        <p style={pStyle}>
          Oppladbare batterier – enten det er NiMH-celler i AA-format eller litium-ion-batterier i
          verktøy og elektronikk – følger litt andre spilleregler enn engangsbatteriene.
        </p>

        <p style={pStyle}>
          For litium-ion-batterier anbefaler fagfolk å holde ladenivået et sted mellom 20 og 80 prosent
          i hverdagen. Begge ytterpunktene – helt tomt og helt fullt – belaster cellene. Skal et
          litiumbatteri lagres over lengre tid, for eksempel et verktøybatteri gjennom vinteren, er det
          best å sette det bort med rundt 60–80 prosent lading, på et tørt sted med plussgrader. Et
          viktig poeng som ofte misforstås: det gamle rådet om å legge batterier i kjøleskapet gjelder
          først og fremst alkaliske engangsbatterier. Litium-ion-batterier liker derimot ikke kulde, og
          bør holdes i moderat romtemperatur.
        </p>

        {/* Callout */}
        <div
          style={{
            background: '#eee9de',
            borderLeft: '4px solid #5e6a48',
            borderRadius: '14px',
            padding: '24px 28px',
            margin: '34px 0',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: 'clamp(14px,1vw,16px)',
              color: '#5e6a48',
              margin: '0 0 10px',
            }}
          >
            Vanlig misforståelse
          </p>
          <p style={{ ...pStyle, margin: 0 }}>
            «Alle batterier bør i kjøleskapet.» Ikke helt. Kjølig lagring kan redusere selvutladingen i{' '}
            <em>alkaliske</em> batterier, men da bør de ligge forseglet i en tett beholder og få nå
            romtemperatur før bruk, så det ikke dannes kondens. Oppladbare litium-ion-batterier har
            derimot godt av vanlig, stabil romtemperatur – ikke kulde.
          </p>
        </div>

        {/* H2: Tryggere batterier */}
        <h2 style={h2Style}>Tryggere batterier – også når de er brukt opp</h2>

        <p style={pStyle}>
          Et tema som altfor sjelden nevnes når man snakker om batteriets levetid, er hva som skjer i
          fasen mellom «tomt» og «levert til gjenvinning». For selv et brukt batteri inneholder
          restenergi, og her ligger en reell brannfare.
        </p>

        <p style={pStyle}>
          Ifølge Norsk Industri skyldes{' '}
          <a
            href="https://www.ragnsells.no/om-oss/nyheter-og-presse/artikler/sma-batterier-stor-risiko-for-brann/"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            rundt 85 prosent av brannene på gjenvinningsanlegg med kjent årsak
          </a>{' '}
          nettopp feilsorterte batterier. Når polene på et brukt batteri kommer i kontakt med metall
          eller med polene på et annet batteri, kan det oppstå gnister – på samme måte som med et
          tennstål. Brann- og redningsetaten i Oslo rykker ut til slike branner flere ganger i uken,
          året rundt.
        </p>

        <p style={pStyle}>Derfor er rådet fra fagmiljøene tydelig:</p>

        <div style={{ margin: '4px 0 24px' }}>
          <BulletItem>
            <strong>Teip polene</strong> på brukte batterier med plastteip. Plast leder ikke strøm og hindrer kortslutning.
          </BulletItem>
          <BulletItem>
            <strong>Oppbevar dem i en branntrygg, ikke-metallisk beholder</strong> frem til levering.
          </BulletItem>
          <BulletItem>
            <strong>Ikke samle opp store mengder</strong> – lever batteriene jevnlig.
          </BulletItem>
          <BulletItem>
            <strong>Kast aldri batterier i restavfallet.</strong> Alle batterier regnes som farlig avfall.
          </BulletItem>
        </div>

        <p style={pStyle}>
          Akkurat denne tryggheten er en av grunnene til at en god{' '}
          <Link href="/produkter" style={linkStyle}>
            batteriboks med eget rom for brukte celler
          </Link>{' '}
          gir mer enn bare orden. Når de tomme batteriene har sin egen, faste plass – adskilt og
          oversiktlig – blir det enkelt å håndtere dem trygt, og terskelen for faktisk å levere dem til
          gjenvinning blir mye lavere.
        </p>

        {/* H2: Riktig gjenvinning */}
        <h2 style={h2Style}>Riktig gjenvinning fullfører kretsløpet</h2>

        <p style={pStyle}>
          Når batteriet endelig er brukt opp, er ikke historien over. Brukte batterier som leveres
          riktig, blir til nye råvarer: metaller som sink, nikkel, kobolt og kobber hentes ut og brukes
          om igjen, mens miljøskadelige stoffer tas hånd om på godkjente anlegg. Noen av disse metallene
          er sjeldne og finnes bare i begrensede mengder – så gjenvinning er like mye ressursøkonomi som
          miljøvern.
        </p>

        <p style={pStyle}>
          Det finnes over 20 000 innsamlingssteder for batterier i Norge. Du kan levere brukte batterier
          gratis i alle butikker som selger tilsvarende batterier, eller på din lokale
          gjenvinningsstasjon. På{' '}
          <a
            href="https://sortere.no/batterier"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Sortere.no
          </a>{' '}
          finner du enkle forklaringer på hvordan ulike batterityper skal håndteres, og{' '}
          <a
            href="https://www.miljodirektoratet.no/"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Miljødirektoratet
          </a>{' '}
          har det overordnede ansvaret for regelverket rundt farlig avfall.
        </p>

        {/* H2: Huskeliste / table */}
        <h2 style={h2Style}>En enkel huskeliste for lengre batterilevetid</h2>

        <div style={{ overflowX: 'auto', margin: '0 0 32px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(13px,0.9vw,15px)',
              background: '#f3ede2',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr>
                {['Situasjon', 'Gjør dette'].map((h) => (
                  <th
                    key={h}
                    style={{
                      background: '#39402c',
                      color: '#faf6ee',
                      fontWeight: 700,
                      fontSize: '12px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '13px 18px',
                      textAlign: 'left',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Oppbevaring av nye batterier', 'Kjølig, tørt og mørkt, mellom 15–25 °C, i original eller tett beholder'],
                ['Bytte batterier i et apparat', 'Bytt alle samtidig, samme type og merke'],
                ['Apparat som står ubrukt lenge', 'Ta ut batteriene'],
                ['Litium-ion / oppladbare', 'Hold lading mellom 20–80 %, unngå kulde, romtemperatur ved lagring'],
                ['Brukt, tomt batteri', 'Teip polene, legg i branntrygg boks, lever til gjenvinning'],
              ].map((row, i) => (
                <tr key={row[0]} style={{ background: i % 2 === 1 ? '#faf6ee' : '#f3ede2' }}>
                  <td
                    style={{
                      padding: '13px 18px',
                      color: '#1a1d17',
                      fontWeight: 600,
                      borderBottom: i < 4 ? '1px solid #ddd8ce' : 'none',
                      width: '40%',
                    }}
                  >
                    {row[0]}
                  </td>
                  <td
                    style={{
                      padding: '13px 18px',
                      color: '#4a4e41',
                      borderBottom: i < 4 ? '1px solid #ddd8ce' : 'none',
                    }}
                  >
                    {row[1]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* H2: Orden er nøkkelen */}
        <h2 style={h2Style}>Orden er nøkkelen – ikke flere batterier</h2>

        <p style={pStyle}>
          Når vi i redaksjonen har snakket med folk om batterier, går det igjen ett mønster: problemet er
          sjelden mangel på batterier, men mangel på oversikt. Løse celler ligger spredt i
          kjøkkenskuffen, i sekken, i garasjen og på hjemmekontoret. Du finner aldri de fulle når du
          trenger dem, og de tomme blir liggende altfor lenge – med både svinn og brannrisiko som
          resultat.
        </p>

        <p style={pStyle}>
          Det var nettopp dette behovet{' '}
          <Link href="/produkter" style={linkStyle}>
            aBoks
          </Link>{' '}
          ble laget for å løse. Med tre adskilte rom – ett for nye AA, ett for nye AAA og ett eget rom
          for de brukte – får hvert batteri sin faste plass. Du ser på et blikk hva du har igjen, og hva
          som skal til gjenvinning. Det gjør det enklere å oppbevare batteriene kjølig og samlet, å
          unngå at gode batterier kastes ved en feil, og å håndtere de brukte trygt frem til levering.
          Designet i Norge, med en matt, diskré finish som passer like godt på kjøkkenbenken som i boden.
        </p>

        <p style={pStyle}>
          Å forlenge levetiden på batteriene dine er til syvende og sist en liten vane som lønner seg på
          mange plan samtidig: du sparer penger, du kaster mindre, og du bidrar til et tryggere hjem og
          et bedre miljø. Det er Skandinavisk bærekraft i sin enkleste form – å ta godt vare på det du
          allerede har.
        </p>

        {/* FAQ */}
        <h2 style={{ ...h2Style, margin: '52px 0 24px' }}>Ofte stilte spørsmål</h2>

        <FaqItem q="Bør jeg oppbevare batterier i kjøleskapet?">
          For alkaliske engangsbatterier kan kjølig lagring redusere selvutladingen, men da bør de ligge
          i en tett, forseglet beholder og få nå romtemperatur før bruk, så det ikke dannes kondens. For
          de aller fleste husstander holder det godt å oppbevare batteriene kjølig og tørt ved
          romtemperatur. Oppladbare litium-ion-batterier bør ikke i kjøleskapet – de liker ikke kulde.
        </FaqItem>

        <FaqItem q="Hvor lenge varer egentlig et batteri på lager?">
          Det avhenger av type og oppbevaring. Mange alkaliske batterier har en holdbarhet på flere år
          når de oppbevares riktig – kjølig, tørt og uåpnet. Sjekk «best før»-datoen på pakken, og
          oppbevar batteriene så stabilt som mulig for å nå den fulle holdbarheten.
        </FaqItem>

        <FaqItem q="Hvorfor lekker batterier, og hvordan unngår jeg det?">
          Alkaliske batterier kan lekke når de blir for gamle, tappes for fort eller oppbevares varmt. Ta
          ut batteriene fra apparater du ikke bruker, bland aldri gamle og nye, og oppbevar dem kjølig.
          Et lekket batteri kan ødelegge apparatet, så det er verdt å forebygge.
        </FaqItem>

        <FaqItem q="Må jeg virkelig teipe polene på brukte batterier?">
          Ja, det anbefales sterkt. Selv tomme batterier har restenergi, og hvis polene kortslutter mot
          metall eller andre batterier, kan det oppstå gnister og i verste fall brann. Plastteip leder
          ikke strøm og er en svært enkel sikkerhetsforanstaltning frem til levering.
        </FaqItem>

        <FaqItem q="Hvor leverer jeg brukte batterier?">
          Du kan levere brukte batterier gratis i alle butikker som selger tilsvarende batterier, eller
          på din lokale gjenvinningsstasjon. Det finnes over 20 000 innsamlingssteder i Norge. Batterier
          skal aldri kastes i restavfallet, da de regnes som farlig avfall.
        </FaqItem>

        {/* CTA block */}
        <div
          style={{
            background: '#5e6a48',
            borderRadius: '20px',
            padding: 'clamp(32px,4vw,52px)',
            margin: '56px 0 0',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(24px,3vw,36px)',
              letterSpacing: '-0.015em',
              lineHeight: 1.15,
              color: '#faf6ee',
              margin: '0 0 14px',
            }}
          >
            Klar for orden i batteriene?
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(14px,1vw,16px)',
              lineHeight: 1.65,
              color: 'rgba(250,246,238,0.85)',
              margin: '0 0 24px',
              maxWidth: '420px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Én smart boks med tre rom – for nye AA, nye AAA og brukte batterier. Full oversikt fra dag
            én, designet i Norge.
          </p>
          <Link
            href="/produkter"
            data-btn
            style={{
              display: 'inline-block',
              background: '#faf6ee',
              color: '#39402c',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.03em',
              textDecoration: 'none',
              padding: '15px 34px',
              borderRadius: '100px',
            }}
          >
            Se aBoks
          </Link>
        </div>

        {/* Tags */}
        <div style={{ marginTop: '48px' }}>
          {[
            'batterilevetid',
            'batterioppbevaring',
            'oppladbare batterier',
            'batterigjenvinning',
            'hjemmeorganisering',
            'bærekraftig hjem',
            'AA-batterier',
            'AAA-batterier',
            'batterisikkerhet',
          ].map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>

        {/* Sources */}
        <div
          style={{
            marginTop: '44px',
            paddingTop: '28px',
            borderTop: '1px solid #ddd8ce',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#6b6f63',
              margin: '0 0 14px',
            }}
          >
            Kilder og videre lesning
          </p>
          {[
            { label: 'Miljødirektoratet', href: 'https://www.miljodirektoratet.no/' },
            { label: 'Sortere.no (LOOP)', href: 'https://sortere.no/batterier' },
            { label: 'Ragn-Sells / Norsk Industri – Små batterier, stor risiko for brann', href: 'https://www.ragnsells.no/om-oss/nyheter-og-presse/artikler/sma-batterier-stor-risiko-for-brann/' },
            { label: 'Rogaland brann og redning – Håndtering av brukte batterier', href: 'https://www.rogbr.no/tips-om-brannsikkerhet/h%C3%A5ndtering-av-brukte-batterier' },
          ].map((s) => (
            <p key={s.href} style={{ ...pStyle, fontSize: '13px', margin: '0 0 8px' }}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                {s.label}
              </a>
            </p>
          ))}
          <p style={{ ...pStyle, fontSize: '13px', color: '#6b6f63', margin: '8px 0 0', fontStyle: 'italic' }}>
            Samt råd fra batteriprodusenter og fagmiljøer om temperatur og lagring.
          </p>
        </div>

      </div>
    </main>
  )
}
