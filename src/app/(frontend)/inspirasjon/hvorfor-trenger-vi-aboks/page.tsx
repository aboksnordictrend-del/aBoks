import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { buildArticleMetadata } from '../_seo'

export const metadata: Metadata = {
  ...buildArticleMetadata({
    slug: 'hvorfor-trenger-vi-aboks',
    title: 'Hvorfor trenger vi aBoks? Fordi en skuff ikke er et system',
    description:
      'Oppbevaring av batterier handler ikke om plass, men om system. Les hvorfor aBoks gjør det enklere å holde orden på nye og brukte batterier – hjemme og på jobben.',
    ogDescription:
      'En redaksjonell artikkel om hvorfor batterier trenger et system og ikke bare en skuff. Den følger hele veien fra nye batterier til innsamling og levering til godkjent mottak, hjemme, på kontoret og i produksjon.',
  }),
  keywords: [
    'oppbevaring av batterier', 'sortering av batterier', 'brukte batterier',
    'batteriinnsamling', 'batterier hjemme', 'batterihåndtering på arbeidsplassen',
    'gjenvinning', 'aBoks for bedrifter',
  ],
}

const HERO_IMAGE =
  'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/From%20Battery%20Clutter%20to%20Recycling.webp'

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

const emStyle: React.CSSProperties = { fontStyle: 'italic', color: '#5e6a48' }

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

function FlowStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      background: '#eee9de', border: '1px solid #ddd8ce', borderRadius: '12px',
      padding: '14px 18px',
    }}>
      <span style={{
        flexShrink: 0, width: '44px', height: '44px', borderRadius: '50%',
        background: '#fff', border: '1px solid #ddd8ce', color: '#5e6a48',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-cormorant)', fontSize: '20px', fontWeight: 600,
      }}>{String(n).padStart(2, '0')}</span>
      <span>
        <strong style={{ display: 'block', fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.1vw,17px)', lineHeight: 1.4, color: '#1a1d17' }}>
          {title}
        </strong>
        <span style={{ display: 'block', fontFamily: 'var(--font-manrope)', fontSize: '14px', lineHeight: 1.5, color: '#6b6f63' }}>
          {children}
        </span>
      </span>
    </li>
  )
}

function Callout({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '36px 0', padding: '24px 30px', background: '#fff', border: '1px solid #ddd8ce', borderRadius: '16px' }}>
      <span style={{
        display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
        color: '#5e6a48', background: '#eee9de', padding: '5px 12px',
        borderRadius: '999px', marginBottom: '14px',
      }}>{label}</span>
      {title ? (
        <h3 style={{ ...h3Style, margin: '0 0 10px' }}>{title}</h3>
      ) : null}
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

const MODELS: { name: string; href: string; tag: string; usedOnly?: boolean; desc: string }[] = [
  { name: 'aBoks', href: '/produkter/aboks', tag: 'Nye + brukte', desc: '20 AA, 36 AAA og eget rom for brukte. Automatisk mating.' },
  { name: 'aBoks Mini', href: '/produkter/aboks-mini', tag: 'Nye + brukte', desc: 'Kompakt løsning for AA, med eget rom for brukte.' },
  { name: 'aBoks Nano', href: '/produkter/aboks-nano', tag: 'Nye + brukte', desc: 'Kompakt løsning for AAA, med eget rom for brukte.' },
  { name: 'aBoks Vegg', href: '/produkter/aboks-vegg', tag: 'Nye + brukte', desc: 'AA, AAA og brukte – på veggen eller stående.' },
  { name: 'aBoks Office', href: '/produkter/aboks-office', tag: 'Nye + brukte', desc: 'Skrivebordsorganisator med batterirom og mobilholder.' },
  { name: 'aBoks Spesial', href: '/produkter/aboks-spesial', tag: 'Kun brukte', usedOnly: true, desc: 'Veggmontert, lokalt innsamlingspunkt der batteriene byttes.' },
  { name: 'aBoks XL', href: '/produkter/aboks-xl', tag: 'Kun brukte', usedOnly: true, desc: 'Stort, felles innsamlingspunkt for bedrifter og institusjoner.' },
]

const COMPARE_HEADERS = ['Spørsmål', 'Skuff', 'Pose / glass', 'Vanlig eske', 'aBoks-systemet']

const COMPARE_ROWS: string[][] = [
  ['Skiller nye fra brukte', 'Sjelden', 'Bare brukte', 'Avhenger av deg', 'Faste, adskilte rom'],
  ['Fast plass alle kjenner', 'Ofte flere', 'Varierer', 'Ofte', 'Ja'],
  ['Viser når det er tid for levering', 'Nei', 'Delvis', 'Delvis', 'Ja, rommet fylles synlig'],
  ['Fungerer for flere personer', 'Sjelden', 'Sjelden', 'Delvis', 'Ja, samme løsning overalt'],
  ['Naturlig vei videre', 'Nei', 'Avhenger av deg', 'Avhenger av deg', 'Lokalt → felles → mottak'],
]

const SOURCES = [
  { label: 'Sortere.no (LOOP) – slik sorterer du batterier', url: 'https://sortere.no/batterier' },
  { label: 'Lovdata – avfallsforskriften, kapittel 3 om kasserte batterier', url: 'https://lovdata.no/dokument/SF/forskrift/2004-06-01-930' },
  { label: 'DSB – ofte stilte spørsmål om litiumbatterier', url: 'https://www.dsb.no/lover/farlige-stoffer/transport-av-farlig-gods/veiledning-og-informasjon/ofte-stilte-sporsmal---litiumbatterier/' },
  { label: 'Miljødirektoratet – avfall og gjenvinning', url: 'https://www.miljodirektoratet.no/' },
]

const RELATED = [
  { category: 'Sikkerhet', title: 'Hvordan oppbevare batterier trygt hjemme?', href: '/inspirasjon/oppbevare-batterier-trygt-hjemme' },
  { category: 'Hjem & sikkerhet', title: 'De beste løsningene for batterioppbevaring hjemme', href: '/inspirasjon/beste-losninger-batterioppbevaring-hjemme' },
  { category: 'Smart hverdag', title: 'Langtidsoppbevaring av oppladbare batterier', href: '/inspirasjon/langtidsoppbevaring-oppladbare-batterier' },
]

export default function ArticlePage() {
  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        {/* Breadcrumb */}
        <nav aria-label="Brødsmuler" style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
          fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63',
          paddingTop: '18px', marginBottom: 'clamp(36px,5vw,48px)',
        }}>
          <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <Link href="/inspirasjon" style={{ color: '#6b6f63', textDecoration: 'none' }}>Inspirasjon</Link>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: '#1a1d17', fontWeight: 600 }}>Hvorfor trenger vi aBoks?</span>
        </nav>

        <article style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: 'clamp(80px,10vw,128px)' }}>

          {/* Header */}
          <header style={{ marginBottom: 'clamp(36px,4vw,52px)', textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48',
              margin: '0 0 16px',
            }}>
              Hjem &amp; organisering
            </p>
            <h1 style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(36px,4.5vw,60px)', letterSpacing: '-0.024em',
              lineHeight: 1.05, color: '#1a1d17', margin: '0 0 24px',
            }}>
              Hvorfor trenger vi aBoks? Fordi en skuff ikke er et <em style={emStyle}>system.</em>
            </h1>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.2vw,19px)',
              lineHeight: 1.65, color: '#4a4e41', margin: '0 0 28px',
            }}>
              Oppbevaring av batterier er noe de fleste av oss aldri tenker over – helt til
              fjernkontrollen dør midt i nyhetene og letingen begynner. Men utfordringen handler
              sjelden om plass. Den handler om at vi mangler en fast rutine for hvor batteriene skal,
              og hva som skjer med dem etterpå.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62',
              margin: 0, paddingBottom: '32px', borderBottom: '1px solid #ddd8ce',
            }}>
              aBoks-redaksjonen · Lesetid ca. 7 min · Oktober 2026
            </p>
          </header>

          {/* Hero */}
          <figure style={{
            position: 'relative', aspectRatio: '16 / 9', margin: '0 0 clamp(36px,4vw,52px)',
            borderRadius: '20px', overflow: 'hidden', background: '#eee9de',
          }}>
            <Image
              src={HERO_IMAGE}
              alt="Oppbevaring av batterier i et rolig nordisk hjem – en ryddig batteriboks på en eikehylle i myk morgensol"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 720px"
              style={{ objectFit: 'cover' }}
            />
          </figure>

          {/* Body */}
          <div style={{ textAlign: 'left' }}>

            <h2 style={{ ...h2Style, marginTop: 0 }}>Kalkulator eller <em style={emStyle}>kuleramme?</em></h2>

            <p style={pStyle}>Hvorfor trenger vi en kalkulator når vi allerede har en kuleramme?</p>

            <p style={pStyle}>
              Spørsmålet er ikke så dumt som det høres ut. Kulerammen fungerer. Den har gjort jobben
              i et par tusen år, den går aldri tom for strøm, og den har aldri bedt om en
              programvareoppdatering. Med litt øvelse kan du regne ut både momsen og strømregningen
              på den.
            </p>

            <p style={pStyle}>
              Likevel er det få av oss som tar den frem når regnskapet skal gjøres opp. Ikke fordi
              kulerammen er feil, men fordi kalkulatoren gjør det riktige enklere, raskere og mer
              forutsigbart – også for den som aldri har øvd.
            </p>

            <p style={pStyle}>Omtrent slik er det med batterier. Vi har hørt innvendingene, og de er helt rimelige:</p>

            <ul style={{ listStyle: 'none', padding: '0 0 0 20px', margin: '0 0 24px', borderLeft: '2px solid #ddd8ce' }}>
              {[
                '«Hvorfor kjøpe aBoks? Jeg har jo en skuff.»',
                '«Jeg kan bare legge brukte batterier i en pose.»',
                '«Vi har allerede en eske til batterier på kontoret.»',
              ].map((q) => (
                <li key={q} style={{
                  fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
                  fontSize: 'clamp(19px,1.6vw,22px)', lineHeight: 1.5, color: '#39402c', padding: '4px 0',
                }}>{q}</li>
              ))}
            </ul>

            <p style={pStyle}>Selvfølgelig kan du det. Akkurat som du fortsatt kan regne på kuleramme.</p>

            <p style={pStyle}>
              Men det interessante spørsmålet er ikke om skuffen, posen eller esken <em>kan</em>{' '}
              brukes. Det er om de skaper en ordning som er forståelig, pålitelig og som gjentar seg
              – også de dagene det ikke er du som skifter batteriet.
            </p>

            <h2 style={h2Style}>Batterier finnes overalt. Systemet mangler.</h2>

            <p style={pStyle}>
              Prøv å telle dem en gang. Fjernkontroller, trådløse mus, lommelykter, kjøkkenvekter,
              leker, dørklokker og små sensorer rundt i huset. På kontoret kommer tastaturer,
              presentasjonspekere og møteromsutstyr i tillegg. På lager, i verksted og i produksjon
              er det håndskannere, måleinstrumenter og lykter som skal virke når det gjelder.
            </p>

            <p style={pStyle}>Batteriene er overalt. Det er ikke dem som er problemet.</p>

            <p style={pStyle}>
              Problemet er alt som skjer rundt dem. Nye batterier ligger spredt i tre forskjellige
              skuffer, gjerne uten emballasje. Det brukte batteriet fra fjernkontrollen blir lagt
              «midlertidig» på kjøkkenbenken – og midlertidig er som kjent et av de mest varige
              ordene vi har. Etter en stund vet ingen lenger hvilke batterier som er nye, hvilke som
              er halvbrukte, og hvilke som egentlig skulle vært levert inn for flere måneder siden.
            </p>

            <p style={pStyle}>Det handler sjelden om plass. Det handler om struktur.</p>

            <blockquote style={{
              background: '#eee9de', borderLeft: '3px solid #5e6a48',
              borderRadius: '0 12px 12px 0', padding: '28px 32px', margin: '40px 0',
            }}>
              <p style={{
                fontFamily: 'var(--font-cormorant)', fontStyle: 'italic',
                fontSize: 'clamp(20px,1.8vw,26px)', lineHeight: 1.5, color: '#39402c', margin: 0,
              }}>
                Problemet er ikke at vi mangler steder å legge batteriene. Problemet er at vi mangler
                et system.
              </p>
              <footer style={{
                marginTop: '14px', fontFamily: 'var(--font-manrope)', fontSize: '13px',
                letterSpacing: '0.04em', color: '#6b6f63',
              }}>
                — Tanken bak aBoks
              </footer>
            </blockquote>

            <h2 style={h2Style}>Fra tilfeldig oppbevaring til et gjennomtenkt system</h2>

            <p style={pStyle}>
              Det er en grunnleggende forskjell på å <em>oppbevare</em> batterier et sted og å{' '}
              <em>organisere</em> hele veien de går. Det første handler om hvor batteriet ligger
              akkurat nå. Det andre handler om hva som skjer med det – fra pakken kommer inn døren
              til det brukte batteriet leveres videre.
            </p>

            <p style={pStyle}>aBoks er bygget rundt en enkel rekkefølge:</p>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'grid', gap: '12px' }}>
              <FlowStep n={1} title="Nye batterier får en fast plass">
                Ikke tre skuffer, men ett sted alle i huset kjenner til.
              </FlowStep>
              <FlowStep n={2} title="De er tilgjengelige når du trenger dem">
                Du ser hva du har igjen, før det er tomt.
              </FlowStep>
              <FlowStep n={3} title="Brukte batterier samles separat">
                Aldri blandet med de nye – så ingen setter et tomt batteri tilbake i fjernkontrollen.
              </FlowStep>
              <FlowStep n={4} title="Videre til et felles innsamlingspunkt">
                Der det passer, for eksempel på en arbeidsplass, en skole eller i et borettslag.
              </FlowStep>
              <FlowStep n={5} title="Levert til godkjent mottak">
                En butikk som selger batterier, eller en gjenvinningsstasjon.
              </FlowStep>
            </ol>

            <p style={pStyle}>
              Ingen av stegene er revolusjonerende hver for seg. Poenget er at de henger sammen. Et
              godt system gjør den riktige handlingen til den mest naturlige – du trenger ikke å
              huske regelen, fordi løsningen viser den for deg. Vil du se hvordan det fungerer i
              praksis, finner du en kort gjennomgang under{' '}
              <Link href="/slik-fungerer-det" style={extLink}>slik fungerer aBoks</Link>.
            </p>

            <Callout label="Godt å vite">
              Alle som selger batterier i Norge, har plikt til å ta imot brukte batterier gratis. Du
              kan altså levere dem der du kjøper batterier, eller på nærmeste gjenvinningsstasjon.
              Den nasjonale sorteringsguiden{' '}
              <a href="https://sortere.no/batterier" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                Sortere.no
              </a>{' '}
              har oversikt over hvordan det gjøres der du bor, og selve regelverket finner du i{' '}
              <a href="https://lovdata.no/dokument/SF/forskrift/2004-06-01-930" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                avfallsforskriften på Lovdata
              </a>
              .
            </Callout>

            <h2 style={h2Style}>Hjemme – orden som faktisk fungerer</h2>

            <p style={pStyle}>
              Hjemme er det sjelden dramatikk. Det er bare de små irritasjonsmomentene: leken som går
              tom på julaften, lommelykten som ikke virker under strømbruddet, pakken med AAA som
              viser seg å være AA.
            </p>

            <p style={pStyle}>
              <Link href="/produkter/aboks" style={extLink}>aBoks</Link> gir nye AA- og
              AAA-batterier hver sin faste plass, og et eget rom for de brukte. Med plass til 20 AA og
              36 AAA blir det et lite batterilager som er lett å holde oversikt over, og batteriene
              mates frem slik at det neste alltid ligger klart. Ikke alle hjem trenger akkurat det
              samme, og derfor finnes det varianter:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <Link href="/produkter/aboks-mini" style={extLink}><strong>aBoks Mini</strong></Link>{' '}
                – kompakt løsning for AA-batterier, med eget rom for brukte.
              </BulletItem>
              <BulletItem>
                <Link href="/produkter/aboks-nano" style={extLink}><strong>aBoks Nano</strong></Link>{' '}
                – samme idé for AAA, fin til hodelykter, LED-lys og små sensorer.
              </BulletItem>
              <BulletItem>
                <Link href="/produkter/aboks-vegg" style={extLink}><strong>aBoks Vegg</strong></Link>{' '}
                – AA, AAA og brukte batterier, montert på veggen eller stående på en hylle.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Gevinsten er ikke at hjemmet blir perfekt. Gevinsten er at du slutter å lete. Du vet
              hvor de nye ligger, og du vet hvor de brukte skal. Når rommet for brukte begynner å
              fylles opp, er det et tydelig signal: neste gang du handler, tar du dem med.
            </p>

            <Callout label="Trygg håndtering" title="Hva hører hjemme i rommet for brukte?">
              <p style={{ ...pStyle, margin: '0 0 14px' }}>
                Rommet for brukte batterier er tenkt for vanlige småbatterier, som oppbrukte AA- og
                AAA-celler, frem til de leveres. Noen batterier krever litt mer omtanke:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
                <BulletItem>
                  <strong>Teip polene</strong> på litiumbatterier, knappceller og 9-voltsbatterier,
                  og hold dem adskilt fra de vanlige alkaliske. Mange brannvesen anbefaler å teipe
                  alle brukte batterier.
                </BulletItem>
                <BulletItem>
                  <strong>Skadde, oppsvulmede, lekkende eller varme batterier</strong> skal ikke i
                  noen samleboks. Lever dem direkte til forhandler eller gjenvinningsstasjon så snart
                  som mulig.
                </BulletItem>
                <BulletItem>
                  <strong>Lever jevnlig.</strong> Unngå at store mengder hoper seg opp, og hold
                  batterier – særlig knappceller – utilgjengelig for små barn.
                </BulletItem>
              </ul>
              <p style={{ ...pStyle, margin: 0 }}>
                Et eget rom kan bidra til å redusere risikoen for kortslutning, men det erstatter ikke
                god batterihygiene. Les mer i guiden vår om{' '}
                <Link href="/inspirasjon/oppbevare-batterier-trygt-hjemme" style={extLink}>
                  hvordan du oppbevarer batterier trygt hjemme
                </Link>
                .
              </p>
            </Callout>

            <h2 style={h2Style}>På kontoret – en felles rutine</h2>

            <p style={pStyle}>
              På en arbeidsplass med tjue ansatte finnes det fort tjue forskjellige batterirutiner.
              Én har en kaffekopp på pulten. En annen legger brukte batterier tilbake i skuffen «til
              senere». En tredje kaster dem i restavfallet uten å tenke over det.
            </p>

            <p style={pStyle}>Ingen av dem gjør det av vond vilje. De har bare aldri fått en felles løsning.</p>

            <p style={pStyle}>
              Den enkelte ansatte burde ikke trenge å finne opp sin egen metode for batterihåndtering
              på arbeidsplassen. Det er her systemtenkningen virkelig gir mening:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <Link href="/produkter/aboks-office" style={extLink}><strong>aBoks Office</strong></Link>{' '}
                står på skrivebordet. Den samler penner, saks og mobil, holder nye AA og AAA
                tilgjengelig og har et eget rom som holder brukte batterier adskilt.
              </BulletItem>
              <BulletItem>
                <Link href="/produkter/aboks-spesial" style={extLink}><strong>aBoks Spesial</strong></Link>{' '}
                er en veggmontert beholder kun for brukte batterier – nyttig der batterier byttes
                ofte og det trengs flere lett tilgjengelige innsamlingspunkter.
              </BulletItem>
              <BulletItem>
                <Link href="/produkter/aboks-xl" style={extLink}><strong>aBoks XL</strong></Link>{' '}
                er det store, felles innsamlingspunktet. Den henger på veggen, og her samles
                batteriene fra de lokale stasjonene før de leveres videre.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              Resultatet er en enkel kjede: lokalt ved pulten, felles i gangen eller personalrommet,
              og videre til godkjent mottak. Én person kan ha ansvaret for å tømme den felles boksen
              og levere – i stedet for at alle har litt ansvar og ingen egentlig har det.
            </p>

            <h2 style={h2Style}>På arbeidsplassen og i produksjonen – når små rutiner betyr mye</h2>

            <p style={pStyle}>
              Jo flere rom, avdelinger og apparater, desto viktigere er det at løsningen ser lik ut
              overalt. På et lager, i et verksted eller på en skole er det ikke realistisk at alle
              husker hvor det ene innsamlingspunktet befinner seg – eller hvem som tømte det sist.
            </p>

            <p style={pStyle}>En standardisert løsning gir først og fremst tre ting:</p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>
                <strong>Gjenkjennelse.</strong> Samme type boks på samme type sted gjør at ingen
                trenger å spørre.
              </BulletItem>
              <BulletItem>
                <strong>Konsistens.</strong> Nye og brukte batterier holdes adskilt på samme måte i
                alle avdelinger.
              </BulletItem>
              <BulletItem>
                <strong>Oversikt.</strong> Det er lett å se når en beholder bør tømmes, og hvor
                batteriene skal videre.
              </BulletItem>
            </ul>

            <p style={pStyle}>
              For slike miljøer har vi satt sammen ferdige kombinasjoner for kontor, produksjon,
              skole og borettslag. Du finner dem under{' '}
              <Link href="/bedrifter" style={extLink}>aBoks for bedrifter</Link>, der antall
              enheter tilpasses lokalene og behovet.
            </p>

            <p style={pStyle}>
              La oss samtidig være tydelige: En boks gjør ikke en virksomhet regelverksmessig i
              orden, og den fjerner ikke brannrisiko. Det ansvaret ligger i rutinene, i opplæringen og
              i at batteriene faktisk blir levert. For virksomheter som håndterer litiumbatterier, har{' '}
              <a href="https://www.dsb.no/lover/farlige-stoffer/transport-av-farlig-gods/veiledning-og-informasjon/ofte-stilte-sporsmal---litiumbatterier/" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                DSB samlet svar på de vanligste spørsmålene
              </a>
              . Det et godt system kan gjøre, er å gjøre de riktige rutinene lettere å følge – hver
              dag, for alle.
            </p>

            <h3 style={h3Style}>Hele systemet på ett blikk</h3>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))',
              gap: '14px', margin: '0 0 32px',
            }}>
              {MODELS.map((m) => (
                <Link key={m.href} href={m.href} style={{
                  display: 'block', background: '#fff', border: '1px solid #ddd8ce',
                  borderRadius: '12px', padding: '18px', textDecoration: 'none', color: '#1a1d17',
                }}>
                  <span style={{
                    display: 'block', fontFamily: 'var(--font-cormorant)', fontWeight: 600,
                    fontSize: '21px', marginBottom: '6px',
                  }}>{m.name}</span>
                  <span style={{
                    display: 'inline-block', fontFamily: 'var(--font-manrope)', fontSize: '10px',
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 9px', borderRadius: '999px', marginBottom: '8px',
                    background: m.usedOnly ? '#39402c' : '#eee9de',
                    color: m.usedOnly ? '#faf6ee' : '#5e6a48',
                  }}>{m.tag}</span>
                  <span style={{
                    display: 'block', fontFamily: 'var(--font-manrope)', fontSize: '14px',
                    lineHeight: 1.5, color: '#6b6f63',
                  }}>{m.desc}</span>
                </Link>
              ))}
            </div>

            <h2 style={h2Style}>Hvorfor ikke bare bruke en vanlig eske?</h2>

            <p style={pStyle}>Tilbake til kulerammen.</p>

            <p style={pStyle}>
              En eske er en beholder. Den svarer på ett eneste spørsmål: <em>Hvor kan jeg legge
              dette?</em> Et system svarer på flere:
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
              <BulletItem>Hvor hører de nye batteriene hjemme?</BulletItem>
              <BulletItem>Hva gjør jeg med et batteri som er brukt opp?</BulletItem>
              <BulletItem>Hvor går det videre – og når?</BulletItem>
              <BulletItem>Hvordan ser neste person hva som er hva, uten å spørre?</BulletItem>
            </ul>

            <div style={{ overflowX: 'auto', margin: '8px 0 12px' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', minWidth: '600px',
                fontFamily: 'var(--font-manrope)', fontSize: 'clamp(13px,1vw,15px)',
                background: '#fff', borderRadius: '12px', overflow: 'hidden',
              }}>
                <thead>
                  <tr>
                    {COMPARE_HEADERS.map((h, j) => (
                      <th key={h} scope="col" style={{
                        textAlign: 'left', padding: '13px 16px',
                        background: j === COMPARE_HEADERS.length - 1 ? '#5e6a48' : '#39402c',
                        color: '#faf6ee', fontWeight: 600, letterSpacing: '0.02em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row, i) => (
                    <tr key={row[0]}>
                      {row.map((cell, j) => {
                        const cellStyle: React.CSSProperties = {
                          padding: '12px 16px',
                          borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid #ece8e1' : 'none',
                          background: j === row.length - 1 ? '#eef0e6' : i % 2 === 1 ? '#f5f1e8' : '#fff',
                          verticalAlign: 'top', textAlign: 'left',
                          color: j === 0 || j === row.length - 1 ? '#39402c' : '#4a4e41',
                          fontWeight: j === 0 || j === row.length - 1 ? 700 : 400,
                          lineHeight: 1.6,
                        }
                        return j === 0
                          ? <th key={j} scope="row" style={cellStyle}>{cell}</th>
                          : <td key={j} style={cellStyle}>{cell}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#7a756c', margin: '0 0 28px' }}>
              Tre vanlige løsninger sammenlignet med et gjennomtenkt system.
            </p>

            <p style={pStyle}>
              En vanlig beholder kan absolutt være en del av en god løsning. Flere brannvesen
              anbefaler for eksempel et glass med lokk til brukte batterier, og det er et godt råd.
              Poenget er ikke at alle må kjøpe et spesialprodukt. Poenget er at en løsning som er
              laget for oppgaven – med faste rom, tydelig skille mellom nytt og brukt og en naturlig
              vei videre – sjelden blir glemt, flyttet eller tatt i bruk til noe helt annet. Esken på
              kontoret ender som kjent fort som hjem for gamle ladere og en enslig binders.
            </p>

            <h2 style={h2Style}>Små batterier. En <em style={emStyle}>større idé.</em></h2>

            <p style={pStyle}>
              aBoks er bygget på et enkelt prinsipp: Ansvarlig håndtering blir lettere når hverdagens
              rutiner er gjennomtenkt.
            </p>

            <p style={pStyle}>
              Idéen begynte som en skisse ved et kjøkkenbord, ble testet av over 40 husstander i
              hverdagen og er designet og produsert i Norge. Du kan lese hele{' '}
              <Link href="/historien" style={extLink}>historien bak aBoks</Link> her. Underveis ble
              det tydelig at de fleste ikke trengte mer informasjon om batterier. De trengte et sted å
              gjøre det riktige.
            </p>

            <p style={pStyle}>
              En liten endring i hvordan vi håndterer batterier kan bli en bedre vane – i et hjem, på
              en arbeidsplass eller i en hel organisasjon. Ikke fordi noen får dårlig samvittighet,
              men fordi det riktige valget rett og slett ligger nærmest.
            </p>

            <p style={pStyle}>Kulerammen får gjerne bli stående. Den er fin på hylla.</p>

            {/* FAQ */}
            <h2 style={{ ...h2Style, margin: '52px 0 18px' }} id="faq">
              Ofte stilte spørsmål
            </h2>

            <div style={{ borderTop: '1px solid #ddd8ce', marginBottom: '48px' }}>
              <FaqItem question="Hvor bør jeg oppbevare brukte batterier hjemme?">
                Ha ett fast sted, tørt og utilgjengelig for små barn, der brukte batterier holdes
                adskilt fra de nye. Teip gjerne polene, og lever batteriene jevnlig i stedet for å la
                dem samle seg opp over lang tid.
              </FaqItem>
              <FaqItem question="Hvor kan jeg levere brukte batterier?">
                Butikker som selger batterier, har plikt til å ta imot brukte batterier gratis, også
                uten at du handler noe. Du kan også levere dem på en gjenvinningsstasjon. Sjekk{' '}
                <a href="https://sortere.no/batterier" target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                  Sortere.no
                </a>{' '}
                for ordningen der du bor.
              </FaqItem>
              <FaqItem question="Kan alle batterityper samles i samme rom?">
                Nei. Rommet for brukte er tenkt for vanlige småbatterier som AA og AAA.
                Litiumbatterier, knappceller og 9-volt bør teipes og holdes adskilt. Skadde,
                oppsvulmede eller lekkende batterier skal leveres direkte, ikke legges i en
                samleboks.
              </FaqItem>
              <FaqItem question="Har alle aBoks-modellene plass til både nye og brukte batterier?">
                Nei. aBoks, aBoks Vegg og aBoks Office har plass til nye AA og AAA og et eget rom for
                brukte. aBoks Mini er laget for AA og aBoks Nano for AAA, begge med rom for brukte.
                aBoks Spesial og aBoks XL er rene innsamlingsbokser for brukte batterier.
              </FaqItem>
              <FaqItem question="Hvilken løsning passer for et kontor?">
                Et vanlig oppsett er aBoks Office på pultene og aBoks XL som felles innsamlingspunkt.
                Der batterier byttes ofte, kan aBoks Spesial gi flere lokale punkter. Se de ferdige
                pakkene under <Link href="/bedrifter" style={extLink}>For bedrifter</Link>.
              </FaqItem>
            </div>

            {/* CTA */}
            <aside style={{
              background: '#39402c', borderRadius: '20px',
              padding: 'clamp(28px,3vw,40px)', margin: '40px 0',
            }}>
              <h2 style={{
                fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(24px,2.2vw,30px)',
                letterSpacing: '-0.01em', color: '#faf6ee', margin: '0 0 12px',
              }}>
                Fra skuff til system
              </h2>
              <p style={{ ...pStyle, color: '#c8cebb' }}>
                Se hvordan en fast plass for nye og brukte batterier kan se ut hjemme hos deg – eller
                på hele arbeidsplassen.
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
                  Utforsk aBoks-systemet
                </Link>
                <Link
                  href="/bedrifter"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px',
                    letterSpacing: '0.01em', padding: '13px 32px', borderRadius: '999px',
                    background: 'transparent', color: '#faf6ee', textDecoration: 'none',
                    border: '1px solid rgba(250,246,238,0.4)',
                  }}
                >
                  Løsninger for bedrifter
                </Link>
              </div>
            </aside>

            {/* Les også */}
            <div style={{ background: '#eee9de', borderRadius: '16px', padding: '28px 32px', margin: '0 0 40px' }}>
              <h2 style={{ ...h3Style, margin: '0 0 14px' }}>Les også</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {RELATED.map((r) => (
                  <BulletItem key={r.href}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5e6a48' }}>
                      {r.category}
                    </span>{' '}
                    · <Link href={r.href} style={extLink}>{r.title}</Link>
                  </BulletItem>
                ))}
              </ul>
            </div>

            {/* Sources */}
            <div style={{ paddingTop: '28px', borderTop: '1px solid #ddd8ce' }}>
              <h2 style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: '13px', color: '#1a1d17', margin: '0 0 14px',
              }}>
                Kilder og videre lesing
              </h2>
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
                {SOURCES.map((s, i) => (
                  <li key={s.url} id={`kilde-${i + 1}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ flexShrink: 0, fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#696a62', fontWeight: 700 }}>
                      {i + 1}.
                    </span>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6 }}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={extLink}>
                        {s.label}
                      </a>
                    </span>
                  </li>
                ))}
              </ol>

              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', lineHeight: 1.6, margin: '0 0 20px' }}>
                Artikkelen er skrevet og kvalitetssikret av redaksjonen i aBoks.
              </p>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', marginRight: '8px' }}>Tags:</span>
                {[
                  'Oppbevaring av batterier', 'Sortering av batterier', 'Brukte batterier',
                  'Batteriinnsamling', 'Batterier hjemme', 'Batterihåndtering på arbeidsplassen',
                  'Gjenvinning', 'aBoks for bedrifter',
                ].map((t) => <Tag key={t} label={t} />)}
              </div>
            </div>

          </div>
        </article>
      </div>
    </main>
  )
}
