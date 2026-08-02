import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'

/**
 * Index of campaign landing pages (/kampanje).
 *
 * Not linked from the Header on purpose — it exists so the individual landings under
 * /kampanje/* have a parent, and so new ones only need an entry in CAMPAIGNS below.
 */

export const metadata: Metadata = {
  title: 'Kampanjer',
  description: 'Oversikt over kampanjesidene til aBoks.',
  alternates: {
    canonical: '/kampanje',
  },
}

const CAMPAIGNS = [
  {
    title: 'Trygg batterioppbevaring',
    text: 'Få orden på nye og brukte batterier med aBoks.',
    href: '/kampanje/trygg',
    // Same Blob asset as the hero of /kampanje/trygg — referenced, not copied
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-familiekj%C3%B8kkenet.png',
    imageAlt: 'aBoks for oppbevaring av nye og brukte batterier',
  },
]

export default function KampanjeIndexPage() {
  return (
    <main
      style={{
        background: '#faf6ee',
        minHeight: '100vh',
        paddingTop: 'clamp(96px,12vh,132px)',
        // breathing room before the footer: 32px on mobile → 56px from ~1120px up.
        // padding, not a margin on the card grid: a bottom margin collapses out of <main>
        // and is then swallowed by minHeight, leaving ~4px of gap on short viewports.
        paddingBottom: 'clamp(32px,5vw,56px)',
      }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Kampanjer' }]} />

        <h1
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(38px,5vw,68px)',
            letterSpacing: '-0.024em',
            lineHeight: 1.0,
            color: '#1a1d17',
            margin: '0 0 clamp(32px,4vw,48px)',
          }}
        >
          Kampanjer
        </h1>

        <div
          style={{
            display: 'grid',
            // auto-fill (not auto-fit) so a single card keeps its intended width instead of
            // stretching across the whole container; two 420px cards fit per row.
            // min(100%, 400px) keeps the track from forcing overflow on narrow screens.
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 400px), 1fr))',
            gap: 'clamp(16px,2.2vw,28px)',
            // 2 × 420 + 28 gap — makes the track hug the card instead of leaving it adrift
            maxWidth: '868px',
          }}
        >
          {CAMPAIGNS.map((c) => (
            <article
              key={c.href}
              style={{
                background: '#fff',
                borderRadius: '22px',
                // clips the flush-to-edge image so its top corners follow the card radius
                overflow: 'hidden',
                boxShadow: '0 2px 6px rgba(42,36,24,.05)',
                width: '100%',
                maxWidth: '420px',
              }}
            >
              {/* intrinsic width/height + height:auto keeps the source's own 1:1 ratio, so the
                  whole photo is visible and nothing is cropped or stretched. The reserved
                  aspect ratio also means no layout shift. */}
              <Image
                src={c.image}
                alt={c.imageAlt}
                width={1254}
                height={1254}
                sizes="(max-width: 767px) calc(100vw - 40px), 420px"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
              {/* the card's original padding moved here so the image can sit flush to the edges */}
              <div style={{ padding: 'clamp(22px,3vw,32px) clamp(20px,2.6vw,28px)' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 700,
                    fontSize: '19px',
                    color: '#1a1d17',
                    margin: '0 0 10px',
                  }}
                >
                  {c.title}
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '15.5px',
                    lineHeight: 1.6,
                    color: '#6b6f63',
                    margin: '0 0 20px',
                  }}
                >
                  {c.text}
                </p>
                {/* aria-label keeps the link distinguishable once there is more than one card;
                    the visible label stays "Les mer" */}
                <Link
                  href={c.href}
                  aria-label={`Les mer om ${c.title}`}
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    fontSize: '15px',
                    color: '#39402c',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  Les mer
                </Link>
              </div>
            </article>
          ))}
        </div>

      </div>
    </main>
  )
}
