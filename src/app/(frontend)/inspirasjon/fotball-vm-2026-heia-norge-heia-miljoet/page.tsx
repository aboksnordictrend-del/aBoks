import type { Metadata } from 'next'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'fotball-vm-2026-heia-norge-heia-miljoet',
    title: 'Fotball-VM 2026: Heia Norge – og heia miljøet! | aBoks',
    description:
      'Norge er tilbake i fotball-VM. Slik gjør du fotballkvelden hjemme både god og bærekraftig – batterier klare til fjernkontroll og speaker, brukte batterier trygt til resirkulering.',
    ogTitle: 'Fotball-VM 2026: Heia Norge – og heia miljøet! | aBoks',
    ogDescription:
      'En varm, praktisk guide til fotball-VM 2026 sett fra sofaen: hvordan du forbereder fotballkvelden hjemme, holder batteriene til fjernkontroll, speaker og kontroller klare, og oppbevarer og resirkulerer brukte batterier trygt.',
  }),
  keywords: [
    'fotball-VM 2026', 'Norge i VM', 'fotballkveld', 'se fotball hjemme',
    'batterier til fjernkontroll', 'brukte batterier', 'resirkulering',
    'batterioppbevaring', 'bærekraftig hjem', 'brannsikkerhet',
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Fotball-VM 2026: Heia Norge – og heia miljøet!</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Bærekraftig hjem · Fotballkveld
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Fotball-VM 2026: Heia Norge – <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>og heia miljøet!</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Norge er tilbake i et verdensmesterskap for første gang siden 1998. Her er
              hvordan du gjør fotballkvelden hjemme både uforglemmelig og litt mer
              bærekraftig – uten at noe dør midt i andre omgang.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 7 min · Juli 2026
            </p>
          </header>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <p style={pStyle}>
              Fotball-VM 2026 er her, og for norske fotballelskere er det noe helt
              spesielt i lufta. For første gang siden Frankrike 1998 er Norge tilbake
              blant verdens beste, etter en kvalifisering der laget vant alle åtte kampene
              og herjet gjennom en tøff gruppe. Sommeren tilbringes foran skjermen – ofte
              midt på natten, takket være tidsforskjellen til USA, Canada og Mexico. Og
              akkurat der, i sofaen, begynner en fortelling som handler like mye om
              hjemmet vårt som om fotballen.
            </p>

            <p style={pStyle}>
              For en god fotballkveld hjemme krever mer enn engasjement og et flagg på
              veggen. Den krever at teknikken faktisk virker: at fjernkontrollen svarer,
              at høyttaleren spiller nasjonalsangen, og at ingen må lete i skuffer etter et
              ferskt batteri akkurat idet Haaland gjør seg klar til avspark. Denne
              artikkelen handler om nettopp den lille, praktiske siden av fotballfesten –
              og om hvordan noen enkle vaner gjør kvelden både smidigere og mer
              miljøvennlig.
            </p>

            <h2 style={h2Style}>Norge i VM – og en sommer foran skjermen</h2>

            <p style={pStyle}>
              La oss først ta stemningen. Norges gruppespill i fotball-VM 2026 ble spilt i
              Boston og New York/New Jersey, og for oss hjemme betød det noen sene netter.
              Åpningskampen mot Irak gikk av stabelen natt til 17. juni klokken 00:00 norsk
              tid, kampen mot Senegal fulgte natt til 23. juni klokken 02:00, mens
              oppgjøret mot storfavoritt Frankrike ble sendt i beste sendetid fredag 26.
              juni klokken 21:00.<Cite n={1} />
            </p>

            <p style={pStyle}>
              Poenget er enkelt: en stor del av VM foregår på tidspunkter der resten av
              huset sover. Da vil mange se fotball hjemme på sin egen måte – noen i sofaen
              med lyden lavt, andre i senga med nettbrett og øreplugger, og noen med venner
              samlet rundt storskjermen. Uansett form er det de samme dingsene som skal
              fungere: fjernkontrollen til TV-en, høyttaleren, den trådløse
              hodetelefonen, spillkontrolleren for dem som varmer opp med litt FIFA før
              avspark. Alle går de på batterier eller trenger lading – og alle har en
              irriterende tendens til å svikte i det mest kritiske øyeblikket.
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              En fotballkveld avslører hjemmets små systemsvikt: det er alltid
              fjernkontrollen som dør akkurat når dommeren blåser i fløyta.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                aBoks redaksjon
              </footer>
            </blockquote>

            <h2 style={h2Style}>Batterier til fjernkontroll, speaker og alt det andre</h2>

            <p style={pStyle}>
              Visste du at en gjennomsnittlig norsk husholdning til enhver tid har over 70
              batterier i hus? Det er tallet{' '}
              <a href="https://www.rogbr.no/tips-om-brannsikkerhet/h%C3%A5ndtering-av-brukte-batterier" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                brannvesenet opplyser
              </a>,<Cite n={4} /> og det er lett å tro på når man tenker etter:
              fjernkontroller, klokker, røykvarslere, leker, tastaturer, veggmus,
              hodelykter, digitale kjøkkenvekter. Fotballkvelden setter bare et lite
              forstørrelsesglass på et batteriforbruk vi ellers knapt legger merke til.
            </p>

            <p style={pStyle}>
              Utfordringen er sjelden at vi mangler batterier. Den er at vi ikke vet hvor
              de er, eller hvilke som fortsatt har liv. Løse batterier havner i
              kjøkkenskuffen sammen med nøkler, binders og gamle kvitteringer, og der
              ligger de – noen splitter nye, noen halvtomme, noen helt utladet – uten at vi
              klarer å skille dem fra hverandre. Resultatet er at fullt brukbare batterier
              kastes, mens de tomme blir liggende altfor lenge.
            </p>

            <p style={pStyle}>Før en fotballkveld lønner det seg derfor med en liten sjekkrunde:</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem><strong>Fjernkontrollen til TV-en.</strong> Den viktigste av alle. Ha et par ferske AA- eller AAA-batterier klare, så slipper du å bytte i mørket midt i kampen.</BulletItem>
              <BulletItem><strong>Høyttaleren.</strong> Skal nasjonalsangen og jubelen fylle stua, må speakeren være ladet eller ha friske batterier i god tid før avspark.</BulletItem>
              <BulletItem><strong>Trådløse hodetelefoner.</strong> Perfekt for nattkampene mot Irak og Senegal, der du kan følge dramaet uten å vekke resten av huset. Lad dem på ettermiddagen.</BulletItem>
              <BulletItem><strong>Spillkontrolleren.</strong> For dem som varmer opp med en runde fotballspill – kontrolleren spiser AA-batterier eller trenger en runde i laderen.</BulletItem>
            </ul>

            <p style={pStyle}>
              Med litt oversikt tar hele sjekken to minutter. Poenget er ikke å kjøpe mer,
              men å vite hva du allerede har – og å ha nye og brukte batterier tydelig
              atskilt, slik at du aldri setter et tomt batteri tilbake i fjernkontrollen
              ved en feil.
            </p>

            <h2 style={h2Style}>Brukte batterier: den delen de fleste glemmer</h2>

            <p style={pStyle}>
              Så kommer den delen av historien som er lett å overse. Når batteriet i
              fjernkontrollen endelig gir opp, hva skjer med det? For altfor mange havner
              det rett i restavfallet – eller blir liggende i en skuff «til senere», et
              senere som sjelden kommer.
            </p>

            <p style={pStyle}>
              Det er her det blir alvor, og her hjemmet vårt faktisk kan gjøre en
              forskjell. Brukte batterier skal aldri i restavfallet. Ifølge{' '}
              <a href="https://www.dsb.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Direktoratet for samfunnssikkerhet og beredskap (DSB)
              </a>{' '}
              regnes batterier som farlig avfall, og feilkastede batterier utgjør en reell
              brannrisiko – i søppelbøtta hjemme, i renovasjonsbilen og på
              gjenvinningsanlegget.<Cite n={2} /> Avfallsselskapet{' '}
              <a href="https://www.ragnsells.no/om-oss/nyheter-og-presse/artikler/sma-batterier-stor-risiko-for-brann/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Ragn-Sells rapporterer at hele 85 prosent
              </a>{' '}
              av brannene på gjenvinningsanlegg med kjent årsak skyldes nettopp
              batterier.<Cite n={5} />
            </p>

            <p style={pStyle}>
              Grunnen er enkel fysikk: selv et «tomt» batteri har restenergi igjen. Kommer
              polene i kontakt med metall – en nøkkel, en mynt, et annet batteri – kan det
              oppstå en gnist. Og én gnist er nok til å starte en brann. Derfor gir både
              brannvesenet og{' '}
              <a href="https://www.miljodirektoratet.no/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Miljødirektoratet
              </a>{' '}
              det samme rådet: teip polene, oppbevar batteriene trygt, og lever dem inn
              regelmessig.<Cite n={3} />
            </p>

            <Callout label="Vanlig misforståelse">
              <p style={{ ...h3Style, margin: '0 0 10px' }}>«Batteriet er jo helt tomt – da er det ufarlig»</p>
              <p style={{ ...pStyle, margin: 0 }}>
                Nei. Et brukt batteri virker kanskje dødt i fjernkontrollen, men det
                inneholder fortsatt nok restenergi til å skape en gnist hvis polene
                kortslutter mot metall. Det er derfor fagfolk anbefaler å teipe polene og
                oppbevare brukte batterier for seg selv – ikke løst i roteskuffen sammen
                med nøkler og mynter.
              </p>
            </Callout>

            <h3 style={h3Style}>Slik håndterer du brukte batterier trygt hjemme</h3>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <NumberedItem n={1}><strong>Teip polene.</strong> Sett en bit vanlig teip over polene på hvert brukt batteri. Det hindrer kortslutning og gnistdannelse.</NumberedItem>
              <NumberedItem n={2}><strong>Samle dem på ett fast sted.</strong> Bruk en egen beholder – ikke restavfallet, og ikke skuffen med alt annet.</NumberedItem>
              <NumberedItem n={3}><strong>Ikke hamstre.</strong> Fagfolk anbefaler å ikke lagre opp store mengder hjemme, men å levere jevnlig.</NumberedItem>
              <NumberedItem n={4}><strong>Lever til gjenvinning.</strong> Alle butikker som selger batterier er pliktige til å ta imot brukte batterier, og gjenvinningsstasjonene tar imot alt.</NumberedItem>
            </ol>

            <p style={pStyle}>
              Fotballsommeren er faktisk et fint tidspunkt å starte en slik vane. Du bruker
              uansett litt batterier ekstra i disse ukene – så la de tomme gå rett i en
              egen boks med en gang, i stedet for tilbake i skuffen.
            </p>

            <h2 style={h2Style}>En liten miljøhandling med stor betydning</h2>

            <p style={pStyle}>
              At det nytter, er godt dokumentert. Norge har lang tradisjon for innsamling
              av farlig avfall, og returselskapene samler i dag inn rundt 65 prosent av de
              bærbare batteriene som settes på markedet – et nivå Miljødirektoratet{' '}
              <a href="https://www.miljodirektoratet.no/aktuelt/fagmeldinger/2023/desember-2023/ny-innsamlingsplikt-av-lose-batterier-blir-65-prosent" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                nå har forskriftsfestet som minstekrav
              </a>.<Cite n={3} /> EUs batteriforordning skjerper kravene ytterligere fram
              mot 2030. Hvert batteri som leveres riktig, betyr at verdifulle materialer
              kan gjenvinnes til nye produkter i stedet for å gå tapt – og at ett
              potensielt branntilløp mindre oppstår.
            </p>

            <p style={pStyle}>
              Det fine er at dette ikke krever en livsstilsendring. Det krever et system.
              Når nye og brukte batterier har en fast plass i hjemmet – gjerne like ved
              TV-en, der fjernkontrollene uansett bor – blir det naturlig å ta det riktige
              batteriet, og like naturlig å legge det brukte i riktig rom når det er
              ferdig.
            </p>

            {/* Kampprogram-tabell */}
            <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', minWidth: '520px',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {['Kamp', 'Dato (norsk tid)', 'Avspark', 'Dings som må virke'].map((h) => (
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
                    ['Irak – Norge', 'Natt til 17. juni', '00:00', 'Hodetelefon (nattkamp)'],
                    ['Norge – Senegal', 'Natt til 23. juni', '02:00', 'Nettbrett + øreplugger'],
                    ['Norge – Frankrike', 'Fredag 26. juni', '21:00', 'Fjernkontroll + høyttaler'],
                  ].map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: '12px 16px',
                          borderBottom: i < 2 ? '1px solid #ece8e1' : 'none',
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
              Kilder: Norges Fotballforbund og TV 2/NRK (kampprogram). Alle tidspunkter i norsk tid.
            </p>

            <p style={pStyle}>
              Uansett hvor langt Norge går i mesterskapet, gjentar mønsteret seg for hver
              eneste kamp: dingsene skal virke, og batteriene de går på skal til slutt
              leveres inn. Jo enklere du har gjort det for deg selv på forhånd, desto mer
              kan du konsentrere deg om det som faktisk teller – fotballen.
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
              }}>Praktisk løsning</span>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(20px,1.8vw,26px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 16px',
              }}>
                Full oversikt – også midt i en fotballkamp
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Det var akkurat dette rotet{' '}
                <Link href="/produkter/aboks?variant=ABOKS-OLIVE-001" style={{ color: '#dfe6ee', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  aBoks
                </Link>{' '}
                ble laget for å løse. Én boks med tre adskilte rom gir de nye
                AA-batteriene, de nye AAA-batteriene og de brukte hver sin faste plass. Du
                ser på et blikk hva du har igjen til fjernkontrollen og speakeren, og de
                tomme havner i sitt eget rom – trygt oppbevart til de leveres til
                gjenvinning.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                {[
                  'Eget rom for nye AA og nye AAA – alltid klare til bruk',
                  'Eget rom for brukte batterier, så de faktisk når gjenvinningen',
                  'Matt, diskré design som passer like godt ved TV-en som på kjøkkenet',
                ].map((t) => (
                  <li key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '5px 0' }}>
                    <span style={{ flexShrink: 0, width: '7px', height: '7px', borderRadius: '50%', background: '#c8cebb', marginTop: '9px' }} />
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.75, color: '#c8cebb' }}>{t}</span>
                  </li>
                ))}
              </ul>
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
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9fb08f', margin: '16px 0 0' }}>
                Designet i Norge · fri frakt over kr 650
              </p>
            </div>

            <p style={pStyle}>
              Sett den gjerne ved siden av TV-en før den første kampen. Da er både de
              ferske og de brukte batteriene på plass når laget trenger deg som mest – og
              du har lagt grunnlaget for en vane som varer lenge etter at VM er over. Vil
              du gå grundigere til verks, har vi samlet flere råd i guiden{' '}
              <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                slik sorterer du batteriene riktig hjemme
              </Link>, og en egen artikkel om{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>.
            </p>

            <h2 style={h2Style}>Fotballkveld med god samvittighet</h2>

            <p style={pStyle}>
              Det er noe fint i tanken: mens Norge kjemper på banen på den andre siden av
              Atlanteren, kan hver av oss gjøre vår egen lille innsats hjemme i stua. Ikke
              ved å ofre noe av festen, men ved å ordne opp i det som uansett roter. En
              fjernkontroll som virker. En høyttaler som spiller. Og en fast plass for de
              brukte batteriene, slik at de ender der de skal – på gjenvinning, ikke i
              naturen.
            </p>

            <p style={pStyle}>
              Heia Norge, altså. Og heia miljøet. De to trenger slett ikke stå i
              motsetning til hverandre – noen ganger møtes de i det aller enkleste: en godt
              organisert fotballkveld hjemme.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">Ofte stilte spørsmål</h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Når spiller Norge i fotball-VM 2026?">
                Norges gruppespillkamper ble spilt i norsk tid natt til 17. juni (mot
                Irak, kl. 00:00), natt til 23. juni (mot Senegal, kl. 02:00) og fredag 26.
                juni (mot Frankrike, kl. 21:00). To av tre kamper gikk altså midt på natten
                på grunn av tidsforskjellen til USA. Sluttspillkampene følger etter hvert
                som laget avanserer – sjekk NRK eller TV 2 for oppdatert program, siden
                begge kanaler deler sendingene.
              </FaqItem>
              <FaqItem question="Hvilke batterier trenger jeg til fjernkontrollen?">
                De aller fleste fjernkontroller bruker AA- eller AAA-batterier. Ha begge
                typer klare i friske eksemplarer før en fotballkveld, så unngår du å bytte
                i mørket midt i kampen. Vil du vite mer om hvilke batterier som passer til
                hva, har vi laget en{' '}
                <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                  komplett guide for hjemmet
                </Link>.
              </FaqItem>
              <FaqItem question="Kan jeg kaste brukte batterier i restavfallet?">
                Nei. Batterier regnes som farlig avfall og skal aldri i restavfallet.
                Feilkastede batterier er en av de vanligste årsakene til brann i
                avfallsbeholdere, søppelbiler og på gjenvinningsanlegg. Teip polene,
                oppbevar dem trygt, og lever dem til en butikk som selger batterier eller
                til nærmeste gjenvinningsstasjon.
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg teipe polene på brukte batterier?">
                Selv et brukt batteri har litt restenergi igjen. Hvis polene kommer i
                kontakt med metall eller med hverandre, kan det oppstå kortslutning og en
                gnist – nok til å starte en brann. En bit vanlig teip over polene hindrer
                dette og gjør oppbevaringen trygg fram til levering.
              </FaqItem>
              <FaqItem question="Hvordan holder jeg orden på nye og brukte batterier?">
                Nøkkelen er å gi batteriene en fast plass og å skille nye fra brukte, slik
                at du aldri setter et tomt batteri tilbake i fjernkontrollen. En egen
                batteriboks med atskilte rom – som aBoks – gjør nettopp dette: nye AA, nye
                AAA og et eget rom for de brukte som skal til gjenvinning. Da har du
                oversikt både før avspark og lenge etter at VM er over.
              </FaqItem>
            </div>

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Les mer fra aBoks</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <BulletItem>
                  <Link href="/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme" style={extLink}>
                    Slik sorterer du batteriene riktig hjemme
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                    Hvorfor det lønner seg å levere inn brukte batterier
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/orden-i-skuffen" style={extLink}>
                    Orden i skuffen – 5 tips for et ryddigere og tryggere hjem
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
                  { label: 'Norges Fotballforbund – Medieguide og kampprogram VM 2026', url: 'https://www.fotball.no/landslag/norge-a-herrer/vm-2026/' },
                  { label: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) – om batterier og brannrisiko', url: 'https://www.dsb.no/' },
                  { label: 'Miljødirektoratet – innsamlingsplikt for løse batterier', url: 'https://www.miljodirektoratet.no/' },
                  { label: 'Rogaland brann og redning – håndtering av brukte batterier', url: 'https://www.rogbr.no/tips-om-brannsikkerhet/h%C3%A5ndtering-av-brukte-batterier' },
                  { label: 'Ragn-Sells – små batterier, stor brannrisiko', url: 'https://www.ragnsells.no/om-oss/nyheter-og-presse/artikler/sma-batterier-stor-risiko-for-brann/' },
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
                  'Fotball-VM 2026', 'Norge i VM', 'Fotballkveld', 'Se fotball hjemme',
                  'Batterier til fjernkontroll', 'Brukte batterier', 'Resirkulering',
                  'Batterioppbevaring', 'Bærekraftig hjem', 'Brannsikkerhet',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
