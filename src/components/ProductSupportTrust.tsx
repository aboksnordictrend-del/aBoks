import Image from 'next/image'
import { SUPPORTERS } from '@/lib/supporters'

/**
 * The credit line under the product page's "Legg i handlekurv" button. Deliberately
 * quiet — no card, border, shadow or background, and a muted 13px type so it stays
 * clearly secondary to the CTA above it.
 *
 * The sentence is fixed copy rather than being assembled from SUPPORTERS: the exact
 * wording is what keeps this a statement of development support and not a claim of
 * partnership. If a third organisation is ever added to SUPPORTERS, update this
 * sentence by hand.
 */
const SUPPORT_LINE = 'aBoks er utviklet med støtte fra Hitra kommune og Thams Innovasjon.'

/**
 * The two logos have very different proportions (Hitra ≈ 2.6:1, Thams ≈ 4.5:1), so a
 * shared height alone would make the wide Thams mark visually dominate. Capping both a
 * height *and* a width lets each scale down to whichever limit it hits first, which
 * lands them at a comparable optical size without forcing either to a fixed width.
 * Both limits are maxima on an auto-sized image, so the aspect ratio stays the
 * browser's to keep. At these sizes the pair is ~188px wide including the gap, which
 * fits on one line inside the 280px content column of a 320px viewport.
 */
const LOGO_MAX_HEIGHT = '26px'
const LOGO_MAX_WIDTH = '104px'

export default function ProductSupportTrust() {
  return (
    <div style={{ margin: '0 0 24px', textAlign: 'center' }}>
      <p
        style={{
          fontFamily: 'var(--font-manrope)',
          fontSize: '13px',
          lineHeight: 1.55,
          color: '#6b6057',
          // `auto` side margins centre the 440px measure itself, so the text block is
          // centred in the column and not just centred within a left-hugging box.
          margin: '0 auto 10px',
          maxWidth: '440px',
        }}
      >
        {SUPPORT_LINE}
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        {SUPPORTERS.map((supporter) => {
          const logo = (
            <Image
              src={supporter.logoUrl}
              alt={supporter.name}
              width={supporter.width}
              height={supporter.height}
              sizes="104px"
              style={{
                width: 'auto',
                height: 'auto',
                maxHeight: LOGO_MAX_HEIGHT,
                maxWidth: LOGO_MAX_WIDTH,
                objectFit: 'contain',
              }}
            />
          )

          return (
            <li key={supporter.name} style={{ display: 'flex', alignItems: 'center' }}>
              {supporter.href ? (
                <a
                  href={supporter.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  {logo}
                </a>
              ) : (
                logo
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
