import Link from 'next/link'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer style={{ background: '#20241a', padding: 'clamp(56px,7vw,88px) 0 36px' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div className={styles.grid}>
          {/* Brand */}
          <div className={styles.brand}>
            <div
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 600,
                fontSize: '30px',
                color: '#faf6ee',
                marginBottom: '14px',
              }}
            >
              aBoks
            </div>
            <p
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#9aa18c',
                margin: 0,
                maxWidth: '220px',
              }}
            >
              Smart batteriorganisering, designet i Norge.
            </p>
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
