'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useCartStore } from '@/store/cart'

export default function Header() {
  const pathname = usePathname()
  const isHome = pathname === '/'

  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const lastY = useRef(0)
  const totalCount = useCartStore((s) => s.totalCount())

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const isScrolled = y > 36
      let isHidden = hidden
      if (y > lastY.current + 4 && y > 160) isHidden = true
      else if (y < lastY.current - 4) isHidden = false
      lastY.current = y
      setScrolled(isScrolled)
      setHidden(isHidden)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [hidden])

  useEffect(() => {
    setMenuOpen(false)
    setHidden(false)
    setScrolled(false)
  }, [pathname])

  const atHeroTop = isHome && !scrolled
  const bg = atHeroTop ? 'transparent' : 'rgba(250,246,238,0.85)'
  const blur = atHeroTop ? '' : 'saturate-[140%] backdrop-blur-[14px]'
  const shadow = atHeroTop ? '' : 'shadow-header'
  const textColor = 'text-ink'

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: bg,
          transform: hidden ? 'translateY(-120%)' : 'translateY(0)',
          transition: 'transform 0.45s cubic-bezier(.22,.61,.36,1), background 0.3s ease, box-shadow 0.3s ease',
          backdropFilter: atHeroTop ? 'none' : 'saturate(140%) blur(14px)',
          WebkitBackdropFilter: atHeroTop ? 'none' : 'saturate(140%) blur(14px)',
          boxShadow: atHeroTop ? 'none' : '0 1px 0 rgba(42,36,24,.07)',
        }}
      >
        {/* Trust bar */}
        <AnimatePresence>
          {atHeroTop && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-b border-[rgba(42,36,24,.09)] overflow-hidden hidden lg:block"
            >
              <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)] py-2 flex justify-center flex-wrap gap-[clamp(14px,4vw,52px)]">
                {['Fri frakt over kr 650', '100 dagers åpent kjøp', 'Designet i Norge'].map(
                  (t, i) => (
                    <span
                      key={i}
                      style={{
                        fontFamily: 'var(--font-manrope)',
                        fontSize: '11.5px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#46532e',
                        fontWeight: 600,
                      }}
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main nav */}
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)] py-[15px] flex items-center justify-between gap-4">
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 600,
              fontSize: '29px',
              letterSpacing: '0.005em',
              color: '#1a1d17',
              lineHeight: 1,
              textDecoration: 'none',
            }}
          >
            aBoks
          </Link>

          <div className="flex items-center gap-[clamp(16px,2.6vw,38px)]">
            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-[clamp(16px,2.6vw,38px)]">
              {[
                { label: 'Produkter', href: '/produkt/aboks' },
                { label: 'Slik fungerer det', href: '/#slik' },
                { label: 'Historien', href: '/#historien' },
                { label: 'Spørsmål', href: '/#faq' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    fontSize: '14px',
                    letterSpacing: '0.01em',
                    color: '#1a1d17',
                    textDecoration: 'none',
                    padding: '6px 0',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Cart */}
            <Link
              href="/handlekurv"
              aria-label="Handlekurv"
              style={{ position: 'relative', color: '#1a1d17', display: 'flex', alignItems: 'center', padding: '6px' }}
            >
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="20" r="1.1" />
                <circle cx="18" cy="20" r="1.1" />
                <path d="M2.2 3.2h2.1l2.3 11.8a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 6.3H5.3" />
              </svg>
              <AnimatePresence>
                {totalCount > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    style={{
                      position: 'absolute',
                      top: '-1px',
                      right: '-1px',
                      minWidth: '17px',
                      height: '17px',
                      padding: '0 4px',
                      borderRadius: '999px',
                      background: '#39402c',
                      color: '#faf6ee',
                      fontFamily: 'var(--font-manrope)',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {totalCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Meny"
              className="lg:hidden"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                color: '#1a1d17',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              background: '#faf6ee',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 600,
                  fontSize: '29px',
                  color: '#1a1d17',
                }}
              >
                aBoks
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Lukk"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#1a1d17' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '40px 48px',
              }}
            >
              {[
                {
                  label: 'Handle',
                  links: [
                    { label: 'aBoks', href: '/produkt/aboks' },
                    { label: 'Handlekurv', href: '/handlekurv' },
                  ],
                },
                {
                  label: 'Lær mer',
                  links: [
                    { label: 'Slik fungerer det', href: '/#slik' },
                    { label: 'Historien', href: '/#historien' },
                    { label: 'Spørsmål', href: '/#faq' },
                  ],
                },
                {
                  label: 'Annet',
                  links: [
                    { label: 'Hjem', href: '/' },
                  ],
                },
              ].map((section) => (
                <div key={section.label}>
                  <p style={{
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#9a9a8e',
                    margin: '0 0 14px',
                  }}>
                    {section.label}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {section.links.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'block',
                          padding: '11px 0',
                          borderBottom: '1px solid #e7e2d4',
                          fontFamily: 'var(--font-cormorant)',
                          fontSize: '26px',
                          fontWeight: 600,
                          color: '#1a1d17',
                          textDecoration: 'none',
                        }}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
