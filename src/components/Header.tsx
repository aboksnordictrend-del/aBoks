'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useCartStore } from '@/store/cart'

type ProductLink = { title: string; slug: string }

export default function Header({ products = [] }: { products?: ProductLink[] }) {
  const pathname = usePathname()
  const isHome = pathname === '/'

  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const lastY = useRef(0)
  const rawCount = useCartStore((s) => s.totalCount())
  const totalCount = mounted ? rawCount : 0

  useEffect(() => { setMounted(true) }, [])

  // ref keeps hidden state readable inside stable scroll listener (no re-registration)
  const hiddenRef = useRef(hidden)
  hiddenRef.current = hidden

  const rafScrollTo = (target: number) => {
    const start = window.scrollY
    const distance = target - start
    const duration = 560
    const t0 = performance.now()
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      window.scrollTo({ top: start + distance * ease(p), behavior: 'instant' })
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  const headerOffset = () => {
    const h = document.querySelector('header')?.getBoundingClientRect().height ?? 80
    return h + 20 // 20px breathing room below the header
  }

  const scrollToSection = (hash: string) => {
    const el = document.getElementById(hash)
    if (el) rafScrollTo(el.getBoundingClientRect().top + window.scrollY - headerOffset())
  }

  // After navigating to home page with a hash, scroll to the target section.
  // Retries until the element is in the DOM (React may not have painted yet).
  useEffect(() => {
    if (!isHome) return
    const hash = window.location.hash.slice(1)
    if (!hash) return
    let timerId: ReturnType<typeof setTimeout>
    const tryScroll = (attempt = 0) => {
      const el = document.getElementById(hash)
      if (el) {
        rafScrollTo(el.getBoundingClientRect().top + window.scrollY - headerOffset())
      } else if (attempt < 8) {
        timerId = setTimeout(() => tryScroll(attempt + 1), 100)
      }
    }
    timerId = setTimeout(tryScroll, 60)
    return () => clearTimeout(timerId)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const isScrolled = y > 36
      let isHidden = hiddenRef.current
      if (y > lastY.current + 4 && y > 160) isHidden = true
      else if (y < lastY.current - 4) isHidden = false
      lastY.current = y
      setScrolled(isScrolled)
      setHidden(isHidden)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, []) // stable: hiddenRef keeps current value without re-registering listener

  useEffect(() => {
    setMenuOpen(false)
    setHidden(false)
    setScrolled(false)
  }, [pathname])

  // Gated on `mounted` (not just isHome/scrolled): usePathname() can resolve
  // differently between the server-rendered static HTML and the client's first
  // render for this shared-layout component, which was flipping the trust bar
  // and header background on/off and causing a hydration mismatch (React #418).
  const atHeroTop = mounted && isHome && !scrolled
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
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)] py-[12px] grid grid-cols-[1fr_auto_1fr] lg:flex lg:justify-between items-center">

          {/* LEFT col: hamburger (mobile only) | logo (desktop only) */}
          <div className="flex items-center">
            {/* Mobile: hamburger */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Meny"
              type="button"
              className="flex lg:hidden items-center"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#1a1d17' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            {/* Desktop: logo */}
            <Link href="/" aria-label="aBoks – hjem" className="hidden lg:flex items-center">
              <Image src="/logo.png" alt="aBoks" height={56} width={62} style={{ height: '56px', width: 'auto' }} priority />
            </Link>
          </div>

          {/* CENTER col: logo (mobile only) */}
          <Link href="/" aria-label="aBoks – hjem" className="flex lg:hidden items-center justify-center">
            <Image src="/logo.png" alt="aBoks" height={56} width={62} style={{ height: '56px', width: 'auto' }} priority />
          </Link>

          {/* RIGHT col: nav (desktop only) + cart (always) + hamburger (desktop only) */}
          <div className="flex items-center justify-end" style={{ gap: 'clamp(16px,2.6vw,38px)' }}>
            <nav className="hidden lg:flex items-center gap-[clamp(16px,2.6vw,38px)]" aria-label="Primærnavigasjon">
              <Link href="/produkter" style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.01em', color: '#1a1d17', textDecoration: 'none', padding: '6px 0' }}>
                Produkter
              </Link>
              {[
                { label: 'Slik fungerer det', hash: 'slik' },
                { label: 'Historien',         hash: 'historien' },
                { label: 'Inspirasjon',       href: '/inspirasjon' },
                { label: 'Spørsmål',          hash: 'faq' },
              ].map((item) => (
                'href' in item ? (
                  <Link key={item.label} href={item.href!} style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.01em', color: '#1a1d17', textDecoration: 'none', padding: '6px 0' }}>
                    {item.label}
                  </Link>
                ) : (
                  <Link
                    key={item.label}
                    href={`/#${item.hash}`}
                    onClick={(e) => {
                      if (!isHome) return // let Link navigate to /#hash; useEffect handles scroll
                      e.preventDefault()
                      scrollToSection(item.hash!)
                    }}
                    style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.01em', color: '#1a1d17', textDecoration: 'none', padding: '6px 0' }}
                  >
                    {item.label}
                  </Link>
                )
              ))}
            </nav>

            <Link href="/handlekurv" aria-label="Handlekurv" style={{ position: 'relative', color: '#1a1d17', display: 'flex', alignItems: 'center', padding: '6px' }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.1" />
                <circle cx="18" cy="20" r="1.1" />
                <path d="M2.2 3.2h2.1l2.3 11.8a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 6.3H5.3" />
              </svg>
              <AnimatePresence>
                {totalCount > 0 && (
                  <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    style={{ position: 'absolute', top: '-1px', right: '-1px', minWidth: '17px', height: '17px', padding: '0 4px', borderRadius: '999px', background: '#39402c', color: '#faf6ee', fontFamily: 'var(--font-manrope)', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {totalCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>

            {/* Desktop: hamburger after cart */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Meny"
              type="button"
              className="hidden lg:flex items-center"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#1a1d17' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
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
              padding: 'clamp(20px,3vw,48px) clamp(20px,6vw,96px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'clamp(36px,5vw,64px)' }}>
              <span
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#6b6f63',
                }}
              >
                Meny
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Lukk"
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#1a1d17' }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav
              aria-label="Mobilmeny"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'clamp(32px,4vw,48px) clamp(32px,5vw,72px)',
              }}
            >
              {[
                {
                  label: 'Handle',
                  links: [
                    { label: 'Alle produkter', href: '/produkter' },
                    ...products.map(p => ({ label: p.title, href: `/produkter/${p.slug}` })),
                    { label: 'Handlekurv', href: '/handlekurv' },
                  ],
                },
                {
                  label: 'Lær mer',
                  links: [
                    { label: 'Slik fungerer det', href: '/#slik',      hash: 'slik' },
                    { label: 'Historien',          href: '/#historien', hash: 'historien' },
                    { label: 'Inspirasjon',        href: '/inspirasjon' },
                    { label: 'Spørsmål',           href: '/#faq',       hash: 'faq' },
                  ],
                },
                {
                  label: 'Annet',
                  links: [
                    { label: 'Hjem',                href: '/' },
                    { label: 'Kontakt oss',         href: '/kontakt' },
                    { label: 'Frakt og retur',      href: '/frakt-og-retur' },
                    { label: 'Kjøpsvilkår',         href: '/kjopsvilkar' },
                    { label: 'Personvernerklæring', href: '/personvernerklaering' },
                  ],
                },
              ].map((section) => (
                <div key={section.label} className="md:text-center">
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#696a62', margin: '0 0 14px' }}>
                    {section.label}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {section.links.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        onClick={(e) => {
                          setMenuOpen(false)
                          if ('hash' in link && link.hash) {
                            if (isHome) {
                              e.preventDefault()
                              scrollToSection(link.hash as string)
                            }
                            // else: let Link navigate to /#hash; useEffect handles scroll
                          }
                        }}
                        style={{ display: 'block', padding: '11px 0', borderBottom: '1px solid #e7e2d4', fontFamily: 'var(--font-cormorant)', fontSize: '26px', fontWeight: 600, color: '#1a1d17', textDecoration: 'none' }}
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
