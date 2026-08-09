import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import { SUPPORTERS } from '@/lib/supporters'
import Reveal from './Reveal'
import { MATERIAL_IMAGE, STORY_IMAGES, type StoryImage } from './_images'

const TITLE = 'Historien om aBoks | Fra idé til ferdig produkt'
const DESCRIPTION =
  'Les historien om hvordan aBoks gikk fra en enkel idé til et norskutviklet produkt – gjennom skisser, prototyper, testing, 3D-printing, rådgivning og produktutvikling.'

export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) — the title already carries the brand
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/historien' },
  openGraph: {
    type: 'article',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/historien',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: STORY_IMAGES.hero.src,
        width: STORY_IMAGES.hero.width,
        height: STORY_IMAGES.hero.height,
        alt: STORY_IMAGES.hero.alt,
      },
    ],
  },
}

/* ── Backgrounds, in the order they appear. Kept as named values so the page's rhythm
      (cream → sand → cream → linen → dark) is readable in one place. ── */
const CREAM = '#faf6ee'
const SAND = '#f2e7d7'
const LINEN = '#eee9de'
const DARK = '#39402c'

/* ── Style tokens, matching the rest of the site ── */
const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#5e6a48',
  margin: '0 0 16px',
}

const eyebrowOnDark: React.CSSProperties = { ...eyebrow, color: '#a9c08f' }

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 500,
  fontSize: 'clamp(29px,3.8vw,50px)',
  letterSpacing: '-0.02em',
  lineHeight: 1.07,
  color: '#1a1d17',
  margin: '0 0 clamp(20px,2.4vw,28px)',
}

const h2OnDark: React.CSSProperties = { ...h2Style, color: '#faf6ee' }

const bodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: 'clamp(15px,1.1vw,17px)',
  lineHeight: 1.8,
  color: '#4a4e41',
  margin: '0 0 20px',
}

const bodyOnDark: React.CSSProperties = { ...bodyStyle, color: '#c8cebb' }

const captionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: '12px',
  lineHeight: 1.6,
  color: '#7a756c',
  margin: '12px 0 0',
}

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Horizontal padding tightens on narrow phones so the longest label still fits inside
  // the 320px viewport without the pill overflowing its container.
  padding: '15px clamp(22px,4vw,34px)',
  maxWidth: '100%',
  borderRadius: '999px',
  background: DARK,
  color: CREAM,
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: '15px',
  textDecoration: 'none',
}

const ghostButton: React.CSSProperties = {
  ...primaryButton,
  background: 'transparent',
  color: '#1a1d17',
  border: '1px solid rgba(42,36,24,.28)',
}

const textLink: React.CSSProperties = {
  color: DARK,
  fontFamily: 'var(--font-manrope)',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

/* ── Building blocks ── */

function Section({
  background,
  children,
  first = false,
}: {
  background: string
  children: React.ReactNode
  /** The first section sits under the fixed header and needs the extra top offset. */
  first?: boolean
}) {
  return (
    <section
      style={{
        background,
        padding: first
          ? 'clamp(96px,12vh,132px) 0 clamp(56px,7vw,96px)'
          : 'clamp(56px,8vw,116px) 0',
      }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">{children}</div>
    </section>
  )
}

/** Editorial column: story text never runs wider than a comfortable measure. */
function Prose({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <div style={{ maxWidth: dark ? '640px' : '620px' }}>{children}</div>
}

/**
 * A photograph, cropped to a shared aspect box. Only used where cropping is safe —
 * drawings, the certificate and the screenshot go through `Plate` instead.
 */
function Photo({
  image,
  ratio,
  sizes,
  priority = false,
  caption,
}: {
  image: StoryImage
  ratio: string
  sizes: string
  priority?: boolean
  caption?: string
}) {
  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          position: 'relative',
          aspectRatio: ratio,
          borderRadius: 'clamp(16px,2vw,24px)',
          overflow: 'hidden',
          background: '#e7d9bd',
        }}
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          style={{ objectFit: 'cover' }}
        />
      </div>
      {caption ? <figcaption style={captionStyle}>{caption}</figcaption> : null}
    </figure>
  )
}

/**
 * An image shown whole, at its own aspect ratio, on a light panel. Technical drawings, the
 * registration certificate and the site screenshot lose their content if cropped, so they
 * are never given a fixed aspect box or `object-fit: cover`.
 */
function Plate({
  image,
  sizes,
  background = '#fff',
  maxWidth,
  caption,
  captionColor,
}: {
  image: StoryImage
  sizes: string
  background?: string
  maxWidth?: string
  caption?: string
  captionColor?: string
}) {
  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          background,
          borderRadius: 'clamp(16px,2vw,24px)',
          padding: 'clamp(14px,2.2vw,28px)',
          maxWidth,
          marginInline: maxWidth ? 'auto' : undefined,
        }}
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={sizes}
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '6px' }}
        />
      </div>
      {caption ? (
        <figcaption style={{ ...captionStyle, ...(captionColor ? { color: captionColor } : {}) }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/** Two columns on desktop, always text-then-image on mobile. */
function Split({
  text,
  media,
  mediaFirstOnDesktop = false,
}: {
  text: React.ReactNode
  media: React.ReactNode
  mediaFirstOnDesktop?: boolean
}) {
  return (
    <div
      className="grid lg:grid-cols-2 items-center"
      style={{ gap: 'clamp(28px,4vw,64px)' }}
    >
      <Reveal className={mediaFirstOnDesktop ? 'lg:order-2' : undefined}>{text}</Reveal>
      <Reveal delay={0.08} className={mediaFirstOnDesktop ? 'lg:order-1' : undefined}>
        {media}
      </Reveal>
    </div>
  )
}

/** The three figures from prototype 5. Rows on phones, columns from 640px up. */
const V5_FACTS = [
  { value: '20', label: 'AA-batterier' },
  { value: '36', label: 'AAA-batterier' },
  { value: 'Stabil', label: 'mating' },
]

function Facts() {
  return (
    <ul
      className="flex flex-col sm:flex-row"
      style={{
        listStyle: 'none',
        margin: 'clamp(28px,3.5vw,40px) 0 0',
        padding: 0,
        borderTop: '1px solid #ddd2bb',
      }}
    >
      {V5_FACTS.map((fact) => (
        <li
          key={fact.label}
          className="sm:flex-1"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '12px',
            padding: 'clamp(14px,1.6vw,20px) 0',
            borderBottom: '1px solid #ddd2bb',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(30px,3.4vw,44px)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: '#1a1d17',
            }}
          >
            {fact.value}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '14px',
              lineHeight: 1.4,
              color: '#6b6f63',
            }}
          >
            {fact.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The models the story ended up producing. Only products that exist today are listed as
 * available; the two office models are labelled exactly as /bedrifter labels them.
 *
 * Deliberately typographic rather than a product grid — this is the closing chapter of a
 * story, not a shop shelf. When a real photograph of the range is uploaded, it can be
 * dropped in beside this list without touching the copy.
 */
const FAMILY = [
  {
    name: 'aBoks',
    note: 'Originalen. Tre adskilte rom for nye AA, nye AAA og brukte batterier.',
    href: '/produkter/aboks',
  },
  {
    name: 'aBoks Mini',
    note: 'En mindre modell for AA-batterier.',
    href: '/produkter/aboks-mini',
  },
  {
    name: 'aBoks Nano',
    note: 'Samme tanke, tilpasset AAA-batterier.',
    href: '/produkter/aboks-nano',
  },
  {
    name: 'aBoks Vegg',
    note: 'Kan monteres på vegg eller stå fritt i en hylle.',
    href: '/produkter/aboks-vegg',
  },
  {
    name: 'aBoks Office og aBoks Special',
    note: 'Bedriftsrettede modeller under utvikling. Kommer snart.',
    href: '/bedrifter',
  },
]

/* ── Page ── */

export default function HistorienPage() {
  return (
    <main style={{ background: CREAM }}>

      {/* ==================== HERO ==================== */}
      <Section background={CREAM} first>
        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Historien' }]} />

        <Reveal style={{ maxWidth: '760px' }}>
          <p style={eyebrow}>Historien</p>
          <h1
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(36px,5vw,68px)',
              letterSpacing: '-0.024em',
              lineHeight: 1.02,
              color: '#1a1d17',
              margin: '0 0 clamp(20px,2.4vw,28px)',
            }}
          >
            Fra en idé på kjøkkenbordet til aBoks.
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(16px,1.25vw,19px)',
              lineHeight: 1.7,
              color: '#3a3f33',
              margin: 0,
            }}
          >
            aBoks startet med et enkelt hverdagsproblem: Batterier hadde ingen naturlig plass
            hjemme. Nye og brukte batterier ble liggende i skuffer, esker og poser – uten orden og
            uten en enkel rutine for gjenvinning. Det ble starten på ideen om å samle alt i én
            løsning.
          </p>
        </Reveal>

        <Reveal delay={0.1} style={{ marginTop: 'clamp(32px,4vw,56px)' }}>
          <Photo
            image={STORY_IMAGES.hero}
            ratio="16 / 9"
            sizes="(max-width: 1240px) 100vw, 1240px"
            priority
          />
        </Reveal>
      </Section>

      {/* ==================== STARTEN ==================== */}
      <Section background={SAND}>
        <Split
          text={
            <Prose>
              <p style={eyebrow}>Starten</p>
              <h2 style={h2Style}>Et lite problem vi kjente igjen.</h2>
              <p style={bodyStyle}>
                Batterier finnes i nesten alle hjem, men oppbevaringen blir ofte tilfeldig. De blir
                liggende i en skuff, i originalemballasjen eller blandet med andre ting. Når et
                batteri er tomt, havner det gjerne et annet sted og blir liggende til neste tur til
                gjenvinning.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Ideen bak aBoks var enkel: Hva om nye AA- og AAA-batterier og brukte batterier kunne
                få én fast plass – i en løsning som var praktisk nok til å brukes hver dag og pen nok
                til å stå fremme?
              </p>
            </Prose>
          }
          media={
            <Photo
              image={STORY_IMAGES.problemBatteries}
              ratio="4 / 3"
              sizes="(max-width: 1024px) 100vw, 600px"
            />
          }
        />
      </Section>

      {/* ==================== DEN FØRSTE IDÉEN ==================== */}
      <Section background={CREAM}>
        <Reveal>
          <Prose>
            <p style={eyebrow}>Den første idéen</p>
            <h2 style={h2Style}>Først kom skissen.</h2>
            <p style={bodyStyle}>
              Den første løsningen startet som en enkel skisse av hvordan batterier kunne
              organiseres og mates frem på en mer oversiktlig måte.
            </p>
            <p style={{ ...bodyStyle, margin: 0 }}>
              Derfra begynte arbeidet med mål, geometri og CAD-modeller. Allerede fra starten var
              målet større enn å lage en vanlig oppbevaringsboks. Funksjonen måtte være enkel, men
              produktet måtte samtidig ha et uttrykk som gjorde at det kunne stå synlig i hjemmet.
            </p>
          </Prose>
        </Reveal>

        <div
          className="grid lg:grid-cols-2 items-center"
          style={{ gap: 'clamp(20px,3vw,40px)', marginTop: 'clamp(32px,4vw,56px)' }}
        >
          <Reveal>
            <Photo
              image={STORY_IMAGES.firstSketch}
              ratio="4 / 3"
              sizes="(max-width: 1024px) 100vw, 600px"
              caption="Den første skissen, tegnet på papir."
            />
          </Reveal>
          <Reveal delay={0.08}>
            {/* Wireframe: shown whole on a light panel, never cropped. */}
            <Plate
              image={STORY_IMAGES.firstCad}
              sizes="(max-width: 1024px) 100vw, 600px"
              background="#f4f1e9"
              caption="Tidlig CAD-modell – geometrien tar form."
            />
          </Reveal>
        </div>
      </Section>

      {/* ==================== PROTOTYPE 01 ==================== */}
      <Section background={LINEN}>
        <Split
          mediaFirstOnDesktop
          text={
            <Prose>
              <p style={eyebrow}>Prototype 01</p>
              <h2 style={h2Style}>Den første prototypen beviste ideen – og avslørte problemet.</h2>
              <p style={bodyStyle}>
                Den første fungerende prototypen viste at grunnformen og ideen hadde potensial.
                Batteriene skulle bevege seg ned gjennom beholderen ved hjelp av tyngdekraft og være
                tilgjengelige nederst.
              </p>
              <p style={bodyStyle}>
                I praktisk testing viste det seg raskt at løsningen hadde en svakhet. Når flere
                batterier beveget seg samtidig, oppstod friksjon. Batterier kunne legge seg mot
                hverandre og sette seg fast.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Det var et viktig punkt i utviklingen. I stedet for bare å justere den samme
                mekanismen videre, måtte selve prinsippet for hvordan batteriene beveget seg gjennom
                aBoks tenkes på nytt.
              </p>
            </Prose>
          }
          media={
            <Photo
              image={STORY_IMAGES.prototypeV1}
              ratio="4 / 3"
              sizes="(max-width: 1024px) 100vw, 600px"
              caption="Prototype 1 – ideen fungerte, men batteriene kunne sette seg fast."
            />
          }
        />
      </Section>

      {/* ==================== GJENNOMBRUDDET ==================== */}
      <Section background={DARK}>
        <Split
          text={
            <Prose dark>
              <p style={eyebrowOnDark}>Gjennombruddet</p>
              <h2 style={h2OnDark}>Batteriene måtte bevege seg én og én.</h2>
              <p style={bodyOnDark}>Løsningen ble et nytt internt prinsipp: en kaskademekanisme.</p>
              <p style={bodyOnDark}>
                I stedet for at flere batterier skulle falle samtidig, ble systemet utviklet slik at
                batteriene beveger seg trinnvis gjennom separate nivåer. Det reduserte friksjonen og
                gjorde matingen langt mer kontrollert.
              </p>
              <p style={bodyOnDark}>
                Prototype 2 viste at prinsippet fungerte. Batteriene beveget seg jevnere gjennom
                systemet, og risikoen for blokkering ble betydelig redusert.
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(23px,2.4vw,32px)',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                  color: '#faf6ee',
                  borderLeft: '2px solid #a9c08f',
                  paddingLeft: 'clamp(16px,2vw,24px)',
                  margin: 'clamp(24px,3vw,36px) 0 0',
                }}
              >
                Én og én – i stedet for alle samtidig.
              </p>
            </Prose>
          }
          media={
            /* Cross-section drawing: shown whole on a light panel, never cropped. */
            <Plate
              image={STORY_IMAGES.cascadeMechanism}
              sizes="(max-width: 1024px) 100vw, 560px"
              background="#f4f1e9"
              maxWidth="440px"
              caption="Kaskadeprinsippet: batteriene ledes trinnvis ned gjennom separate nivåer."
              captionColor="#9aa38c"
            />
          }
        />
      </Section>

      {/* ==================== PROTOTYPE 02–03 ==================== */}
      <Section background={CREAM}>
        <Reveal>
          <Prose>
            <p style={eyebrow}>Prototype 02–03</p>
            <h2 style={h2Style}>Når funksjonen virket, måtte formen tilbake.</h2>
            <p style={bodyStyle}>
              Den nye mekanismen løste mye av det tekniske problemet, men krevde mer plass. Prototype
              2 fikk derfor et mer teknisk og funksjonsorientert uttrykk enn det som var ønsket.
            </p>
            <p style={bodyStyle}>
              Neste utfordring ble å kombinere den stabile mekanikken med det renere uttrykket fra de
              første ideene.
            </p>
            <p style={bodyStyle}>
              I prototype 3 ble kaskadeløsningen bygget inn i en mer kompakt form. Mekanikken
              fungerte – men kapasiteten for AA-batterier ble for liten, rundt 12 batterier.
            </p>
            <p style={{ ...bodyStyle, margin: 0 }}>
              Dermed fortsatte jakten på balansen mellom kapasitet, stabil batteriflyt og et uttrykk
              som føltes som et ferdig produkt.
            </p>
          </Prose>
        </Reveal>

        <div
          className="grid sm:grid-cols-2"
          style={{ gap: 'clamp(16px,2.4vw,28px)', marginTop: 'clamp(32px,4vw,56px)' }}
        >
          <Reveal>
            <Photo
              image={STORY_IMAGES.prototypeV2}
              ratio="1 / 1"
              sizes="(max-width: 640px) 100vw, (max-width: 1240px) 50vw, 600px"
              caption="Prototype 2 – stabil mekanikk, men et mer teknisk uttrykk."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <Photo
              image={STORY_IMAGES.prototypeV3}
              ratio="1 / 1"
              sizes="(max-width: 640px) 100vw, (max-width: 1240px) 50vw, 600px"
              caption="Prototype 3 – mer kompakt, men for liten kapasitet for AA."
            />
          </Reveal>
        </div>
      </Section>

      {/* ==================== UTVIKLING / 3D-PRINT ==================== */}
      <Section background={SAND}>
        <Reveal>
          <Prose>
            <p style={eyebrow}>Utvikling</p>
            <h2 style={h2Style}>Ikke alle utskrifter kom hele veien.</h2>
          </Prose>
        </Reveal>

        <Reveal delay={0.06} style={{ marginTop: 'clamp(24px,3vw,40px)' }}>
          <Photo
            image={STORY_IMAGES.failedPrint}
            ratio="4 / 3"
            sizes="(max-width: 1240px) 100vw, 1240px"
            caption="En utskrift som ikke gikk som planlagt – tråder, feil lagbinding og defekter inne i modellen."
          />
        </Reveal>

        <Reveal delay={0.1} style={{ marginTop: 'clamp(28px,3.5vw,48px)' }}>
          <Prose>
            <p style={bodyStyle}>
              3D-print gjorde det mulig å utvikle aBoks raskt og teste nye ideer uten å vente på
              ekstern produksjon. Samtidig ble selve produksjonsmetoden en del av utviklingsarbeidet.
            </p>
            <p style={bodyStyle}>
              Komplekse vinkler og overheng førte enkelte ganger til svak lagbinding, deformasjoner
              og feil inne i modellen. På én prototype gjorde dette at AAA-batterier kunne sette seg
              fast.
            </p>
            <p style={{ ...bodyStyle, margin: 0 }}>
              Modellene måtte derfor ikke bare fungere på skjermen. De måtte også kunne produseres
              stabilt. Geometri, vinkler, støttepunkter og printorientering ble justert gjennom flere
              iterasjoner.
            </p>
          </Prose>
        </Reveal>
      </Section>

      {/* ==================== PROTOTYPE 04–05 ==================== */}
      <Section background={CREAM}>
        <Split
          text={
            <Prose>
              <p style={eyebrow}>Prototype 04–05</p>
              <h2 style={h2Style}>Til slutt falt alt på plass.</h2>
              <p style={bodyStyle}>
                Prototype 4 fikk større kapasitet og bedre plassutnyttelse, men også denne versjonen
                førte til nye justeringer av konstruksjon og printorientering.
              </p>
              <p style={bodyStyle}>
                Med prototype 5 kom gjennombruddet som gjorde løsningen klar for neste fase.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Kapasiteten ble økt til omtrent 20 AA-batterier og 36 AAA-batterier. Kaskadesystemet
                fungerte stabilt, batteriene ble matet som planlagt, og konstruksjonen ga et solid
                grunnlag for den videre designutviklingen.
              </p>
              <Facts />
            </Prose>
          }
          media={
            <Photo
              image={STORY_IMAGES.prototypeV5}
              ratio="3 / 4"
              sizes="(max-width: 1024px) 100vw, 600px"
              caption="Prototype 5 med kaskademodulene ute av boksen."
            />
          }
        />
      </Section>

      {/* ==================== DESIGNET ==================== */}
      <Section background={LINEN}>
        <Reveal>
          <Prose>
            <p style={eyebrow}>Designet</p>
            <h2 style={h2Style}>En fungerende mekanisme var ikke nok.</h2>
            <p style={bodyStyle}>
              Da den tekniske løsningen var på plass, flyttet arbeidet seg mot det som skulle bli den
              ferdige aBoks.
            </p>
            <p style={bodyStyle}>
              Ytterformen ble videreutviklet, toleranser ble finjustert og de innvendige modulene
              forbedret. Samtidig ble det utviklet en egen modul for brukte batterier, med plass til
              en liten pose som enkelt kan tas ut når batteriene skal leveres til gjenvinning.
            </p>
            <p style={{ ...bodyStyle, margin: 0 }}>
              Produktet fikk etter hvert flere fargevarianter og et roligere og mer helhetlig uttrykk
              – uten å miste mekanikken som var utviklet gjennom prototypene.
            </p>
          </Prose>
        </Reveal>

        <div
          className="grid sm:grid-cols-3"
          style={{ gap: 'clamp(16px,2.2vw,26px)', marginTop: 'clamp(32px,4vw,56px)' }}
        >
          {[
            { image: STORY_IMAGES.designEvolution1, caption: 'Teknisk utviklingsmodell.' },
            { image: STORY_IMAGES.designEvolution2, caption: 'Renere ytterform underveis.' },
            { image: STORY_IMAGES.finalProduct, caption: 'Den ferdige aBoks.' },
          ].map((step, i) => (
            <Reveal key={step.caption} delay={i * 0.08}>
              <Photo
                image={step.image}
                ratio="1 / 1"
                sizes="(max-width: 640px) 100vw, (max-width: 1240px) 33vw, 400px"
                caption={step.caption}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ==================== UTVIKLET MED STØTTE FRA ==================== */}
      <Section background={CREAM}>
        <Reveal>
          <Prose>
            <p style={eyebrow}>Utviklet med støtte fra</p>
            <h2 style={{ ...h2Style, margin: 0 }}>Gode ideer utvikles ikke alene.</h2>
          </Prose>
        </Reveal>

        <div
          className="grid md:grid-cols-2"
          style={{ gap: 'clamp(32px,4vw,64px)', marginTop: 'clamp(32px,4vw,56px)' }}
        >
          {SUPPORTERS.map((supporter, i) => (
            <Reveal key={supporter.name} delay={i * 0.08}>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 'clamp(16px,2vw,24px)',
                  padding: 'clamp(26px,3vw,40px)',
                  height: '100%',
                  boxShadow: '0 2px 6px rgba(42,36,24,.05)',
                }}
              >
                {/* Both limits are maxima on an auto-sized image, so the logo keeps its ratio. */}
                <Image
                  src={supporter.logoUrl}
                  alt={supporter.name}
                  width={supporter.width}
                  height={supporter.height}
                  sizes="(max-width: 768px) 60vw, 240px"
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxHeight: 'clamp(40px,6vw,58px)',
                    maxWidth: 'min(100%, 220px)',
                    objectFit: 'contain',
                  }}
                />
                <p
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#5e6a48',
                    margin: 'clamp(20px,2.4vw,28px) 0 12px',
                  }}
                >
                  {supporter.name === 'Hitra kommune'
                    ? 'Økonomisk støtte'
                    : 'Rådgivning og etablererveiledning'}
                </p>

                {supporter.name === 'Hitra kommune' ? (
                  <>
                    <p style={bodyStyle}>
                      Hitra kommune har gjennom næringsfondet gitt økonomisk støtte til utviklingen
                      av aBoks. Støtten gjorde det mulig å investere i nødvendig utstyr og
                      materialer, produsere og teste flere prototypeversjoner og videreutvikle
                      produktet frem mot markedslansering.
                    </p>
                    <p style={{ ...bodyStyle, margin: 0 }}>
                      Støtten har også bidratt i arbeidet med den digitale salgsplattformen og
                      forberedelsene som måtte på plass for å ta aBoks fra utviklingsprosjekt til et
                      produkt i markedet.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={bodyStyle}>
                      Thams Innovasjon har fulgt aBoks i overgangen fra utviklingsprosjekt til
                      virksomhet. Gjennom etablererveiledning, e-postdialog og digitale
                      veiledningsmøter har prosjektet fått råd om blant annet finansiering, videre
                      produktutvikling frem mot markedslansering og etablering av selskap.
                    </p>
                    <p style={bodyStyle}>
                      Thams Innovasjon bidro også med veiledning i arbeidet rundt varemerkesøknaden
                      for aBoks. I forbindelse med vurderingen fra Patentstyret ble det gitt innspill
                      til hvordan saken kunne håndteres, og Thams Innovasjon innhentet også råd
                      eksternt som ble formidlet videre til prosjektet.
                    </p>
                    <p style={{ ...bodyStyle, margin: 0 }}>
                      Rådgivningen har vært en del av arbeidet med å gjøre en produktidé til en mer
                      strukturert og kommersiell virksomhet.
                    </p>
                  </>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ==================== VAREMERKET ==================== */}
      <Section background={SAND}>
        <Split
          mediaFirstOnDesktop
          text={
            <Prose>
              <p style={eyebrow}>Varemerket</p>
              <h2 style={h2Style}>Navnet ble også en del av utviklingsarbeidet.</h2>
              <p style={bodyStyle}>
                aBoks-navnet ble valgt med en tydelig kobling til produktets opprinnelse: bokstaven A
                peker mot AA- og AAA-batteriene som sto i sentrum for den første løsningen.
              </p>
              <p style={bodyStyle}>
                Da navnet skulle registreres som varemerke, ble det imidlertid ikke en helt rett vei.
                Patentstyret stilte spørsmål ved om aBoks hadde tilstrekkelig særpreg, og vurderingen
                førte til en ny runde med argumentasjon og rådgivning.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Etter dialogen og den videre behandlingen ble aBoks registrert som ordmerke i Norge.
              </p>

              <dl
                style={{
                  margin: 'clamp(28px,3.5vw,40px) 0 0',
                  padding: 'clamp(22px,2.6vw,30px)',
                  background: '#fff',
                  borderRadius: 'clamp(16px,2vw,20px)',
                  border: '1px solid #e4dccb',
                }}
              >
                <dt
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 700,
                    fontSize: '11px',
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#5e6a48',
                    margin: '0 0 10px',
                  }}
                >
                  22. juli 2026
                </dt>
                <dd
                  style={{
                    fontFamily: 'var(--font-cormorant)',
                    fontWeight: 500,
                    fontSize: 'clamp(26px,2.8vw,36px)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    color: '#1a1d17',
                    margin: '0 0 8px',
                  }}
                >
                  Registrert varemerke
                </dd>
                <dd
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    fontSize: '15px',
                    color: '#4a4e41',
                    margin: '0 0 10px',
                  }}
                >
                  Reg.nr. 342807
                </dd>
                <dd style={{ ...captionStyle, margin: 0 }}>
                  Registrert som ordmerke hos Patentstyret. Søknadsdag 1. juli 2026, klasse 20.
                </dd>
              </dl>
            </Prose>
          }
          media={
            /* The certificate is a document: shown whole, at its own ratio, never cropped. */
            <Plate
              image={STORY_IMAGES.trademarkCertificate}
              sizes="(max-width: 1024px) 90vw, 420px"
              background="#fff"
              maxWidth="380px"
              caption="Registreringsbeviset fra Patentstyret."
            />
          }
        />
      </Section>

      {/* ==================== TIDLIGE TESTERE ==================== */}
      <Section background={CREAM}>
        <Split
          text={
            <Prose>
              <p style={eyebrow}>Tidlige testere</p>
              <h2 style={h2Style}>Et produkt må fungere utenfor tegneprogrammet.</h2>
              <p style={bodyStyle}>
                Prototypene ble ikke bare testet på arbeidsbordet. Løsningen ble også prøvd i vanlig
                bruk for å se hvordan mennesker faktisk fylte på batterier, tok dem ut og brukte
                systemet i hverdagen.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Over 40 husstander testet aBoks i hverdagen. Tilbakemeldinger og praktiske erfaringer
                ble brukt videre i arbeidet med kapasitet, tilgjengelighet og brukervennlighet.
              </p>
            </Prose>
          }
          media={
            <Photo
              image={STORY_IMAGES.earlyHomeTest}
              ratio="3 / 4"
              sizes="(max-width: 1024px) 100vw, 600px"
              caption="aBoks i vanlig bruk hjemme – modulen for brukte batterier løftes ut."
            />
          }
        />
      </Section>

      {/* ==================== LANSERINGEN ==================== */}
      <Section background={LINEN}>
        <Split
          mediaFirstOnDesktop
          text={
            <Prose>
              <p style={eyebrow}>Lanseringen</p>
              <h2 style={h2Style}>Så måtte produktet bli en merkevare.</h2>
              <p style={bodyStyle}>
                Parallelt med den siste produktutviklingen ble alt rundt selve aBoks bygget opp:
                visuell identitet, produktbilder, emballasje, informasjonsmateriell og nettbutikk.
              </p>
              <p style={bodyStyle}>
                aboks.no ble utviklet som både produktpresentasjon og salgskanal. Nettbutikken,
                betalingsløsningen og administrasjonssystemet ble bygget frem mot lanseringen.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Da de første kundeordrene kom inn, var aBoks ikke lenger bare et utviklingsprosjekt.
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(23px,2.4vw,32px)',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                  color: '#1a1d17',
                  borderLeft: '2px solid #c9a76a',
                  paddingLeft: 'clamp(16px,2vw,24px)',
                  margin: 'clamp(24px,3vw,36px) 0 0',
                }}
              >
                Fra prosjekt til produkt.
              </p>
            </Prose>
          }
          media={
            <Photo
              image={STORY_IMAGES.firstPackaging}
              ratio="3 / 4"
              sizes="(max-width: 1024px) 100vw, 600px"
              caption="Klar for utsendelse: ferdig pakket aBoks med produktkort og takkekort."
            />
          }
        />

        <Reveal delay={0.1} style={{ marginTop: 'clamp(32px,4vw,56px)' }}>
          {/* Screenshot: shown whole so no part of the interface is cut away. */}
          <Plate
            image={STORY_IMAGES.launchWebsite}
            sizes="(max-width: 1240px) 100vw, 1240px"
            background="#fff"
            caption="aboks.no slik nettbutikken så ut ved lansering."
          />
        </Reveal>
      </Section>

      {/* ==================== NESTE KAPITTEL ==================== */}
      <Section background={DARK}>
        <Reveal>
          <Prose dark>
            <p style={eyebrowOnDark}>Neste kapittel</p>
            <h2 style={h2OnDark}>aBoks ble mer enn ett produkt.</h2>
            <p style={bodyOnDark}>
              Etter utviklingsfasen og markedslanseringen gikk prosjektet videre inn i en ny fase.
              Arbeidet fikk en tydeligere kommersiell retning, med videre produksjon, salg og
              utvikling av nye løsninger rundt det samme grunnprinsippet.
            </p>
            <p style={{ ...bodyOnDark, margin: 0 }}>
              Det som startet som én idé for AA- og AAA-batterier ble etter hvert grunnlaget for en
              hel produktfamilie.
            </p>
          </Prose>
        </Reveal>
      </Section>

      {/* ==================== MATERIALET ==================== */}
      <Section background={CREAM}>
        <Split
          text={
            <Prose>
              <p style={eyebrow}>Materialet</p>
              <h2 style={h2Style}>Designet digitalt. Bygget lag for lag.</h2>
              <p style={bodyStyle}>
                3D-printing har vært en del av aBoks helt fra prototypefasen og gjør det mulig å
                utvikle, teste og forbedre produktet lokalt. Dagens aBoks produseres i PLA-basert
                materiale.
              </p>
              <Link
                href="/inspirasjon/fra-planter-til-aboks"
                style={{ ...ghostButton, marginTop: '8px' }}
              >
                Les om materialet
              </Link>
            </Prose>
          }
          media={
            <Photo
              image={MATERIAL_IMAGE}
              ratio="3 / 4"
              sizes="(max-width: 1024px) 100vw, 600px"
              caption="Produksjonen skjer lag for lag, lokalt."
            />
          }
        />
      </Section>

      {/* ==================== PRODUKTFAMILIEN ==================== */}
      <Section background={SAND}>
        <Split
          text={
            <Prose>
              <p style={eyebrow}>Videreutvikling</p>
              <h2 style={h2Style}>Én idé ble til flere løsninger.</h2>
              <p style={bodyStyle}>
                Den første aBoks ble starten på en produktplattform. Det samme utgangspunktet har
                senere blitt videreutviklet til løsninger for ulike behov – fra mindre modeller til
                veggmonterte og bedriftsrettede varianter.
              </p>
              <p style={{ ...bodyStyle, margin: 0 }}>
                Historien om aBoks sluttet derfor ikke da det første produktet var ferdig. Det var da
                neste fase begynte.
              </p>
            </Prose>
          }
          media={
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid #ddd2bb' }}>
              {FAMILY.map((model) => (
                <li key={model.name} style={{ borderBottom: '1px solid #ddd2bb' }}>
                  <Link
                    href={model.href}
                    style={{
                      display: 'block',
                      padding: 'clamp(16px,1.8vw,22px) 0',
                      textDecoration: 'none',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-cormorant)',
                        fontWeight: 500,
                        fontSize: 'clamp(24px,2.6vw,34px)',
                        letterSpacing: '-0.015em',
                        lineHeight: 1.1,
                        color: '#1a1d17',
                        marginBottom: '6px',
                      }}
                    >
                      {model.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-manrope)',
                        fontSize: '15px',
                        lineHeight: 1.6,
                        color: '#6b6f63',
                      }}
                    >
                      {model.note}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          }
        />
      </Section>

      {/* ==================== VEIEN VIDERE ==================== */}
      <Section background={CREAM}>
        <Reveal>
          <div
            style={{
              background: DARK,
              borderRadius: 'clamp(20px,2.6vw,28px)',
              padding: 'clamp(40px,6vw,88px) clamp(24px,5vw,72px)',
            }}
          >
            <div style={{ maxWidth: '640px' }}>
              <p style={eyebrowOnDark}>Veien videre</p>
              <h2 style={h2OnDark}>Historien er fortsatt i begynnelsen.</h2>
              <p style={{ ...bodyOnDark, margin: '0 0 clamp(28px,3.4vw,40px)' }}>
                aBoks gikk fra en skisse og en rekke prototyper til et produkt i norske hjem. Nå
                fortsetter arbeidet med nye modeller, bedre produksjon og nye måter å gjøre
                batterihåndtering enklere og mer oversiktlig.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link href="/produkter" style={{ ...primaryButton, background: '#5e6a48' }}>
                  Se produktene
                </Link>
                <Link
                  href="/inspirasjon/fra-planter-til-aboks"
                  style={{
                    ...primaryButton,
                    background: 'transparent',
                    border: '1px solid rgba(250,246,238,0.4)',
                  }}
                >
                  Fra planter til aBoks
                </Link>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: '#9fb08f',
                  margin: 'clamp(24px,2.8vw,32px) 0 0',
                }}
              >
                Vil du vite hvordan boksen fungerer i praksis? Se{' '}
                <Link href="/slik-fungerer-det" style={{ ...textLink, color: '#d7dfc9' }}>
                  slik fungerer aBoks
                </Link>
                .
              </p>
            </div>
          </div>
        </Reveal>
      </Section>
    </main>
  )
}
