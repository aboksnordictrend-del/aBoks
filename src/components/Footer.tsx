import Link from 'next/link'

export default function Footer() {
  return (
    <footer style={{ background: '#20241a', padding: 'clamp(56px,7vw,88px) 0 36px' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '40px',
            marginBottom: '56px',
          }}
        >
          {/* Brand */}
          <div>
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
            <h4
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#a9c08f',
                margin: '0 0 18px',
              }}
            >
              Handle
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Alle produkter', href: '/produkter' },
                { label: 'Bestill aBoks', href: '/produkter/aboks' },
                { label: 'Farger', href: '/produkter/aboks#farger' },
                { label: 'Handlekurv', href: '/handlekurv' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '15px',
                    color: '#d7dccd',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Lær mer */}
          <div>
            <h4
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#a9c08f',
                margin: '0 0 18px',
              }}
            >
              Lær mer
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Slik fungerer det', href: '/#slik' },
                { label: 'Historien', href: '/#historien' },
                { label: 'Vanlige spørsmål', href: '/#faq' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '15px',
                    color: '#d7dccd',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Kundeservice */}
          <div>
            <h4
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#a9c08f',
                margin: '0 0 18px',
              }}
            >
              Kundeservice
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Kontakt oss', 'Frakt og retur', 'Vilkår'].map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '15px',
                    color: '#d7dccd',
                  }}
                >
                  {t}
                </span>
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
