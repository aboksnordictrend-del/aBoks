import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'
import ArticleStructuredData from '../_components/ArticleStructuredData'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'oppbevare-batterier-trygt-hjemme',
    title: 'Oppbevaring av batterier hjemme – nye og brukte | aBoks',
    description:
      'Hvordan oppbevare nye og brukte batterier hjemme? Få råd om AA og AAA, teiping av poler og om batterier bør ligge i kjøleskapet.',
    ogDescription:
      'Praktiske råd om oppbevaring av nye og brukte batterier hjemme: temperatur, kjøleskap, teiping av poler, skadde batterier og innlevering. Basert på råd fra batteriprodusenter, brannvesen og norske kommuner.',
  }),
  keywords: [
    'oppbevare batterier', 'oppbevaring av batterier hjemme', 'oppbevare nye batterier',
    'batterier i kjøleskap', 'brukte batterier', 'teipe poler',
    'batterisikkerhet', 'litiumbatterier', 'gjenvinning batterier', 'batteriboks',
  ],
}

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon'

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

function FactBox({ value, unit, children }: { value: string; unit?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 'clamp(18px,2vw,28px)',
      flexWrap: 'wrap', margin: '36px 0', padding: '26px 30px',
      background: '#eee9de', borderRadius: '16px',
    }}>
      <span style={{
        fontFamily: 'var(--font-cormorant)', fontWeight: 600,
        fontSize: 'clamp(38px,4vw,52px)', lineHeight: 1,
        letterSpacing: '-0.02em', color: '#39402c', flexShrink: 0,
      }}>
        {value}
        {unit ? <span style={{ fontSize: '0.45em', marginLeft: '2px' }}>{unit}</span> : null}
      </span>
      <p style={{
        fontFamily: 'var(--font-manrope)', fontSize: 'clamp(14px,1vw,15px)',
        lineHeight: 1.7, color: '#4a4e41', margin: 0, flex: '1 1 260px',
      }}>
        {children}
      </p>
    </div>
  )
}

function DataTable({ headers, rows, caption }: { headers: string[]; rows: string[][]; caption: string }) {
  return (
    <>
      <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse', minWidth: '560px',
          fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
          background: '#fff', borderRadius: '12px', overflow: 'hidden',
        }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} style={{
                  textAlign: 'left', padding: '13px 16px',
                  background: '#39402c', color: '#faf6ee',
                  fontWeight: 600, letterSpacing: '0.02em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[0]}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: '12px 16px',
                    borderBottom: i < rows.length - 1 ? '1px solid #ece8e1' : 'none',
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
        {caption}
      </p>
    </>
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

/** All article images are 1672×941; width/height reserve the space so nothing shifts on load. */
function ArticleImage({ src, alt, caption, priority }: { src: string; alt: string; caption?: string; priority?: boolean }) {
  return (
    <figure style={{ margin: '36px 0' }}>
      <Image
        src={src}
        alt={alt}
        width={1672}
        height={941}
        priority={priority}
        sizes="(max-width: 768px) calc(100vw - 40px), 720px"
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '16px', background: '#eee9de' }}
      />
      {caption ? (
        <figcaption style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', lineHeight: 1.6, color: '#696a62', margin: '10px 4px 0' }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

const TYPE_ROWS: string[][] = [
  ['Alkaliske (AA/AAA)', 'Fjernkontroller, leker, klokker', 'Tørt, ved romtemperatur. Lekker oftest når tomme batterier blir stående i apparatet.'],
  ['Oppladbare (NiMH)', 'Kamera, spillkontroller, lykter', 'Tåler mange ladesykluser. Ikke la dem ligge utladet lenge – lad dem opp innimellom.'],
  ['Litium-ion', 'Mobil, verktøy, elsykkel', 'Krever mest forsiktighet. Lagres helst halvladet, unngå slag og varme.'],
  ['Knappceller', 'Høreapparat, bilnøkkel, kort', 'Svelgefare for barn. Teip og oppbevar utilgjengelig.'],
]

const SOURCES = [
  { label: 'Energizer – Battery Care: lagring, temperatur og kortslutning', url: 'https://energizer.com/about-batteries/battery-care/' },
  { label: 'Energizer – Non-Rechargeable Batteries: Frequently Asked Questions (PDF, kjøleskap, lagringstid og lekkasje)', url: 'https://data.energizer.com/pdfs/non-rechargeable_faq.pdf' },
  { label: 'Bergen brannvesen – Slik oppbevarer, lader og kaster du batterier og batteriprodukter', url: 'https://www.bergen.kommune.no/innbyggerhjelpen/brannvern-samfunnssikkerhet-og-beredskap/brann-og-redning/brannsikkerhet-hjemme/slik-oppbevarer-lader-og-kaster-du-batterier-og-batteriprodukter' },
  { label: 'Oslo kommune – Farlig avfall og elektronisk/elektrisk avfall', url: 'https://www.oslo.kommune.no/avfall-og-gjenvinning/hvordan-kildesortere-i-oslo/farlig-avfall-og-elektronisk-elektrisk-avfall/' },
  { label: 'Asker kommune – Batterier som kastes feil kan starte brann', url: 'https://www.asker.kommune.no/avfall-og-gjenvinning/aktuelt-om-avfall-og-gjenvinning/batterier-og-brannfare/' },
  { label: 'Bærum kommune – Lite batteri kan starte stor brann', url: 'https://www.baerum.kommune.no/tjenester/avfall-og-gjenvinning/slik-gjor-du/lite-batteri-kan-starte-stor-brann/' },
  { label: 'Norsk Industri – Brannstatistikk 2025 for gjenvinningsbransjen', url: 'https://www.norskindustri.no/bransjer/gjenvinning/aktuelt/brannstatistikk/' },
  { label: 'Norsk Industri, NHO, Avfall Norge m.fl. – Informasjonsskriv: Viktig med rett håndtering av brukte batterier (PDF)', url: 'https://www.norskindustri.no/siteassets/dokumenter/rapporter-og-brosjyrer/infoskriv---batterier.pdf' },
]

export default function ArticlePage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <ArticleStructuredData slug="oppbevare-batterier-trygt-hjemme" />
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
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Oppbevare batterier trygt hjemme</span>
        </div>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Sikkerhet &amp; bærekraft
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvordan{' '}
              <em style={{ fontStyle: 'italic', color: '#5e6a48' }}>oppbevare batterier trygt hjemme</em>?
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Oppbevar nye batterier tørt og ved vanlig romtemperatur, helst i originalpakningen
              eller i en boks der polene ikke kan komme borti nøkler, mynter og andre metallting.
              Hold brukte batterier for seg. Vanlige AA- og AAA-batterier trenger du ikke å legge
              i kjøleskapet.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              Av redaksjonen · Lesetid ca. 8 min · Publisert august 2026 · Oppdatert oktober 2026
            </p>
          </header>

          <ArticleImage
            src={`${BLOB}/batterioppbevaring-hjemme-hero.webp`}
            alt="AA- og AAA-batterier organisert på et bord hjemme"
            priority
          />

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <h2 style={{ ...h2Style, marginTop: '40px' }}>Hvordan oppbevare nye batterier?</h2>

            <p style={pStyle}>
              Vanlige alkaliske AA- og AAA-batterier er ikke kresne. Energizer anbefaler et kjølig,
              tørt sted ved normal romtemperatur, og i produsentens egne spørsmål og svar står det
              20–25 °C. Et skap eller en skuff inne i boligen holder altså fint. Det du bør unngå,
              er varme og fukt: vinduskarmen i sola, hylla over ovnen, hanskerommet i bilen om
              sommeren eller en kald bod der det slår seg fuktighet. Høy temperatur over tid gir
              kortere lagringstid og øker faren for lekkasje.
            </p>

            <p style={pStyle}>
              Originalpakningen er en undervurdert oppbevaringsløsning. Den holder batteriene fra
              hverandre, så polene ikke ligger mot andre batterier eller mot metall. Løse batterier
              i en skuff med mynter, binders og nøkler kan kortslutte, og et kortsluttet batteri kan
              ifølge Energizer bli svært varmt og begynne å lekke. Har du åpnet en pakke og brukt
              halvparten, legg resten tilbake i pappen eller i en boks med faste rom, så de ikke
              triller rundt.
            </p>

            <ArticleImage
              src={`${BLOB}/hvordan-oppbevare-nye-batterier.webp`}
              alt="Nye AA- og AAA-batterier oppbevart ryddig i en skuff"
            />

            <p style={pStyle}>
              Hold også de nye og de brukte i hver sin beholder. Ligger alt i samme skuff, er det
              lett å sette inn et halvbrukt batteri sammen med tre nye. Det svake batteriet blir da
              tappet helt av de andre, og Energizer skriver at faren for lekkasje øker når nye og
              brukte blandes i samme apparat. Bytt derfor alle batteriene i et apparat samtidig,
              og bruk samme type og merke.
            </p>

            <p style={pStyle}>
              Rådene over gjelder vanlige alkaliske batterier. Oppladbare batterier og
              litiumbatterier har egne hensyn, blant annet ladenivå før lagring, og der er det
              produsentens anvisning som gjelder. Vi har skrevet mer om det i guiden om{' '}
              <Link href="/inspirasjon/langtidsoppbevaring-oppladbare-batterier" style={extLink}>
                langtidsoppbevaring av oppladbare batterier
              </Link>
              .
            </p>

            <h2 style={h2Style}>Skal batterier oppbevares i kjøleskap?</h2>

            <p style={pStyle}>
              Nei. Vanlige husholdningsbatterier trenger ikke oppbevares i kjøleskapet.
            </p>

            <p style={pStyle}>
              Energizer skriver at kjøleskap og fryser verken er nødvendig eller anbefalt for
              batterier som lages i dag. Ved romtemperatur oppgir produsenten en lagringstid på fem
              til ti år for alkaliske AA- og AAA-batterier, så det er lite å hente på å kjøle dem
              ned.
            </p>

            <p style={pStyle}>
              Kjøleskapet kan tvert imot gjøre skade. Tar du et kaldt batteri ut i varm kjøkkenluft,
              kan det dannes kondens på det. Ifølge Energizer kan fukten gi korrosjon på polene
              eller skade etiketten og forseglingen.
            </p>

            <ArticleImage
              src={`${BLOB}/batterier-i-kjoleskap.webp`}
              alt="AA-batterier på kjøkkenbenken ved siden av et åpent kjøleskap"
            />

            <p style={pStyle}>
              Et kjølig og tørt skap er derfor et bedre valg enn både kjøleskapet og skuffen ved
              siden av komfyren. Har du batterier til spesialutstyr, for eksempel kamera eller
              medisinsk utstyr, følger du produsentens anvisning for akkurat dem.
            </p>

            <h2 style={h2Style}>Hvordan oppbevare brukte batterier før levering?</h2>

            <p style={pStyle}>
              Et brukt batteri er sjelden helt tomt, og det er derfor de skal ha sin egen plass,
              adskilt fra de nye og på et tørt sted. Bergen brannvesen sier det slik:
            </p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '32px 0',
              fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
              fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c',
            }}>
              Det er alltid noe restenergi igjen i brukte batterier. Teip derfor polene og finn en
              branntrygg beholder du kan oppbevare dem i.
              <footer style={{
                marginTop: '14px', fontStyle: 'normal',
                fontFamily: 'var(--font-manrope)', fontSize: '12px',
                color: '#5e6a48', letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 700,
              }}>
                Bergen brannvesen
              </footer>
            </blockquote>

            <p style={pStyle}>
              Eksemplet brannvesenet gir, er et stort syltetøyglass med lokk. Asker kommune nevner
              også en liten boks, og poenget er det samme: ett fast sted, lukket, uten løse
              metallting oppi. Bærum kommune advarer spesielt mot å slenge brukte batterier i
              kjøkkenskuffen.
            </p>

            <h3 style={h3Style}>Når bør du teipe polene?</h3>

            <p style={pStyle}>
              Teip polene med en gang du legger batteriet til side for innlevering. Oslo kommune
              anbefaler en teipbit på hver pol, slik at polene ikke kan gnisse mot andre batterier
              eller overflater. Asker kommune foreslår å ha en teiprull liggende i glasset, så du
              gjør det fortløpende i stedet for å ta alle til slutt.
            </p>

            <p style={pStyle}>
              Rådet fra kommunene gjelder brukte batterier generelt, ikke bare enkelte typer. Bruk
              teip som ikke leder strøm, for eksempel isolasjonsteip. Aluminiumsteip leder strøm
              og passer ikke til dette.
            </p>

            <h3 style={h3Style}>Hovne, lekkende eller skadde batterier</h3>

            <p style={pStyle}>
              Et batteri som er hovent, lekker eller har synlige skader, skal ikke ligge sammen med
              de vanlige brukte batteriene. Legg det for seg selv og lever det på
              gjenvinningsstasjonen så snart du kan. Er du usikker på hvordan stasjonen vil ha det
              levert, kan du spørre der. Lekker et alkalisk batteri, er væsken etsende. Unngå å ta på
              den med bare hender, og får du den på huden, skyll med rikelig vann i et kvarter og
              kontakt lege, slik Energizer anbefaler.
            </p>

            <h3 style={h3Style}>Lever før det hoper seg opp</h3>

            <p style={pStyle}>
              Bransjen selv, med Norsk Industri, NHO og Avfall Norge, ber forbrukere unngå å samle
              opp store mengder og heller levere jevnlig. Butikker som selger batterier, tar imot
              brukte batterier av samme type gratis, og gjenvinningsstasjonene tar også imot
              batterier. Hvor du kan levere hva, har vi samlet i guiden om{' '}
              <Link href="/inspirasjon/hvor-levere-brukte-batterier" style={extLink}>
                hvor du kan levere brukte batterier
              </Link>
              . Og hvorfor det betyr noe, kan du lese i{' '}
              <Link href="/inspirasjon/levere-inn-brukte-batterier" style={extLink}>
                hvorfor det lønner seg å levere inn brukte batterier
              </Link>
              .
            </p>

            <h2 style={h2Style}>Hvorfor riktig oppbevaring er viktigere enn folk tror</h2>

            <p style={pStyle}>
              Batterier er små energilagre. Selv et «tomt» batteri har nesten alltid litt
              restenergi igjen. Kommer polene i kontakt med metall, for eksempel en mynt, en nøkkel
              eller et annet batteri, kan det oppstå en kortslutning. Batteriet kan da bli svært
              varmt, og i verste fall kan det begynne å brenne.
            </p>

            <p style={pStyle}>
              Dette er ikke et teoretisk problem. Ifølge brannstatistikken som{' '}
              <a href="https://www.norskindustri.no/bransjer/gjenvinning/aktuelt/brannstatistikk/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Norsk Industri
              </a>{' '}
              samler inn for gjenvinningsbransjen, skyldes rundt tre av fire branner på
              gjenvinningsanlegg brukte batterier. Oslo kommune skriver at det brenner i norske
              avfallsanlegg og renovasjonsbiler hver uke på grunn av batterier som er kastet i
              restavfallet eller papiravfallet.
            </p>

            <FactBox value="~75" unit="%">
              av brannene på norske gjenvinningsanlegg skyldes brukte batterier, ifølge Norsk
              Industris brannstatistikk for 2025.
            </FactBox>

            <p style={pStyle}>
              Særlig litium-ion-batteriene, som i dag sitter i alt fra mobiler og smartklokker til
              elsparkesykler og verktøy, krever ekstra oppmerksomhet. De lagrer mye energi på
              liten plass, og når de først tar fyr, kan brannen være svært vanskelig å slukke.
              Fenomenet kalles «thermal runaway», eller termisk rømning. Det er også grunnen til at
              Bergen brannvesen fraråder å stue gamle batteriprodukter bort på loftet eller i boden.
            </p>

            <h2 style={h2Style}>De vanligste feilene folk gjør</h2>

            <p style={pStyle}>
              Mange av feilene er så vanlige at vi knapt tenker over dem:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Løse brukte batterier i skuffen.</strong> Når tomme batterier ligger
                sammen med mynter, binders og nøkler, øker sjansen for kortslutning betraktelig.
              </BulletItem>
              <BulletItem>
                <strong>Nye og brukte om hverandre.</strong> Uten et system er det nesten umulig
                å huske hvilke batterier som fortsatt har strøm – og hvilke som burde vært levert
                til gjenvinning for lenge siden.
              </BulletItem>
              <BulletItem>
                <strong>Batterier i restavfallet.</strong> Brukte batterier skal aldri i
                restavfallet. Der utgjør de en direkte brannfare i søppelbøtta, i
                renovasjonsbilen og på anlegget.
              </BulletItem>
              <BulletItem>
                <strong>Å samle på gamle batteriprodukter.</strong> Ødelagte mobiler, leker og
                verktøy med innebygde litiumbatterier bør ikke lagres i huset over tid – de bør
                leveres til gjenvinning.
              </BulletItem>
              <BulletItem>
                <strong>Lading i rømningsveier.</strong> Gangen er ofte den viktigste veien ut av
                en bolig. Lader du elsparkesykkel eller annet med stort litiumbatteri der, kan en
                brann stenge den.
              </BulletItem>
            </ul>

            <h2 style={h2Style}>Ulike batterityper krever ulik omtanke</h2>

            <p style={pStyle}>
              Ikke alle batterier oppfører seg likt. En rask oversikt gjør det lettere å behandle
              hver type riktig:
            </p>

            <DataTable
              headers={['Batteritype', 'Typisk bruk', 'Viktigst å huske']}
              rows={TYPE_ROWS}
              caption="Oppbevaringsråd etter batteritype. Er du i tvil, behandle batteriet som litium – det er alltid det tryggeste utgangspunktet."
            />

            <p style={pStyle}>
              Vil du gå mer i dybden på forskjellene, har vi laget en egen oversikt over{' '}
              <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                hvilke batterier som passer til hva
              </Link>
              . Og er du usikker på hvordan du får mest mulig ut av dem, finner du praktiske råd
              om{' '}
              <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                å forlenge levetiden på batteriene dine
              </Link>
              .
            </p>

            <h2 style={h2Style}>Trygg oppbevaring med barn i huset</h2>

            <p style={pStyle}>
              Har du små barn, er det ett moment som fortjener ekstra oppmerksomhet:
              knappcellebatterier. De små, blanke cellene i bilnøkler, gratulasjonskort og enkelte
              leker ligner mistenkelig på godteri, og svelging kan gi alvorlige indre skader på
              svært kort tid. Oppbevar derfor både nye og brukte knappceller utilgjengelig for
              barn, gjerne i en lukket boks høyt oppe. Det samme prinsippet gjelder egentlig alle
              løse batterier – en fast, utilgjengelig plass er tryggere enn en åpen skuff.
            </p>

            <h2 style={h2Style}>Fra kaos i skuffen til fast plass</h2>

            <p style={pStyle}>
              Her møtes sikkerhet og hverdagsorden. Den vanligste grunnen til at brukte batterier
              aldri når gjenvinningen, er rett og slett at det ikke finnes et naturlig sted å
              legge dem. Da blir de liggende i en skuff, blandet med nye, til ingen lenger vet hva
              som er hva.
            </p>

            <p style={pStyle}>
              Løsningen er å gi batteriene en fast plass med tydelig skille mellom nye og brukte.
              Nettopp derfor lagde vi{' '}
              <Link href="/produkter/aboks" style={extLink}>aBoks</Link> – en batteriboks med tre
              adskilte rom: ett for nye AA, ett for nye AAA, og et eget rom for de brukte som skal
              leveres til gjenvinning. Du ser på et blikk hva du har igjen, og hva som skal ut av
              huset, og de brukte har et fast sted frem til du leverer dem.
            </p>

            <p style={pStyle}>
              aBoks er laget for de batteritypene som står i bruksanvisningen. Litiumbatterier og
              skadde eller oppsvulmede batterier skal ikke legges i aBoks. Dem leverer du separat,
              slik det er beskrevet over. Vil du sammenligne modellene, finner du dem på siden om{' '}
              <Link href="/batteriboks" style={extLink}>batteriboks for nye og brukte batterier</Link>.
            </p>

            <ArticleImage
              src={`${BLOB}/aboks-batterioppbevaring-hjemme.webp`}
              alt="aBoks batteriboks brukt til oppbevaring av husholdningsbatterier hjemme"
            />

            {/* Produktblokk */}
            <div style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', margin: '40px 0',
            }}>
              <span style={{
                display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
                letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
                color: '#c8cebb', marginBottom: '14px',
              }}>Smart batteriorganisering</span>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(20px,1.8vw,26px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 16px',
              }}>
                Én boks. Tre rom. Full oversikt.
              </p>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                aBoks gir hvert batteri sin faste plass – nye AA, nye AAA og et eget rom for de
                brukte. Designet i Norge, i et matt, tidløst uttrykk som passer på
                kjøkkenbenken, hjemmekontoret eller i boden.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link
                  href="/produkter"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                    letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                    background: '#5e6a48', color: '#faf6ee', textDecoration: 'none',
                  }}
                >
                  Se alle produkter
                </Link>
                <Link
                  href="/slik-fungerer-det"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                    letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                    background: 'transparent', color: '#faf6ee', textDecoration: 'none',
                    border: '1px solid rgba(250,246,238,0.4)',
                  }}
                >
                  Slik fungerer det
                </Link>
              </div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9fb08f', margin: '16px 0 0' }}>
                Designet i Norge · fri frakt over kr 650
              </p>
            </div>

            <p style={pStyle}>
              Vil du ha veggmontert løsning for å spare plass, finnes også{' '}
              <Link href="/produkter/aboks-vegg" style={extLink}>aBoks Vegg</Link>, som gir den
              samme oversikten stående eller på veggen. Uansett hvilken løsning du velger, er
              poenget det samme: når batteriene har en fast plass, blir trygg oppbevaring en vane
              i stedet for et prosjekt.
            </p>

            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål om oppbevaring av batterier
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Er det farlig å oppbevare brukte batterier hjemme?">
                Brukte batterier har alltid litt restenergi. Ligger
                de løst sammen med metall eller andre batterier, kan de kortslutte og i verste
                fall ta fyr. Teip polene, samle dem i en lukket beholder for seg selv, og lever dem
                jevnlig i stedet for å la dem hope seg opp.
              </FaqItem>
              <FaqItem question="Bør jeg oppbevare batterier i kjøleskapet eller fryseren?">
                Nei. Vanlige husholdningsbatterier holder seg godt ved romtemperatur, og kondens kan
                skade dem når de tas ut av kulda. Et tørt skap unna varmekilder og direkte sollys er
                det beste stedet.
              </FaqItem>
              <FaqItem question="Hvorfor skal jeg teipe polene på brukte batterier?">
                Fordi selv tomme batterier har restenergi. En teipbit over hver pol hindrer at
                batteriet kortslutter mot mynter, nøkler eller andre batterier.
              </FaqItem>
              <FaqItem question="Kan jeg blande nye og gamle batterier i samme apparat?">
                Nei. Ytelsen begrenses av det svakeste batteriet, og faren for lekkasje øker. Bytt
                derfor alltid ut alle batteriene i et apparat samtidig, og bruk samme type, merke
                og alder.
              </FaqItem>
              <FaqItem question="Hvor leverer jeg brukte batterier?">
                Butikker som selger batterier, tar imot brukte batterier av samme type gratis, og
                gjenvinningsstasjonene tar også imot batterier. Hovne, lekkende eller skadde
                batterier leverer du på gjenvinningsstasjonen. Gjør det gjerne til en rutine neste
                gang du handler batterier, så hoper de seg ikke opp hjemme.
              </FaqItem>
            </div>

            {/* CTA */}
            <div style={{
              background: '#eee9de', border: '1px solid #ddd8ce', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', textAlign: 'center', margin: '40px 0',
            }}>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600,
                fontSize: 'clamp(20px,1.8vw,26px)', letterSpacing: '-0.01em',
                color: '#1a1d17', margin: '0 0 14px',
              }}>
                Klar for en fast plass til batteriene?
              </p>
              <p style={{ ...pStyle, margin: '0 0 24px' }}>
                Tre rom, full oversikt og en fast plass for de brukte cellene. Slik blir orden i
                batteriene en vane som varer.
              </p>
              <Link
                href="/produkter/aboks"
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

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <p style={{ ...h3Style, margin: '0 0 14px' }}>Relaterte artikler</p>
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
                  <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={extLink}>
                    Hvilke batterier passer til hva?
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/forleng-levetiden-pa-batteriene" style={extLink}>
                    Slik forlenger du levetiden på batteriene dine
                  </Link>
                </BulletItem>
                <BulletItem>
                  <Link href="/inspirasjon/beste-losninger-batterioppbevaring-hjemme" style={extLink}>
                    De beste løsningene for batterioppbevaring hjemme
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
                Kilder og videre lesning
              </p>
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {SOURCES.map((s, i) => (
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
                  'Oppbevare batterier', 'Batterier i kjøleskap', 'Batterisikkerhet',
                  'Brannfare batterier', 'Litiumbatterier', 'Teipe poler', 'Batterioppbevaring',
                  'Gjenvinning batterier', 'Batteriboks',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
