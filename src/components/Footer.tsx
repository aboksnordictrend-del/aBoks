import Image from 'next/image'
import Link from 'next/link'
import styles from './Footer.module.css'

/** Horizontal aBoks wordmark (blob storage); intrinsic size is needed by next/image. */
const LOGO_URL =
  'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Logowf-horizontal-upscale.webp'
const LOGO_WIDTH = 1983
const LOGO_HEIGHT = 793

export default function Footer() {
  return (
    <footer style={{ background: '#20241a', padding: 'clamp(56px,7vw,88px) 0 36px' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div className={styles.grid}>
          {/* Brand — legal entity details; same company data as /kontakt and the terms pages. */}
          <div className={styles.brand}>
            <Image
              src={LOGO_URL}
              alt="ABOKS AS"
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
              sizes="170px"
              className={styles.logo}
            />
            <address className={styles.company}>
              <p className={styles.companyGroup}>
                <span className={styles.companyName}>ABOKS AS</span>
                <br />
                Org. nr. 834 012 952
              </p>
              <p className={styles.companyGroup}>
                Storhaugveien 13
                <br />
                7240 Hitra, Norge
              </p>
              <a href="mailto:post@aboks.no" className={styles.companyEmail}>
                {/* Same envelope the /kontakt page draws — the project has no icon
                    library, so icons are inline SVG inheriting currentColor. */}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
                post@aboks.no
              </a>
            </address>
          </div>

          {/* Handle */}
          <div>
            <h4 className={styles.heading}>Handle</h4>
            <div className={styles.links}>
              {[
                { label: 'Alle produkter', href: '/produkter' },
                { label: 'Bestill aBoks', href: '/produkter/aboks' },
                { label: 'Farger', href: '/produkter/aboks#farger' },
                { label: 'Kampanjer', href: '/kampanje' },
                { label: 'Handlekurv', href: '/handlekurv' },
              ].map((item) => (
                <Link key={item.label} href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Lær mer */}
          <div>
            <h4 className={styles.heading}>Lær mer</h4>
            <div className={styles.links}>
              {[
                { label: 'Slik fungerer det', href: '/slik-fungerer-det' },
                { label: 'Inspirasjon', href: '/inspirasjon' },
                { label: 'Anmeldelser', href: '/anmeldelser' },
                { label: 'Historien', href: '/historien' },
                { label: 'Vanlige spørsmål', href: '/vanlige-sporsmal' },
              ].map((item) => (
                <Link key={item.label} href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Kundeservice */}
          <div>
            <h4 className={styles.heading}>Kundeservice</h4>
            <div className={styles.links}>
              {[
                { label: 'Kontakt oss', href: '/kontakt' },
                { label: 'Frakt og retur', href: '/frakt-og-retur' },
                { label: 'Kjøpsvilkår', href: '/kjopsvilkar' },
                { label: 'Personvernerklæring', href: '/personvernerklaering' },
              ].map((item) => (
                <Link key={item.label} href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(250,246,238,.12)',
            paddingTop: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#7e856f' }}>
            © 2026 aBoks
          </span>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#7e856f' }}>
            Orden i batteriene – ett rom om gangen.
          </span>
        </div>
      </div>
    </footer>
  )
}
