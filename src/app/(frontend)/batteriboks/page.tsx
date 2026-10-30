import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import { CAPACITY, STEPS } from '@/lib/content'
import { formatPrice } from '@/lib/format'
import { getEffectivePrice } from '@/lib/pricing'
import { absoluteUrl } from '@/lib/site'
import {
  BATTERIBOKS_DESCRIPTION,
  BATTERIBOKS_FAQS,
  BATTERIBOKS_PATH,
  BATTERIBOKS_TITLE,
  buildFaqJsonLd,
  buildWebPageJsonLd,
  comparisonNote,
  comparisonRow,
} from '@/lib/batteriboks'
import { getBatteriboksModels } from '@/lib/batteriboksModels'

export const revalidate = 3600

const HERO_IMAGE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-olive-ny-800x800.webp'
const RANGE_IMAGE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Hero-desktop-ny.webp'
const PROBLEM_IMAGE = '/images/problem-visual.webp'
// Open Graph, Twitter and the WebPage JSON-LD all share the hero photo.
const OG_IMAGE = HERO_IMAGE

export const metadata: Metadata = {
  title: { absolute: BATTERIBOKS_TITLE },
  description: BATTERIBOKS_DESCRIPTION,
  alternates: { canonical: absoluteUrl(BATTERIBOKS_PATH) },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: absoluteUrl(BATTERIBOKS_PATH),
    title: BATTERIBOKS_TITLE,
    description: BATTERIBOKS_DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 800, height: 800, alt: 'Olivengrønn aBoks batteriboks med nye AA- og AAA-batterier i skuffene foran' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: BATTERIBOKS_TITLE,
    description: BATTERIBOKS_DESCRIPTION,
    images: [OG_IMAGE],
  },
}

// Site palette, with the dark blue from the product range used as a restrained accent.
const CREAM = '#faf6ee'
const CREAM_DEEP = '#f2ede2'
const INK = '#1a1d17'
const BODY = '#3a3f33'
const MUTED = '#6b6f63'
const OLIVE = '#39402c'
const OLIVE_SOFT = '#5e6a48'
const OLIVE_TINT = '#e6ecdf'
const BLUE = '#1e3a5f'
const BORDER = '#e7e2d4'

const SERIF = 'var(--font-cormorant)'
const SANS = 'var(--font-manrope)'

const eyebrow: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: OLIVE_SOFT,
  margin: '0 0 14px',
}

const h2Style: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 500,
  fontSize: 'clamp(30px,3.6vw,48px)',
  letterSpacing: '-0.02em',
  lineHeight: 1.07,
  color: INK,
  margin: '0 0 20px',
}

const lead: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 'clamp(16px,1.25vw,18px)',
  lineHeight: 1.65,
  color: BODY,
  margin: '0 0 20px',
}

const body: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: '16px',
  lineHeight: 1.7,
  color: BODY,
  margin: '0 0 16px',
}

const textLink: React.CSSProperties = {
  color: OLIVE,
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px 34px',
  borderRadius: '999px',
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: '15px',
  textDecoration: 'none',
  transition: 'background 0.2s ease, color 0.2s ease, transform 0.2s ease',
}

const sectionGap = 'clamp(72px,9vw,120px)'

function CheckIcon({ color = OLIVE }: { color?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '3px' }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

const BENEFITS = [
  {
    title: 'Slutt på batterirot',
    text: 'Samle AA- og AAA-batteriene på ett fast sted, slik at du slipper å lete gjennom skuffer og skap når du trenger et nytt batteri.',
    icon: (
      <path d="M4 7h16M4 12h16M4 17h10" />
    ),
  },
  {
    title: 'Nye og brukte – hver for seg',
    text: 'Med separate rom for nye og brukte batterier blir det enklere å holde oversikt og unngå å blande dem.',
    icon: (
      <>
        <rect x="3" y="5" width="7" height="14" rx="1.5" />
        <rect x="14" y="5" width="7" height="14" rx="1.5" />
      </>
    ),
  },
  {
    title: 'Enklere å levere til gjenvinning',
    text: 'Samle brukte batterier på ett sted før du leverer dem til et godkjent innsamlingspunkt.',
    icon: (
      <path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7.2 9.5M11 5.5l1-1.7a1.8 1.8 0 0 1 3.1 0l3.9 6.7M17 19h2.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2M14 16l-3 3 3 3M8.5 6.5L7.2 9.5 4 8.6M19.5 13.3l-.7-3.3-3.3.8" />
    ),
  },
]

const HIGHLIGHTS = [
  { title: 'Eget rom for nye AA-batterier', text: 'De vanligste batteriene i hjemmet får sin egen, faste plass.' },
  { title: 'Eget rom for nye AAA-batterier', text: 'De mindre cellene ligger for seg, så du slipper å sortere når du trenger dem.' },
  { title: 'Lett tilgang til nye batterier', text: 'Batteriene ligger klare i boksen, og du tar det du trenger rett fra riktig rom.' },
  { title: 'Eget rom for brukte batterier', text: 'Tomme batterier legges et annet sted enn de nye – og venter der til de skal leveres.' },
  { title: 'Kompakt, skandinavisk design', text: 'En stilren boks som kan stå framme i gangen, på kjøkkenet eller på kontoret.' },
]

const RELATED_ARTICLES = [
  { href: '/inspirasjon/beste-losninger-batterioppbevaring-hjemme', title: 'De beste løsningene for batterioppbevaring hjemme' },
  { href: '/inspirasjon/oppbevare-batterier-trygt-hjemme', title: 'Hvordan oppbevare batterier trygt hjemme?' },
  { href: '/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme', title: 'Slik sorterer du batteriene riktig hjemme' },
  { href: '/inspirasjon/hvor-levere-brukte-batterier', title: 'Hvor kan man levere brukte batterier?' },
]

export default async function BatteriboksPage() {
  const models = await getBatteriboksModels()
  const comparisonRows = models.map(comparisonRow)
  const comparisonText = comparisonNote(comparisonRows)
  const stepFill = STEPS.find((s) => s.number === 2)
  const stepUse = STEPS.find((s) => s.number === 3)
  const stepRecycle = STEPS.find((s) => s.number === 4)
  const capacityAa = CAPACITY.find((c) => c.unit === 'AA-batterier')?.big
  const capacityAaa = CAPACITY.find((c) => c.unit === 'AAA-batterier')?.big

  return (
    <main style={{ background: CREAM, minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebPageJsonLd(OG_IMAGE)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />

      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Batteriboks' }]} />

        {/* ── Hero ── */}
        <section
          aria-labelledby="batteriboks-heading"
          className="grid items-center gap-[clamp(32px,5vw,72px)] md:grid-cols-[1.05fr_1fr]"
          style={{ marginBottom: sectionGap }}
        >
          <div className="order-2 md:order-1">
            <p style={eyebrow}>Smart batterioppbevaring</p>
            <h1
              id="batteriboks-heading"
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 'clamp(40px,5.4vw,72px)',
                letterSpacing: '-0.024em',
                lineHeight: 1.0,
                color: INK,
                margin: '0 0 22px',
              }}
            >
              Batteriboks for nye og <em style={{ fontStyle: 'italic', color: OLIVE }}>brukte</em> batterier
            </h1>
            <p style={{ ...lead, maxWidth: '540px', margin: '0 0 32px' }}>
              Lei av løse batterier i skuffer og skap? Med aBoks får du en smart og oversiktlig
              batteriboks som samler nye AA- og AAA-batterier og gir brukte batterier sin egen plass.
              En praktisk løsning som gjør det enklere å holde orden hjemme.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Link
                href="/produkter/aboks"
                data-btn
                className="hover:bg-[#2b3121] hover:-translate-y-px"
                style={{ ...buttonBase, background: OLIVE, color: CREAM }}
              >
                Se aBoks
              </Link>
              <Link
                href="/produkter"
                data-btn
                className="hover:bg-[#39402c] hover:text-[#faf6ee]"
                style={{ ...buttonBase, border: `1.5px solid ${OLIVE}`, color: OLIVE, fontWeight: 600 }}
              >
                Utforsk alle modeller
              </Link>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '32px 0 0', display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
              {['Nye AA og AAA', 'Eget rom for brukte', 'Designet i Norge'].map((item) => (
                <li key={item} style={{ display: 'flex', gap: '8px', fontFamily: SANS, fontSize: '14px', color: MUTED }}>
                  <CheckIcon color={OLIVE_SOFT} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <div
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: '28px',
                overflow: 'hidden',
                background: '#ede8db',
                boxShadow: '0 30px 60px -30px rgba(26,29,23,0.35)',
              }}
            >
              <Image
                src={HERO_IMAGE}
                alt="Olivengrønn aBoks batteriboks på en kommode, med nye AA- og AAA-batterier i skuffene foran"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>
        </section>

        {/* ── A: Why a battery box ── */}
        <section aria-labelledby="hvorfor-heading" style={{ marginBottom: sectionGap }}>
          <div className="grid items-center gap-[clamp(32px,5vw,64px)] md:grid-cols-2" style={{ marginBottom: 'clamp(36px,4vw,56px)' }}>
            {/* Desktop (lg+) shows the image on the left; source order keeps the heading first. */}
            <div className="lg:order-2">
              <h2 id="hvorfor-heading" style={h2Style}>Hvorfor trenger du en batteriboks?</h2>
              <p style={lead}>
                Batterier finnes overalt i hjemmet – i fjernkontroller, leker, klokker og elektroniske
                apparater. Men når batteriene oppbevares løst i skuffer, blir det fort vanskelig å
                skille nye fra brukte.
              </p>
              <p style={body}>
                En vanlig oppbevaringsboks holder batteriene samlet, men den sier ingenting om hvilke
                som fortsatt virker. Det er forskjellen en batteriboks med faste rom gjør: du ser med
                en gang hva som er nytt, og hva som skal leveres. Flere tips finner du i guiden{' '}
                <Link href="/inspirasjon/orden-i-skuffen" style={textLink}>Orden i skuffen</Link>.
              </p>
            </div>
            <div className="lg:order-1" style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: '24px', overflow: 'hidden', background: '#ede8db' }}>
              <Image
                src={PROBLEM_IMAGE}
                alt="Løse, blandede batterier i en kurv på en kommode"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>
          <div className="grid gap-[clamp(16px,2vw,24px)] md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <article
                key={b.title}
                className="transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(26,29,23,0.3)]"
                style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '22px', padding: 'clamp(24px,2.6vw,34px)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                  <span style={{ width: '48px', height: '48px', borderRadius: '999px', background: OLIVE_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={OLIVE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {b.icon}
                    </svg>
                  </span>
                  <span aria-hidden="true" style={{ fontFamily: SERIF, fontSize: '28px', color: '#c9c3b3' }}>0{i + 1}</span>
                </div>
                <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: '18px', color: INK, margin: '0 0 8px' }}>{b.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: MUTED, margin: 0 }}>{b.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* ── B: Product explanation ── */}
      <section aria-labelledby="losning-heading" style={{ background: CREAM_DEEP, padding: `${sectionGap} 0`, marginBottom: sectionGap }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div style={{ maxWidth: '720px', marginBottom: 'clamp(32px,4vw,48px)' }}>
            <p style={eyebrow}>Slik er aBoks bygget opp</p>
            <h2 id="losning-heading" style={h2Style}>Én batteriboks. Flere smarte løsninger.</h2>
            <p style={lead}>
              aBoks er utviklet for deg som ønsker mer enn en vanlig oppbevaringsboks. Den kombinerer
              praktisk oppbevaring av nye AA- og AAA-batterier med et eget rom for brukte batterier –
              i et kompakt design som passer inn i hjemmet.
            </p>
          </div>
          <div className="grid items-start gap-[clamp(32px,5vw,64px)] lg:grid-cols-[1.25fr_1fr]">
            <div style={{ position: 'relative', aspectRatio: '3500 / 1997', borderRadius: '24px', overflow: 'hidden', background: '#ede8db' }}>
              <Image
                src={RANGE_IMAGE}
                alt="Fire aBoks batteribokser i svart, olivengrønt, mørkeblått og hvitt, med batterier i skuffene"
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {HIGHLIGHTS.map((h, i) => (
                <li key={h.title} style={{ display: 'flex', gap: '18px', padding: '16px 0', borderTop: i === 0 ? 'none' : '1px solid #ddd6c6' }}>
                  <span
                    aria-hidden="true"
                    style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '999px', background: i === 3 ? BLUE : OLIVE, color: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: '13px' }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: '16px', color: INK, margin: '4px 0 4px' }}>{h.title}</h3>
                    <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.55, color: MUTED, margin: 0 }}>{h.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        {/* ── C: Model range ── */}
        <section aria-labelledby="modeller-heading" style={{ marginBottom: sectionGap }}>
          <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto clamp(36px,4vw,56px)' }}>
            <p style={eyebrow}>Modellene</p>
            <h2 id="modeller-heading" style={h2Style}>Finn batteriboksen som passer dine behov</h2>
            <p style={{ ...lead, margin: 0 }}>
              Noen trenger plass til både AA og AAA, andre bruker nesten bare én størrelse. Noen vil
              ha boksen på benken, andre på veggen. Derfor finnes aBoks i flere varianter.
            </p>
          </div>

          {models.length === 0 ? (
            <p style={{ ...body, textAlign: 'center' }}>
              Se alle modellene på <Link href="/produkter" style={textLink}>produktsiden</Link>.
            </p>
          ) : (
            // Below `sm` the grid and cards follow the /produkter mobile listing (two-up,
            // gap-x-5 gap-y-9, borderless cards, 20px title, 13px two-line copy, 12px outline
            // button). From `sm` up every value is the page's original tablet/desktop card.
            <ul className="grid grid-cols-2 items-stretch gap-x-5 gap-y-9 sm:gap-[clamp(18px,2.2vw,28px)] lg:grid-cols-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {models.map((m) => {
                const effective = m.price > 0 ? getEffectivePrice(m.price, m.sale) : 0
                return (
                  <li
                    key={m.slug}
                    className="group flex min-w-0 flex-col sm:overflow-hidden sm:rounded-[22px] sm:border sm:border-[#e7e2d4] sm:bg-white"
                  >
                    <Link
                      href={m.href}
                      data-btn
                      tabIndex={-1}
                      aria-hidden="true"
                      className="relative mb-3.5 block aspect-square overflow-hidden rounded-2xl bg-[#ede8db] sm:mb-0 sm:rounded-none"
                      style={{ textDecoration: 'none' }}
                    >
                      <Image
                        src={m.image}
                        alt={m.imageAlt}
                        fill
                        sizes="(max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                      <span
                        className="absolute left-2.5 top-2.5 px-2.5 py-[5px] text-[10px] sm:left-[14px] sm:top-[14px] sm:px-3 sm:py-1.5 sm:text-[11px]"
                        style={{ background: 'rgba(250,246,238,0.92)', color: OLIVE, borderRadius: '999px', fontFamily: SANS, fontWeight: 700, letterSpacing: '0.06em' }}
                      >
                        {m.tag}
                      </span>
                    </Link>
                    <div className="flex flex-1 flex-col sm:p-[clamp(20px,2.2vw,28px)]">
                      <h3
                        className="mb-1.5 text-[20px] leading-[1.12] tracking-[-0.015em] [overflow-wrap:anywhere] sm:mb-2.5 sm:text-[clamp(24px,2.1vw,30px)] sm:leading-[1.1] sm:tracking-normal sm:[overflow-wrap:normal]"
                        style={{ fontFamily: SERIF, fontWeight: 600, color: INK }}
                      >
                        <Link href={m.href} style={{ color: 'inherit', textDecoration: 'none' }}>{m.name}</Link>
                      </h3>
                      <p
                        className="mb-3.5 line-clamp-2 text-[13px] sm:mb-5 sm:line-clamp-none sm:text-[15px]"
                        style={{ fontFamily: SANS, lineHeight: 1.6, color: MUTED }}
                      >
                        {m.copy}
                      </p>
                      <div className="mt-auto flex flex-col items-start gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                        <div style={{ fontFamily: SANS }}>
                          {effective > 0 && (
                            <span className="text-[15px] sm:text-[17px]" style={{ fontWeight: 700, color: INK }}>
                              {formatPrice(effective)}
                              {effective < m.price && (
                                <s className="ml-1.5 text-[12px] sm:ml-2 sm:text-[14px]" style={{ fontWeight: 500, color: MUTED }}>
                                  <span className="sr-only">Før </span>{formatPrice(m.price)}
                                </s>
                              )}
                            </span>
                          )}
                          {m.soldOut && (
                            <span className="text-[12px] sm:text-[13px]" style={{ display: 'block', color: '#8a4b2f', marginTop: '2px' }}>Utsolgt for øyeblikket</span>
                          )}
                        </div>
                        <Link
                          href={m.href}
                          data-btn
                          aria-label={`Se ${m.name}`}
                          className="whitespace-nowrap px-[18px] py-2 text-[12px] tracking-[0.02em] text-[#39402c] hover:bg-[#39402c] hover:text-[#faf6ee] sm:whitespace-normal sm:px-5 sm:py-[9px] sm:text-[13px] sm:tracking-normal"
                          style={{ display: 'inline-flex', alignItems: 'center', fontFamily: SANS, fontWeight: 600, borderRadius: '999px', border: `1.5px solid ${OLIVE}`, textDecoration: 'none', transition: 'background 0.2s ease, color 0.2s ease' }}
                        >
                          {/* Phones show the short /produkter label so the button fits a half-width card. */}
                          <span className="sm:hidden">Se produkt</span>
                          <span className="hidden sm:inline">Se {m.name}</span>
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Comparison: one row per published model in the grid, counts from each product's CMS capacity. */}
          {comparisonRows.length > 0 && (
            <div style={{ maxWidth: '760px', margin: 'clamp(48px,6vw,72px) auto 0' }}>
              <h3
                id="sammenlign-heading"
                style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(26px,2.6vw,34px)', letterSpacing: '-0.015em', lineHeight: 1.15, color: INK, textAlign: 'center', margin: '0 0 20px' }}
              >
                Sammenlign aBoks-modellene
              </h3>
              {/* Scrolls on its own if a narrow screen cannot fit it, so the page never scrolls sideways. */}
              <div
                role="region"
                aria-labelledby="sammenlign-heading"
                tabIndex={0}
                className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39402c]"
                style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '18px' }}
              >
                <table className="w-full min-w-[330px] text-[14px] sm:text-[15px]" style={{ borderCollapse: 'collapse', fontFamily: SANS, color: BODY }}>
                  <thead>
                    <tr style={{ background: CREAM_DEEP }}>
                      {['Modell', 'Nye AA', 'Nye AAA', 'Brukte batterier'].map((label, i) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-3 py-3 sm:px-5 sm:py-3.5"
                          style={{ fontWeight: 700, fontSize: '13px', color: INK, textAlign: i === 0 ? 'left' : 'center', verticalAlign: 'bottom' }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr key={row.slug} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <th scope="row" className="px-3 py-3 sm:px-5 sm:py-3.5" style={{ fontWeight: 600, color: INK, textAlign: 'left', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </th>
                        {[row.aa, row.aaa, row.used].map((cell, i) => (
                          <td key={i} className="px-3 py-3 sm:px-5 sm:py-3.5" style={{ textAlign: 'center', lineHeight: 1.4 }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {comparisonText && (
                <p style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.6, color: MUTED, margin: '14px 0 0' }}>
                  {comparisonText}
                </p>
              )}
            </div>
          )}

          <p style={{ ...body, textAlign: 'center', margin: 'clamp(28px,3vw,40px) auto 0', maxWidth: '640px' }}>
            Skal du ha batterioppbevaring på jobben? Se{' '}
            <Link href="/bedrifter" style={textLink}>løsninger for bedrifter</Link>, med pakker for
            kontor, skole og fellesområder.
          </p>
        </section>

        {/* ── D: New and used AA/AAA ── */}
        <section aria-labelledby="aa-aaa-heading" style={{ marginBottom: sectionGap }}>
          <div className="grid items-center gap-[clamp(32px,5vw,72px)] md:grid-cols-2">
            <div className="grid grid-cols-2 gap-[clamp(12px,1.5vw,18px)]">
              {[stepFill, stepUse].map((step, i) =>
                step ? (
                  <div key={step.number} style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: '20px', overflow: 'hidden', background: '#ede8db', marginTop: i === 1 ? 'clamp(24px,4vw,48px)' : 0 }}>
                    <Image
                      src={step.posterUrl}
                      alt={i === 0 ? 'Nye batterier legges i hvert sitt rom i aBoks' : 'Et nytt batteri tas ut av aBoks'}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                ) : null,
              )}
            </div>
            <div>
              <h2 id="aa-aaa-heading" style={h2Style}>Smart oppbevaring av AA- og AAA-batterier</h2>
              <p style={lead}>
                AA- og AAA-batterier er blant de vanligste batteritypene i norske hjem. Med aBoks kan
                du organisere nye batterier etter størrelse og samle brukte batterier separat. Da vet
                du hvor du finner batteriene når du trenger dem, og hvor du legger dem når de er tomme.
              </p>
              <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: '17px', color: INK, margin: '28px 0 12px' }}>Slik bruker du den</h3>
              <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  `Fyll nye AA- og AAA-batterier i hvert sitt rom${capacityAa && capacityAaa ? ` – det er plass til ${capacityAa} AA og ${capacityAaa} AAA i standardmodellen` : ''}.`,
                  'Ta et nytt batteri rett fra riktig rom når fjernkontrollen eller leken trenger det.',
                  'Legg det tomme batteriet i rommet for brukte, i stedet for tilbake i skuffen.',
                  'Når rommet for brukte er fullt, leverer du batteriene til et innsamlingspunkt.',
                ].map((text, i) => (
                  <li key={i} style={{ display: 'flex', gap: '14px', fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: BODY }}>
                    <span aria-hidden="true" style={{ flexShrink: 0, fontFamily: SERIF, fontWeight: 600, fontSize: '22px', lineHeight: 1.1, color: OLIVE_SOFT, width: '18px' }}>{i + 1}</span>
                    {text}
                  </li>
                ))}
              </ol>
              <p style={body}>
                Se alle stegene med video på <Link href="/slik-fungerer-det" style={textLink}>slik fungerer aBoks</Link>.
                Lurer du på hvilke batterier som passer i hvilke apparater, har vi en egen guide om{' '}
                <Link href="/inspirasjon/hvilke-batterier-passer-til-hva" style={textLink}>hvilke batterier som passer til hva</Link>.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── E: Responsible handling ── */}
      <section aria-labelledby="brukte-heading" style={{ background: BLUE, padding: `${sectionGap} 0`, marginBottom: sectionGap }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div className="grid items-center gap-[clamp(32px,5vw,72px)] md:grid-cols-[1fr_0.8fr]">
            <div>
              <p style={{ ...eyebrow, color: '#b9c8d9' }}>Gjenvinning</p>
              <h2 id="brukte-heading" style={{ ...h2Style, color: CREAM }}>Hva gjør du med brukte batterier?</h2>
              <p style={{ ...lead, color: '#e4e9ef' }}>
                Brukte batterier skal ikke kastes i restavfallet. De skal leveres til et godkjent
                innsamlingspunkt, for eksempel en butikk som tar imot brukte batterier eller en
                gjenvinningsstasjon.
              </p>
              <p style={{ ...body, color: '#d3dbe5' }}>
                Med en egen plass for brukte batterier blir det enklere å samle dem opp og huske å
                levere dem til gjenvinning. Les mer om{' '}
                <Link href="/inspirasjon/hvor-levere-brukte-batterier" style={{ ...textLink, color: '#ffffff' }}>hvor du kan levere brukte batterier</Link>{' '}
                og{' '}
                <Link href="/inspirasjon/hvordan-resirkuleres-batterier" style={{ ...textLink, color: '#ffffff' }}>hvordan batterier resirkuleres</Link>.
              </p>
              <aside
                role="note"
                aria-label="Sikkerhetsinformasjon"
                style={{ display: 'flex', gap: '14px', marginTop: '28px', background: CREAM, borderRadius: '18px', padding: 'clamp(18px,2vw,24px)', borderLeft: '5px solid #c98a2e' }}
              >
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8a5a14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
                <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: INK, margin: 0 }}>
                  <strong>Viktig:</strong> aBoks er beregnet for de batteritypene som er angitt i
                  produktets bruksanvisning. Litiumbatterier og skadde eller oppsvulmede batterier skal
                  ikke legges i aBoks. Følg alltid sikkerhetsinstruksjonene som følger med produktet.
                </p>
              </aside>
            </div>
            {stepRecycle && (
              <div style={{ position: 'relative', aspectRatio: '4 / 5', borderRadius: '24px', overflow: 'hidden', background: '#2a4a70' }}>
                <Image
                  src={stepRecycle.posterUrl}
                  alt="Brukte batterier fra aBoks leveres til et innsamlingspunkt"
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        {/* ── Search-term variants ── */}
        <section aria-labelledby="navn-heading" style={{ marginBottom: sectionGap }}>
          <div style={{ maxWidth: '720px' }}>
            <h2 id="navn-heading" style={h2Style}>Batteriboks, batteribox eller batteri boks?</h2>
            <p style={lead}>
              Det er ikke alltid lett å vite hva man skal søke etter. Noen skriver batteriboks, andre
              batteri boks, batteribox eller batteri box. Navnet varierer, men behovet er det samme: et
              fast sted for batteriene, så du slipper å lete i skuffer og lure på hvilke som er brukt.
              aBoks har egne rom for nye AA- og AAA-batterier og et separat rom for brukte batterier.
            </p>
          </div>
        </section>

        {/* ── F: FAQ ── */}
        <section aria-labelledby="faq-heading" style={{ marginBottom: sectionGap }}>
          <div className="grid gap-[clamp(28px,4vw,64px)] lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p style={eyebrow}>Spørsmål og svar</p>
              <h2 id="faq-heading" style={h2Style}>Ofte stilte spørsmål om batteribokser</h2>
              <p style={body}>
                Finner du ikke svaret? Se flere <Link href="/vanlige-sporsmal" style={textLink}>vanlige spørsmål om aBoks</Link>{' '}
                eller <Link href="/kontakt" style={textLink}>kontakt oss</Link>.
              </p>
            </div>
            <div style={{ borderTop: `1px solid ${BORDER}` }}>
              {BATTERIBOKS_FAQS.map((faq, i) => (
                // Native <details>: keyboard-accessible, needs no client JavaScript, and the
                // answer text is in the server-rendered HTML that the FAQPage markup describes.
                <details key={faq.id} className="group" open={i === 0} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <summary
                    className="flex cursor-pointer list-none items-center justify-between gap-5 py-[22px] px-1 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39402c]"
                  >
                    <h3 style={{ fontFamily: SANS, fontWeight: 600, fontSize: '17px', color: INK, margin: 0 }}>{faq.question}</h3>
                    <span aria-hidden="true" className="transition-transform duration-300 group-open:rotate-45" style={{ fontSize: '24px', lineHeight: 1, color: OLIVE, fontWeight: 300, flexShrink: 0 }}>+</span>
                  </summary>
                  <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.7, color: BODY, margin: 0, padding: '0 4px 24px', maxWidth: '640px' }}>
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── G: Final CTA ── */}
        <section aria-labelledby="cta-heading" style={{ marginBottom: 'clamp(48px,6vw,72px)' }}>
          <div className="grid items-center gap-[clamp(28px,4vw,56px)] md:grid-cols-[1.2fr_1fr]" style={{ borderRadius: '28px', background: OLIVE, padding: 'clamp(36px,6vw,72px) clamp(24px,5vw,64px)' }}>
            <div>
              <h2 id="cta-heading" style={{ ...h2Style, color: CREAM, margin: '0 0 16px' }}>Gi batteriene en fast plass</h2>
              <p style={{ fontFamily: SANS, fontSize: '17px', lineHeight: 1.6, color: '#d6dccd', margin: '0 0 30px', maxWidth: '480px' }}>
                Med aBoks får du en praktisk og stilren løsning for batterioppbevaring. Mindre rot,
                bedre oversikt og en enklere hverdag.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <Link href="/produkter" data-btn className="hover:bg-white" style={{ ...buttonBase, background: CREAM, color: INK }}>
                  Finn din aBoks
                </Link>
                <Link
                  href="/slik-fungerer-det"
                  data-btn
                  className="hover:bg-[rgba(250,246,238,0.12)]"
                  style={{ ...buttonBase, border: '1.5px solid rgba(250,246,238,0.5)', color: CREAM, fontWeight: 600 }}
                >
                  Se hvordan aBoks fungerer
                </Link>
              </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {['Egne rom for nye AA og AAA', 'Eget rom for brukte batterier', 'Fri frakt over kr 650', '100 dagers åpent kjøp'].map((item) => (
                <li key={item} style={{ display: 'flex', gap: '12px', fontFamily: SANS, fontSize: '16px', color: CREAM }}>
                  <CheckIcon color="#c8d6b4" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Related reading */}
        <nav aria-labelledby="les-mer-heading" style={{ marginBottom: 'clamp(80px,10vw,128px)' }}>
          <h2 id="les-mer-heading" style={{ fontFamily: SANS, fontWeight: 700, fontSize: '13px', letterSpacing: '0.16em', textTransform: 'uppercase', color: OLIVE_SOFT, margin: '0 0 16px' }}>
            Les mer om batterioppbevaring
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {RELATED_ARTICLES.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  data-btn
                  className="hover:border-[#39402c] hover:bg-white"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '18px 22px', border: `1px solid ${BORDER}`, borderRadius: '16px', fontFamily: SANS, fontWeight: 600, fontSize: '15px', color: INK, textDecoration: 'none', transition: 'background 0.2s ease, border-color 0.2s ease' }}
                >
                  {a.title}
                  <span aria-hidden="true" style={{ color: OLIVE }}>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  )
}
