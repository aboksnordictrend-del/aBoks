import { getImageProps } from 'next/image'
import { INK, OLIVE, SANS, SERIF, SOFT, eyebrowStyle, primaryButton, secondaryButton } from '../bedrifter/theme'
import AnchorLink from './AnchorLink'
import { HERO, IMAGES } from './content'
import styles from './page.module.css'

/** Keep in step with the `--wide` query in page.module.css. */
const WIDE = '(min-aspect-ratio: 1/1) and (min-width: 768px)'

/**
 * Full-viewport hero. The fixed header is transparent over it (HERO_TOP_ROUTES in Header.tsx)
 * with its ordinary dark nav — both photos are light at the top, like /bedrifter's.
 *
 * Art direction with <picture>: only the photo for the current viewport is downloaded, still
 * through the Next image optimizer. Server-rendered; the two buttons are the only client code.
 */
export default function MiljoHero() {
  const common = { alt: IMAGES.heroAlt, sizes: '100vw', quality: 80 }
  const {
    props: { srcSet: wide },
  } = getImageProps({ ...common, ...IMAGES.heroDesktop })
  const {
    props: { srcSet: tall, ...img },
  } = getImageProps({ ...common, ...IMAGES.heroMobile, priority: true })

  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <picture className={styles.picture}>
        <source media={WIDE} srcSet={wide} sizes="100vw" />
        <source srcSet={tall} sizes="100vw" />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
        <img {...img} />
      </picture>
      <div aria-hidden="true" className={styles.scrim} />

      <div className={styles.inner}>
        <div className={styles.copy}>
          <div>
            <p className={styles.rise} style={{ ...eyebrowStyle, margin: '0 0 16px', animationDelay: '0.05s' }}>
              {HERO.eyebrow}
            </p>
            <h1
              id="hero-title"
              className={styles.rise}
              style={{
                fontFamily: SERIF,
                fontWeight: 700,
                fontSize: 'clamp(34px,3.8vw,58px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: INK,
                margin: 0,
                animationDelay: '0.12s',
              }}
            >
              {HERO.headline}
              <br />
              <em style={{ fontStyle: 'italic', color: OLIVE }}>{HERO.headlineAccent}</em>
            </h1>
          </div>

          <div className={styles.bottom}>
            <p
              className={`${styles.rise} ${styles.text}`}
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(15.5px,1.3vw,18.5px)',
                lineHeight: 1.65,
                color: SOFT,
                margin: '0 0 28px',
                maxWidth: '46ch',
                animationDelay: '0.3s',
              }}
            >
              {HERO.text}
            </p>
            <div
              className={`${styles.rise} ${styles.actions} flex w-full max-w-[400px] flex-wrap gap-3 md:max-w-none md:gap-[14px]`}
              style={{ animationDelay: '0.42s' }}
            >
              <AnchorLink
                target="prov-demoen"
                className="grow basis-[calc(50%-6px)] px-[22px] sm:px-9 md:grow-0 md:basis-auto"
                style={primaryButton}
              >
                {HERO.primaryCta}
              </AnchorLink>
              <AnchorLink
                target="slik-fungerer-det"
                className="grow basis-[calc(50%-6px)] px-[22px] sm:px-8 md:grow-0 md:basis-auto"
                style={{ ...secondaryButton, background: 'rgba(255,255,255,.7)' }}
              >
                {HERO.secondaryCta}
              </AnchorLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
