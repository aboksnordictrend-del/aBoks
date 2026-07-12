'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Carousel, { CarouselArrows } from '@/components/Carousel'
import type { CarouselHandle } from '@/components/Carousel'
import Accordion from '@/components/Accordion'
import SaleCountdown from '@/components/SaleCountdown'
import HowItWorksSteps from '@/components/HowItWorksSteps'
import { isSaleActive, getEffectivePrice, type SaleInfo } from '@/lib/pricing'
import { formatPrice } from '@/lib/format'
import { FAQS, COMPARTMENTS, CAPACITY } from '@/lib/content'

const COLORS = [
  { id: 'olive', name: 'Olivengrønn', swatch: '#5b6347', sku: 'ABOKS-OLIVE-001', image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-olive.webp' },
  { id: 'blue',  name: 'Mørk blå',    swatch: '#243153', sku: 'ABOKS-BLUE-001',  image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-blue.webp' },
  { id: 'black', name: 'Sort',         swatch: '#1d1d1f', sku: 'ABOKS-SORT-001',  image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-sort.webp' },
  { id: 'cream', name: 'Creme',        swatch: '#FAF7F2', sku: 'ABOKS-CREME-001', image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-creme.webp' },
]

const FEATURES = [
  { n: '01', title: 'Tre adskilte rom', desc: 'AA, AAA og brukte batterier – hver type på sin egen plass.' },
  { n: '02', title: 'Alltid oversikt', desc: 'Se på et blikk hva du har igjen, og hva som skal gjenvinnes.' },
  { n: '03', title: 'Rask tilgang', desc: 'Ta batteriet du trenger på et øyeblikk – enkelt, raskt og oversiktlig.' },
  { n: '04', title: 'Matt premium-finish', desc: 'Diskré, slitesterkt design som passer i ethvert rom.' },
]

const TESTIMONIALS = [
  { quote: 'Endelig orden i batterikaoset. Jeg finner alltid det jeg leter etter.', name: 'Marianne H. · Oslo' },
  { quote: 'Det lille rommet for brukte er genialt – nå blir de faktisk levert til gjenvinning.', name: 'Anders T. · Bergen' },
  { quote: 'Ser så ren og fin ut på kjøkkenbenken at gjestene spør hvor jeg kjøpte den.', name: 'Ingrid S. · Trondheim' },
]

const CAROUSEL_ITEMS = [
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-blue-2.webp', alt: 'aBoks Mørk blå' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-1.webp', alt: 'aBoks Hvit' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-sort-1.webp', alt: 'aBoks Sort' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-olive-1-new.webp', alt: 'aBoks Olivengrønn' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-4.webp', alt: 'aBoks Hvit 4' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-5.webp', alt: 'aBoks Hvit 5' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-blue-4.webp', alt: 'aBoks Blå 4' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-7.webp', alt: 'aBoks Hvit 7' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-blue-3.webp', alt: 'aBoks Blå 3' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-olive-2.webp', alt: 'aBoks Olivengrønn 2' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-sort-3.webp', alt: 'aBoks Sort 3' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-2.webp', alt: 'aBoks Hvit 2' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-6.webp', alt: 'aBoks Hvit 6' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-sort-2.webp', alt: 'aBoks Sort 2' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-blue-1.webp', alt: 'aBoks Blå 1' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-10.webp', alt: 'aBoks Hvit 10' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-olive-3.webp', alt: 'aBoks Olivengrønn 3' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-12.webp', alt: 'aBoks Hvit 12' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-3.webp', alt: 'aBoks Hvit 3' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-8.webp', alt: 'aBoks Hvit 8' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Galleri-1/aBoks-hvit-9.webp', alt: 'aBoks Hvit 9' },
]

const LIFESTYLE = [
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-Hvit-1.webp', alt: 'Ren og tidløs – aBoks i hvit.' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-olive.webp', alt: 'Tar seg godt ut – uansett hvor du setter den.' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-blue.webp', alt: 'Robust nok for hytta og turen.' },
  { src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-sort.webp', alt: 'Tidløst design som varer.' },
]

const FUTURE = [
  { name: 'aBoks Mini', desc: 'Kompakt utgave laget for skuffen.' },
  { name: 'aBoks Wall', desc: 'Veggmontert oppbevaring for garasjen.' },
  { name: 'aBoks Pro', desc: 'Større kapasitet for verkstedet.' },
]

const ROOMS = [
  { label: 'Ved TV-en',           image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Ved-TV.png' },
  { label: 'I boden',             image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/I-boden.png' },
  { label: 'På familiekjøkkenet', image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-familiekj%C3%B8kkenet.png' },
  { label: 'På soverommet',       image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-soverommet.png' },
  { label: 'På barnerommet',      image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-barnerommet.png' },
  { label: 'På hjemmekontoret',   image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-hjemmekontoret.png' },
  { label: 'I gangen',            image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/I-gangen.png' },
  { label: 'På vaskerommet',      image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Pa-vaskerommet.png' },
]

const PRICE = 499

const homeTextLink: React.CSSProperties = {
  color: '#39402c',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}


function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] },
  }
}


export default function HomeClient({ sale, price }: { sale: SaleInfo | null; price: number }) {
  const [colorId, setColorId] = useState('olive')
  const [saleExpired, setSaleExpired] = useState(false)
  const saleActive = !saleExpired && isSaleActive(price, sale)
  const effectivePrice = saleExpired ? price : getEffectivePrice(price, sale)
  const activeColor = COLORS.find((c) => c.id === colorId) ?? COLORS[0]
  const prodCarouselRef   = useRef<CarouselHandle>(null)
  const lifeCarouselRef   = useRef<CarouselHandle>(null)
  const solutionVideoRef  = useRef<HTMLVideoElement>(null)
  const mainVideoRef      = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const SOLUTION_SRC = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Video/aBoks-olive-video.mp4'
    const MAIN_SRC     = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Video/aBoks-blue-video.mp4'
    const setup = (v: HTMLVideoElement | null, src: string) => {
      if (!v) return () => {}
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!v.src || v.src === window.location.href) v.src = src
            v.play().catch(() => {})
          } else {
            v.pause()
            v.removeAttribute('src')
            v.load()
          }
        },
        { threshold: 0.25 }
      )
      obs.observe(v)
      return () => obs.disconnect()
    }
    const c1 = setup(solutionVideoRef.current, SOLUTION_SRC)
    const c2 = setup(mainVideoRef.current, MAIN_SRC)
    return () => { c1(); c2() }
  }, [])

  return (
    <main>
      {/* DEV-ONLY: sale diagnostic overlay */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', bottom: 8, right: 8, zIndex: 9999, background: 'rgba(0,0,0,0.85)', color: '#0f0', fontFamily: 'monospace', fontSize: 11, padding: '8px 12px', borderRadius: 6, maxWidth: 340, pointerEvents: 'none' }}>
          <div>price: {price}</div>
          <div>saleActive: {String(saleActive)}</div>
          <div>salePrice: {String(sale?.salePrice ?? 'null')}</div>
          <div>saleStart: {String(sale?.saleStartDate ?? 'null')}</div>
          <div>saleEnd: {String(sale?.saleEndDate ?? 'null')}</div>
        </div>
      )}
      {/* ==================== HERO ==================== */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#e0bd92',
        }}
      >
        {/* Desktop hero */}
        <div className="hidden md:block">
          <Image
            src="https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-hero-decktop.webp"
            alt="aBoks i tre farger – olivengrønn, mørk blå og sort"
            width={2000}
            height={1200}
            priority
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: '33%',
                minWidth: '300px',
                maxWidth: '480px',
                paddingLeft: 'clamp(24px,5vw,72px)',
                paddingRight: '20px',
                marginLeft: '100px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <HeroContent
                colorId={colorId}
                setColorId={setColorId}
                sale={saleActive ? sale : null}
                onExpire={() => setSaleExpired(true)}
              />
            </div>
          </div>
        </div>

        {/* Mobile hero – full-bleed background image with text top, buttons bottom */}
        <div
          className="relative flex flex-col md:hidden"
          style={{ height: '100svh', minHeight: '620px', overflow: 'hidden' }}
        >
          <Image
            src="https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aboks-hero-mobile.webp"
            alt="aBoks i tre farger"
            fill
            priority
            style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
          />
          {/* Gradient: warm top for text readability → transparent middle → dark bottom for buttons */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(210,175,120,0.72) 0%, rgba(210,175,120,0.3) 28%, transparent 48%, rgba(8,6,3,0.55) 100%)',
          }} />

          {/* TOP: eyebrow + heading + subtitle */}
          <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(88px,22vw,120px) 28px 0', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3d4a2a', margin: '0 0 16px' }}>
              Smart batteriorganisering
            </p>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 700, fontSize: 'clamp(34px,9vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.08, color: '#1a1d17', margin: '0 0 14px' }}>
              Samle batteriene på{' '}
              <em style={{ fontStyle: 'italic', color: '#2e3520' }}>ett</em> sted.
            </h1>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 400, fontSize: '16px', lineHeight: 1.6, color: '#2e3318', margin: 0 }}>
              aBoks organiserer nye, brukte, AA- og AAA-batterier i én smart boks.
            </p>
          </div>

          {/* BOTTOM: buttons + color swatches */}
          <div style={{
            position: 'relative', zIndex: 2, marginTop: 'auto',
            padding: '0 28px clamp(40px,10vw,60px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
          }}>
            <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '360px' }}>
              <Link href={`/produkter/aboks?variant=${activeColor.sku}`} data-btn style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px 20px', borderRadius: '999px', background: '#39402c', color: '#faf6ee',
                fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '15px', textDecoration: 'none',
              }}>Bestill nå</Link>
              <Link href={`/produkter/aboks?variant=${activeColor.sku}`} data-btn style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', color: '#fff',
                fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '15px',
                border: '1.5px solid rgba(255,255,255,0.45)', textDecoration: 'none',
              }}>Se produktet</Link>
            </div>
            {saleActive && sale?.saleStartDate && sale?.saleEndDate && (
              <div style={{ width: '100%', maxWidth: '360px' }}>
                <SaleCountdown
                  startDate={sale.saleStartDate}
                  endDate={sale.saleEndDate}
                  onExpire={() => setSaleExpired(true)}
                  variant="dark"
                />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#fff' }}>Velg din farge</span>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', fontWeight: 600, color: '#fff' }}>{activeColor.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '14px' }}>
                {COLORS.map((c) => (
                  <button key={c.id} onClick={() => setColorId(c.id)} aria-label={c.name} style={{
                    width: '44px', height: '44px', borderRadius: '999px', border: 'none', cursor: 'pointer', padding: 0, background: c.swatch,
                    boxShadow: colorId === c.id ? '0 0 0 2.5px rgba(255,255,255,0.9), 0 0 0 4.5px rgba(255,255,255,0.4)' : '0 0 0 1px rgba(255,255,255,0.35)',
                    transition: 'transform 0.15s ease, filter 0.15s ease, box-shadow 0.2s ease',
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="hidden md:flex"
          style={{
            position: 'absolute',
            left: 'clamp(20px,5vw,48px)',
            bottom: '32px',
            zIndex: 2,
            alignItems: 'center',
            gap: '10px',
            color: '#6b6f63',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
          <span
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Bla ned
          </span>
        </div>
      </section>

      {/* ==================== PROBLEM ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div
          className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'clamp(40px,6vw,80px)',
            alignItems: 'center',
          }}
        >
          <motion.div {...fadeUp()}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b06a4a', margin: '0 0 18px' }}>
              Problemet
            </p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: '0 0 24px' }}>
              Batterier overalt – og aldri når du trenger dem.
            </h2>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '18px', lineHeight: 1.65, color: '#3a3f33', margin: '0 0 18px' }}>
              Løse batterier i kjøkkenskuffen, i sekken, i garasjen. Du vet aldri hvilke som er fulle, og de tomme blir liggende altfor lenge.
            </p>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '18px', lineHeight: 1.65, color: '#3a3f33', margin: 0 }}>
              Resultatet er rot, kasting av gode batterier og brukte celler som aldri når gjenvinningen.
            </p>
          </motion.div>
          <motion.div {...fadeUp(0.1)} style={{ position: 'relative', aspectRatio: '4/3', borderRadius: '22px', overflow: 'hidden', background: '#efe6d3' }}>
            <Image src="https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/problem-visual.webp" alt="Løse batterier i en skuff" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 50vw" />
          </motion.div>
        </div>
      </section>

      {/* ==================== SOLUTION ==================== */}
      <section id="slik" style={{ background: '#f2e7d7', padding: 'clamp(72px,9vw,120px) 0', scrollMarginTop: '80px' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'clamp(40px,6vw,80px)',
              alignItems: 'center',
              marginBottom: 'clamp(48px,7vw,88px)',
            }}
          >
            <motion.div {...fadeUp()} className="order-2 md:order-1" style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 24px 48px -18px rgba(42,36,24,.22)' }}>
              <video
                ref={solutionVideoRef}
                muted
                loop
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </motion.div>
            <motion.div {...fadeUp(0.1)} className="order-1 md:order-2 md:pl-[40px]">
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>Løsningen</p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: '0 0 24px' }}>
                Én boks. Tre rom.{' '}
                <em style={{ fontStyle: 'italic', color: '#39402c' }}>Full oversikt.</em>
              </h2>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '18px', lineHeight: 1.65, color: '#3a3f33', margin: '0 0 20px' }}>
                aBoks gir hvert batteri sin faste plass – nye AA, nye AAA og et eget rom for de brukte. Du ser alltid hva du har, og hva som skal gjenvinnes.
              </p>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', lineHeight: 1.65, color: '#3a3f33', margin: '0 0 32px' }}>
                Les mer om{' '}
                <Link href="/slik-fungerer-det" style={homeTextLink}>slik fungerer aBoks</Link>, eller se{' '}
                <Link href="/produkter" style={homeTextLink}>alle produkter</Link>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {COMPARTMENTS.map((c) => (
                  <div key={c.tag} style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', padding: '18px 0', borderTop: '1px solid #ddd2bb' }}>
                    <span style={{ flexShrink: 0, width: '54px', height: '54px', borderRadius: '999px', background: '#e6ecdf', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '14px', color: '#39402c' }}>
                      {c.tag}
                    </span>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#1a1d17', margin: '0 0 4px' }}>{c.name}</h3>
                      <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.5, color: '#6b6f63', margin: 0 }}>{c.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...fadeUp()} style={{ maxWidth: '680px', marginBottom: 'clamp(40px,5vw,64px)' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>Hvorfor aBoks</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Gjennomtenkt ned til minste detalj.
            </h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'clamp(20px,2.4vw,32px)' }}>
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.n}
                {...fadeUp(i * 0.08)}
                style={{ background: '#fff', borderRadius: '22px', padding: '36px 30px', boxShadow: '0 2px 6px rgba(42,36,24,.05)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
                whileHover={{ y: -3, boxShadow: '0 18px 40px -16px rgba(42,36,24,.16)' }}
              >
                <div style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: '30px', color: '#c9a76a', marginBottom: '18px', lineHeight: 1 }}>{f.n}</div>
                <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '19px', color: '#1a1d17', margin: '0 0 10px' }}>{f.title}</h3>
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15.5px', lineHeight: 1.55, color: '#6b6f63', margin: 0 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== ROOMS GALLERY ==================== */}
      <section style={{ background: '#f2e7d7', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...fadeUp()} style={{ marginBottom: 'clamp(40px,5vw,64px)' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 14px' }}>
              Passer overalt i hjemmet
            </p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: '0 0 20px' }}>
              Én boks. <em>Mange steder.</em>
            </h2>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(15px,1.4vw,17.5px)', lineHeight: 1.7, color: '#6b6f63', margin: 0, maxWidth: '540px' }}>
              aBoks er laget for å passe naturlig inn i hjemmet – enten den står ved TV-en, på kjøkkenet, i boden eller på hjemmekontoret.
            </p>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(calc(50% - 10px), 260px), 1fr))', gap: 'clamp(12px,1.6vw,20px)' }}>
            {ROOMS.map((room, i) => (
              <motion.div
                key={room.label}
                {...fadeUp(i * 0.05)}
                whileHover="zoom"
                style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(42,36,24,.07)', position: 'relative', aspectRatio: '1', cursor: 'default' }}
              >
                <motion.div
                  variants={{ zoom: { scale: 1.07 } }}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  {room.image ? (
                    <Image
                      src={room.image}
                      alt={room.label}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#ddd6c8' }} />
                  )}
                </motion.div>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1,
                  padding: '40px 16px 16px',
                  background: 'linear-gradient(to top, rgba(26,29,23,0.65) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '13.5px', color: '#fff', letterSpacing: '0.01em' }}>
                    {room.label}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CAPACITY BAND ==================== */}
      <section style={{ background: '#39402c', padding: 'clamp(64px,8vw,104px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.p {...fadeUp()} style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a9c08f', margin: '0 0 40px', textAlign: 'center' }}>
            Kapasitet
          </motion.p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(28px,4vw,48px)' }}>
            {CAPACITY.map((c, i) => (
              <motion.div key={c.unit} {...fadeUp(i * 0.1)} style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(64px,8vw,96px)', lineHeight: 1, color: '#faf6ee', marginBottom: '10px' }}>{c.big}</div>
                <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#faf6ee', marginBottom: '6px' }}>{c.unit}</div>
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', lineHeight: 1.5, color: '#c8d2c3', margin: 0 }}>{c.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== GALLERY CAROUSEL ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', marginBottom: '36px' }}>
          <motion.div {...fadeUp()}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px' }}>Galleri</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.6vw,46px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Sett aBoks fra alle vinkler.
            </h2>
          </motion.div>
          <CarouselArrows
            onPrev={() => prodCarouselRef.current?.scrollPrev()}
            onNext={() => prodCarouselRef.current?.scrollNext()}
          />
        </div>
        <Carousel ref={prodCarouselRef} items={CAROUSEL_ITEMS} aspectRatio="4/3" itemWidth="min(78vw, 460px)" background="#f2e7d7" />
      </section>

      {/* ==================== SAFETY INFO ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0', marginTop: '-100px' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'clamp(40px,6vw,80px)', alignItems: 'center' }}>
            <motion.div {...fadeUp()}>
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>
                Visste du at...?
              </p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: '0 0 24px' }}>
                Sikker oppbevaring starter hjemme.
              </h2>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.4vw,18px)', lineHeight: 1.65, color: '#3a3f33', margin: '0 0 18px' }}>
                Løse brukte batterier kan i enkelte tilfeller kortslutte dersom polene kommer i kontakt med metall.
              </p>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(16px,1.4vw,18px)', lineHeight: 1.65, color: '#3a3f33', margin: 0 }}>
                Med et eget rom for brukte batterier gjør aBoks det enklere å oppbevare dem trygt frem til de leveres til gjenvinning.
              </p>
            </motion.div>
            <motion.div
              {...fadeUp(0.12)}
              style={{ position: 'relative', aspectRatio: '4/3', borderRadius: '22px', overflow: 'hidden', background: '#e8e2d8', boxShadow: '0 8px 32px -10px rgba(42,36,24,.14)' }}
            >
              <Image
                src="https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Sikkerhet.webp"
                alt="Sikker oppbevaring hjemme"
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== LIFESTYLE CAROUSEL ==================== */}
      <section style={{ background: '#f2e7d7', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', marginBottom: '36px' }}>
          <motion.div {...fadeUp()}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px' }}>I naturen</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.6vw,46px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Laget for hverdagen og turen.
            </h2>
          </motion.div>
          <CarouselArrows
            onPrev={() => lifeCarouselRef.current?.scrollPrev()}
            onNext={() => lifeCarouselRef.current?.scrollNext()}
            bg="#faf6ee"
            bgHover="#fff"
            border="#cdbf9f"
          />
        </div>
        <Carousel
          ref={lifeCarouselRef}
          items={LIFESTYLE}
          aspectRatio="1/1"
          itemWidth="min(82vw, 520px)"
          background="#e7d9bd"
          gap={20}
        />
      </section>

      {/* ==================== HOW TO START ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...fadeUp()}>
            <div style={{ borderRadius: '28px', padding: 'clamp(36px,4.5vw,60px)' }}>

              {/* Label */}
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 14px' }}>
                Slik kommer du i gang
              </p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.6vw,46px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: '0 0 16px' }}>
                Klar på få minutter.
              </h2>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', lineHeight: 1.65, color: '#3a3f33', margin: '0 0 clamp(32px,4vw,48px)', maxWidth: '560px' }}>
                Fire enkle steg fra utpakking til gjenvinning. Se hele gjennomgangen av{' '}
                <Link href="/slik-fungerer-det" style={homeTextLink}>slik fungerer aBoks</Link>.
              </p>

              <HowItWorksSteps />

            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== VIDEO ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0', marginTop: '-100px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
          <motion.div {...fadeUp()} style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto 44px' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px' }}>Film</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Se aBoks i bruk.
            </h2>
          </motion.div>
          <motion.div {...fadeUp(0.1)} style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 24px 56px -20px rgba(42,36,24,.3)' }}>
            <video
              ref={mainVideoRef}
              muted
              loop
              playsInline
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
            />
          </motion.div>
        </div>
      </section>

      {/* ==================== STORY ==================== */}
      <section id="historien" style={{ background: '#f2e7d7', padding: 'clamp(72px,9vw,120px) 0', scrollMarginTop: '80px' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...fadeUp()} style={{ maxWidth: '680px', marginBottom: 'clamp(40px,5vw,64px)' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>Historien</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Fra første prototype til ferdig produkt.
            </h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(20px,2.4vw,28px)' }}>
            {[
              { n: '01', title: 'Skissen', desc: 'Den første idéen, tegnet på et kjøkkenbord.', img: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Skissen-1.webp' },
              { n: '02', title: 'Prototypen', desc: 'Vår første 3D-printede modell med tre rom.', img: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Prototypen.webp' },
              { n: '03', title: 'Testingen', desc: 'Over 40 husstander testet aBoks i hverdagen.', img: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-Testingen.webp' },
              { n: '04', title: 'Produktet', desc: 'Ferdig produkt i tre farger, klart for ditt hjem.', img: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks.webp' },
            ].map((step, i) => (
              <motion.div key={step.n} {...fadeUp(i * 0.08)} className="flex flex-col-reverse md:flex-col" style={{ transform: 'translateY(-20px)', gap: '18px' }}>
                <div style={{ aspectRatio: '4/3', borderRadius: '18px', overflow: 'hidden', background: '#e7d9bd', border: step.img ? 'none' : '1px dashed #cdbf9f', position: 'relative' }}>
                  {step.img ? (
                    <Image src={step.img} alt={step.title} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 25vw" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a99a76', fontFamily: 'var(--font-manrope)', fontSize: '12px', letterSpacing: '0.04em', textAlign: 'center', padding: '16px' }}>
                      Bildeplass
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: '22px', color: '#c9a76a', marginBottom: '6px', lineHeight: 1 }}>{step.n}</div>
                  <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17', margin: '0 0 8px' }}>{step.title}</h3>
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.55, color: '#6b6f63', margin: 0 }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIALS ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...fadeUp()} style={{ maxWidth: '640px', marginBottom: 'clamp(40px,5vw,60px)' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>Tidlige testere</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Hva de første brukerne sier.
            </h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(20px,2.4vw,28px)' }}>
            {TESTIMONIALS.map((t, i) => (
              <motion.figure
                key={t.name}
                {...fadeUp(i * 0.1)}
                style={{ background: '#fff', borderRadius: '22px', padding: '36px 32px', boxShadow: '0 2px 6px rgba(42,36,24,.05)', margin: 0, display: 'flex', flexDirection: 'column', gap: '22px' }}
              >
                <div style={{ color: '#c9a76a', fontSize: '16px', letterSpacing: '3px' }}>★★★★★</div>
                <blockquote style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontWeight: 500, fontSize: '23px', lineHeight: 1.35, color: '#1a1d17', margin: 0 }}>
                  {t.quote}
                </blockquote>
                <figcaption style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', fontWeight: 600, color: '#6b6f63', marginTop: 'auto' }}>
                  {t.name}
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== FAQ ==================== */}
      <section id="faq" style={{ background: '#f2e7d7', padding: 'clamp(72px,9vw,120px) 0', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '840px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
          <motion.div {...fadeUp()} style={{ textAlign: 'center', marginBottom: 'clamp(36px,4vw,56px)' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>Vanlige spørsmål</p>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
              Ofte stilte spørsmål
            </h2>
          </motion.div>
          <Accordion items={FAQS} defaultOpen="f1" borderColor="#ddd2bb" />
          <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', lineHeight: 1.7, color: '#3a3f33', margin: '28px 0 0', textAlign: 'center' }}>
            Se alle <Link href="/vanlige-sporsmal" style={homeTextLink}>vanlige spørsmål om aBoks</Link>, finn tips og guider under{' '}
            <Link href="/inspirasjon" style={homeTextLink}>Inspirasjon</Link> – eller{' '}
            <Link href="/kontakt" style={homeTextLink}>kontakt oss</Link>.
          </p>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div
            {...fadeUp()}
            style={{
              position: 'relative',
              borderRadius: '28px',
              overflow: 'hidden',
              background: '#39402c',
              padding: 'clamp(48px,7vw,88px) clamp(28px,5vw,72px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '40px',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(34px,4.4vw,58px)', letterSpacing: '-0.02em', lineHeight: 1.05, color: '#faf6ee', margin: '0 0 18px' }}>
                Klar for orden i batteriene?
              </h2>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '18px', lineHeight: 1.6, color: '#c8d2c3', margin: '0 0 32px', maxWidth: '440px' }}>
                Tre farger. Tre rom. Én smart boks. Få full oversikt fra dag én.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                <Link
                  href={`/produkter/aboks?variant=${activeColor.sku}`}
                  data-btn
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '17px 36px',
                    borderRadius: '999px',
                    background: '#faf6ee',
                    color: '#1a1d17',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 700,
                    fontSize: '15px',
                    textDecoration: 'none',
                    transition: 'transform 0.15s ease, filter 0.15s ease',
                  }}
                >
                  Bestill nå · {formatPrice(effectivePrice)}
                </Link>
                <Link
                  href="/produkter"
                  data-btn
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '17px 36px',
                    borderRadius: '999px',
                    border: '1.5px solid rgba(250,246,238,0.45)',
                    color: '#faf6ee',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    fontSize: '15px',
                    textDecoration: 'none',
                    transition: 'transform 0.15s ease, filter 0.15s ease',
                  }}
                >
                  Se alle produkter
                </Link>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#a9c08f' }}>
                  Fri frakt over kr 650
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColorId(c.id)}
                  aria-label={c.name}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '999px',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    background: c.swatch,
                    boxShadow:
                      colorId === c.id
                        ? '0 0 0 2px #faf6ee, 0 0 0 4px #39402c'
                        : '0 0 0 1px rgba(0,0,0,.18)',
                    transition: 'transform 0.15s ease, filter 0.15s ease, box-shadow 0.2s ease',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}

function HeroContent({
  colorId,
  setColorId,
  sale,
  onExpire,
}: {
  colorId: string
  setColorId: (id: string) => void
  sale: SaleInfo | null
  onExpire: () => void
}) {
  const COLORS = [
    { id: 'olive', name: 'Olivengrønn', swatch: '#5b6347', sku: 'ABOKS-OLIVE-001' },
    { id: 'blue',  name: 'Mørk blå',    swatch: '#243153', sku: 'ABOKS-BLUE-001'  },
    { id: 'black', name: 'Sort',         swatch: '#1d1d1f', sku: 'ABOKS-SORT-001'  },
    { id: 'cream', name: 'Creme',        swatch: '#FAF7F2', sku: 'ABOKS-CREME-001' },
  ]
  const activeColor = COLORS.find((c) => c.id === colorId) ?? COLORS[0]

  return (
    <>
      <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 22px', textAlign: 'center' }}>
        Smart batteriorganisering
      </p>
      <h1 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 700, fontSize: 'clamp(30px,3.1vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.08, color: '#1a1d17', margin: '0 0 24px', textAlign: 'center' }}>
        Samle batteriene på{' '}
        <em style={{ fontStyle: 'italic', color: '#39402c' }}>ett</em> sted.
      </h1>
      <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 400, fontSize: 'clamp(16px,1.3vw,18px)', lineHeight: 1.62, color: '#3a3f33', margin: '0 0 36px', textAlign: 'center' }}>
        aBoks organiserer nye, brukte, AA- og AAA-batterier i én smart boks.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '20px', justifyContent: 'center' }}>
        <Link
          href={`/produkter/aboks?variant=${activeColor.sku}`}
          data-btn
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '9px',
            padding: '17px 36px',
            borderRadius: '999px',
            background: '#39402c',
            color: '#faf6ee',
            fontFamily: 'var(--font-manrope)',
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '0.01em',
            textDecoration: 'none',
            transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
          }}
        >
          Bestill nå
        </Link>
        <Link
          href={`/produkter/aboks?variant=${activeColor.sku}`}
          data-btn
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '9px',
            padding: '17px 32px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,.5)',
            color: '#1a1d17',
            fontFamily: 'var(--font-manrope)',
            fontWeight: 600,
            fontSize: '15px',
            letterSpacing: '0.01em',
            border: '1.5px solid rgba(26,29,23,.22)',
            textDecoration: 'none',
            transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease, border-color 0.2s ease',
          }}
        >
          Se produktet
        </Link>
      </div>
      {sale?.saleStartDate && sale?.saleEndDate && (
        <div style={{ width: '100%', marginBottom: '20px' }}>
          <SaleCountdown
            startDate={sale.saleStartDate}
            endDate={sale.saleEndDate}
            onExpire={onExpire}
          />
        </div>
      )}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5e6a48' }}>
            Velg din farge
          </span>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', fontWeight: 600, color: '#1a1d17' }}>
            {activeColor.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'center' }}>
          {COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColorId(c.id)}
              aria-label={c.name}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                background: c.swatch,
                boxShadow:
                  colorId === c.id
                    ? '0 0 0 2px #faf6ee, 0 0 0 4px #39402c'
                    : '0 0 0 1px rgba(0,0,0,.18)',
                transition: 'transform 0.15s ease, filter 0.15s ease, box-shadow 0.2s ease',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
