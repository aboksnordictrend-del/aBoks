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
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
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
            // auto-fill (not auto-fit) so a single card keeps a sensible width instead of
            // stretching across the whole container; further campaigns fill the row.
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'clamp(16px,2.2vw,28px)',
            maxWidth: '1000px',
            marginBottom: 'clamp(80px,10vw,128px)',
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
              }}
            >
              {/* 16:10 — close to 16:9, but tall enough that the crop of the square source
                  keeps the whole box in frame; objectPosition biases it towards the product */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', background: '#efe6d3' }}>
                <Image
                  src={c.image}
                  alt={c.imageAlt}
                  fill
                  sizes="(max-width: 767px) calc(100vw - 40px), 360px"
                  style={{ objectFit: 'cover', objectPosition: 'center 75%' }}
                />
              </div>
              {/* the card's original padding moved here so the image can sit flush to the edges */}
              <div style={{ padding: 'clamp(26px,3vw,36px) clamp(22px,2.6vw,30px)' }}>
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
