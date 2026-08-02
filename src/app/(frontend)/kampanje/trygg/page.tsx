import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

/**
 * Campaign landing page (/kampanje/trygg).
 *
 * Server component on purpose: no state, no animation — so it inherits the site's
 * reduced-motion behaviour for free (the only transitions are the global press/hover
 * rules in globals.css) and the hero paints without a client bundle.
 *
 * Mobile-first ordering: heading → subtitle → CTA → trust badges → image, so the CTA
 * stays inside the first ~400px on a 390px-wide screen. On md+ the hero becomes two
 * columns with the image on the right.
 */

/** Existing lifestyle photo — aBoks in a real kitchen (same asset as the homepage room gallery). */
const HERO_IMAGE =
  'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-familiekj%C3%B8kkenet.png'

export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) — the campaign title carries its own suffix
  title: {
    absolute: 'Trygg batterioppbevaring – slutt med løse batterier | aBoks',
  },
  description:
    'Løse batterier lekker, blandes og havner i barnehender. aBoks holder nye, brukte og hver type trygt adskilt. Bestill i dag – 100 dagers åpent kjøp.',
  alternates: {
    canonical: 'https://aboks.no/kampanje/trygg',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: 'https://aboks.no/kampanje/trygg',
    title: 'Trygg batterioppbevaring – slutt med løse batterier | aBoks',
    description:
      'Løse batterier lekker, blandes og havner i barnehender. aBoks holder nye, brukte og hver type trygt adskilt. Bestill i dag – 100 dagers åpent kjøp.',
    images: [{ url: HERO_IMAGE, width: 1254, height: 1254, alt: 'aBoks batteriboks på et kjøkken' }],
  },
}

const PRODUCT_HREF = '/produkter/aboks'

const HERO_BADGES = ['✓ Eget rom for brukte', '✓ Samlet på ett sted', '✓ 100 dagers åpent kjøp']

const PROBLEMS = [
  {
    title: 'Lekkasje i skuffen',
    text: 'Gamle batterier som ligger løst kan lekke og ødelegge alt rundt seg.',
  },
  {
    title: 'Barn får tak i dem',
    text: 'Løse batterier i skuffer og skap er lett tilgjengelig for små hender.',
  },
  {
    title: 'Nytt og brukt blandes',
    text: 'Du vet ikke lenger hvilke batterier som er fulle og hvilke som er tomme.',
  },
]

const COMPARTMENTS = [
  { big: '20', unit: 'AA-batterier', note: 'Eget rom for nye AA.' },
  { big: '36', unit: 'AAA-batterier', note: 'Eget rom for nye AAA.' },
  { big: '1', unit: 'rom for brukte', note: 'Samlet og klart til gjenvinning.' },
]

const REASONS = [
  {
    title: 'Trygt adskilt',
    text: 'Nye og brukte batterier holdes hver for seg, så ingenting blandes.',
  },
  {
    title: 'Ryddig og oversiktlig',
    text: 'Slutt på løse batterier i skuffer og skap.',
  },
  {
    title: 'Klart til gjenvinning',
    text: 'Eget rom samler brukte batterier til levering.',
  },
  {
    title: 'Norsk design',
    text: 'Utviklet i Norge med fokus på funksjon og enkel bruk.',
  },
]

const FINAL_BADGES = ['✓ Fri frakt over kr 650', '✓ 100 dagers åpent kjøp', '✓ Sendes innen 1–3 virkedager']

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-cormorant)',
  fontWeight: 500,
  fontSize: 'clamp(30px,3.8vw,48px)',
  letterSpacing: '-0.02em',
  lineHeight: 1.07,
  color: '#1a1d17',
  margin: 0,
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '22px',
  padding: 'clamp(26px,3vw,36px) clamp(22px,2.6vw,30px)',
  boxShadow: '0 2px 6px rgba(42,36,24,.05)',
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontWeight: 700,
  fontSize: '18px',
  color: '#1a1d17',
  margin: '0 0 8px',
}

const cardTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-manrope)',
  fontSize: '15.5px',
  lineHeight: 1.6,
  color: '#6b6f63',
  margin: 0,
}

/** Same check mark the homepage problem list and the product trust list use. */
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#5f8253"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export default function KampanjeTryggPage() {
  return (
    <main>
      {/* ==================== HERO ==================== */}
      <section
        style={{
          background: '#faf6ee',
          paddingTop: 'clamp(92px,11vh,124px)',
          paddingBottom: 'clamp(48px,6vw,88px)',
        }}
      >
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          {/*
            Mobile: one flex column whose direct children are h1 / subtitle / photo / CTA / badges,
            interleaved with `order` so the photo lands above the button.
            md+: the text wrapper stops being `display: contents` and becomes a real column again,
            so the row falls back to the two-column layout (text left, photo right).
            One <Image> either way — the photo is reordered, never duplicated.
          */}
          <div className="flex flex-col md:flex-row md:items-center md:gap-[clamp(32px,5vw,72px)]">

            <div className="contents md:block md:flex-1 md:min-w-0">
              <h1
                className="order-1"
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 700,
                  // mobile floor lowered from 33px so the headline breaks evenly instead of
                  // dropping "glemmer" alone on the last line; the vw/desktop steps are unchanged
                  fontSize: 'clamp(29px,4.4vw,58px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.08,
                  color: '#1a1d17',
                  margin: '0 0 14px',
                }}
              >
                Løse batterier er en risiko{' '}
                {/* keeps the last two words on the same line, so "glemmer" can never be
                    orphaned whatever the mobile width happens to be */}
                <span style={{ whiteSpace: 'nowrap' }}>du glemmer</span>
              </h1>
              <p
                className="order-2"
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontSize: 'clamp(16px,1.3vw,18px)',
                  lineHeight: 1.6,
                  color: '#3a3f33',
                  margin: '0 0 clamp(22px,3vw,32px)',
                  maxWidth: '520px',
                }}
              >
                Barn som får tak i dem. Gamle som lekker i skuffen. Brukte som blandes med nye. aBoks
                holder alt trygt adskilt – hver type for seg, og et eget rom for brukte.
              </p>

              <Link
                href={PRODUCT_HREF}
                data-btn
                className="order-4"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  maxWidth: '360px',
                  padding: '17px 32px',
                  borderRadius: '999px',
                  background: '#39402c',
                  color: '#faf6ee',
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 700,
                  fontSize: '16px',
                  textDecoration: 'none',
                }}
              >
                Bestill aBoks
              </Link>

              <ul
                className="order-5"
                style={{
                  listStyle: 'none',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px 10px',
                  margin: '18px 0 0',
                  padding: 0,
                }}
              >
                {HERO_BADGES.map((badge) => (
                  <li
                    key={badge}
                    style={{
                      background: '#fff',
                      border: '1px solid #e7e2d4',
                      borderRadius: '999px',
                      padding: '8px 14px',
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 600,
                      fontSize: '13.5px',
                      lineHeight: 1.3,
                      color: '#3a3f33',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge}
                  </li>
                ))}
              </ul>
            </div>

            {/* order-3 puts the photo between the subtitle and the CTA on mobile; on md+ it is
                simply the second flex item, i.e. the right column. */}
            <div
              className="order-3 mb-[clamp(22px,3vw,32px)] md:mb-0 max-w-[560px] md:flex-1 md:min-w-0"
              style={{
                width: '100%',
                marginInline: 'auto',
                borderRadius: '24px',
                overflow: 'hidden',
                background: '#efe6d3',
                boxShadow: '0 18px 44px -20px rgba(42,36,24,.24)',
              }}
            >
              <Image
                src={HERO_IMAGE}
                alt="Kvinne legger et batteri i en hvit aBoks som står på kjøkkenbenken"
                width={1254}
                height={1254}
                priority
                sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 45vw, 560px"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>

          </div>
        </div>
      </section>

      {/* ==================== PROBLEM ==================== */}
      <section style={{ background: '#f2e7d7', padding: 'clamp(56px,7vw,104px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <h2 style={{ ...h2Style, marginBottom: 'clamp(28px,3.5vw,44px)' }}>
            Kjenner du igjen dette?
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'clamp(16px,2.2vw,28px)',
            }}
          >
            {PROBLEMS.map((item) => (
              <div key={item.title} style={cardStyle}>
                <div style={{ marginBottom: '16px', display: 'flex' }}>
                  <CheckIcon />
                </div>
                <h3 style={cardTitleStyle}>{item.title}</h3>
                <p style={cardTextStyle}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== SOLUTION ==================== */}
      <section style={{ background: '#39402c', padding: 'clamp(56px,7vw,104px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div style={{ maxWidth: '620px', marginBottom: 'clamp(36px,4.5vw,56px)' }}>
            <h2 style={{ ...h2Style, color: '#faf6ee', marginBottom: '18px' }}>
              aBoks gir hvert batteri sin plass
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: 'clamp(16px,1.3vw,18px)',
                lineHeight: 1.65,
                color: '#c8d2c3',
                margin: 0,
              }}
            >
              Tre atskilte rom gjør slutt på rotet. Nye AA for seg, nye AAA for seg, og et eget rom
              for brukte batterier – klare til gjenvinning.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'clamp(28px,4vw,48px)',
            }}
          >
            {COMPARTMENTS.map((c) => (
              <div key={c.unit} style={{ textAlign: 'center', padding: '0 12px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-cormorant)',
                    fontWeight: 500,
                    fontSize: 'clamp(60px,7vw,88px)',
                    lineHeight: 1,
                    color: '#faf6ee',
                    marginBottom: '10px',
                  }}
                >
                  {c.big}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: '#faf6ee',
                    margin: '0 0 6px',
                  }}
                >
                  {c.unit}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: '#c8d2c3',
                    margin: 0,
                  }}
                >
                  {c.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== WHY ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(56px,7vw,104px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <h2 style={{ ...h2Style, marginBottom: 'clamp(28px,3.5vw,44px)' }}>
            Derfor velger kunder aBoks
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'clamp(16px,2.2vw,28px)',
            }}
          >
            {REASONS.map((item) => (
              <div key={item.title} style={cardStyle}>
                <div style={{ marginBottom: '16px', display: 'flex' }}>
                  <CheckIcon />
                </div>
                <h3 style={cardTitleStyle}>{item.title}</h3>
                <p style={cardTextStyle}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section style={{ background: '#f2e7d7', padding: 'clamp(56px,7vw,104px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div
            style={{
              borderRadius: '28px',
              background: '#39402c',
              padding: 'clamp(36px,5.5vw,72px) clamp(24px,5vw,64px)',
            }}
          >
            <h2 style={{ ...h2Style, color: '#faf6ee', marginBottom: '16px' }}>
              Få orden på batteriene i dag
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: 'clamp(16px,1.3vw,18px)',
                lineHeight: 1.6,
                color: '#c8d2c3',
                margin: '0 0 clamp(24px,3vw,32px)',
                maxWidth: '480px',
              }}
            >
              aBoks holder batteriene trygt adskilt – nye, brukte og hver type for seg.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 500,
                fontSize: 'clamp(44px,5.5vw,72px)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
                color: '#faf6ee',
                margin: '0 0 clamp(24px,3vw,32px)',
              }}
            >
              kr 449
            </p>

            <Link
              href={PRODUCT_HREF}
              data-btn
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                maxWidth: '360px',
                padding: '17px 36px',
                borderRadius: '999px',
                background: '#faf6ee',
                color: '#1a1d17',
                fontFamily: 'var(--font-manrope)',
                fontWeight: 700,
                fontSize: '16px',
                textDecoration: 'none',
              }}
            >
              Bestill aBoks
            </Link>

            <ul
              style={{
                listStyle: 'none',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 20px',
                margin: '20px 0 0',
                padding: 0,
              }}
            >
              {FINAL_BADGES.map((badge) => (
                <li
                  key={badge}
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '14px',
                    lineHeight: 1.4,
                    color: '#a9c08f',
                  }}
                >
                  {badge}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
