'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import CartToast from '@/components/CartToast'
import Accordion from '@/components/Accordion'
import VideoPlaceholder from '@/components/VideoPlaceholder'
import ProductImageCarousel, {
  type ProductImageCarouselHandle,
} from '@/components/ProductImageCarousel'
import { formatPrice } from '@/lib/format'

interface Variant {
  id: string
  name: string
  colorHex: string
  image: string
  sku: string
  inventory: number
  sortOrder: number
}

interface Product {
  id: string
  title: string
  slug: string
  tagline: string
  description: string
  price: number
  images: { src: string; alt: string }[]
}

interface Props {
  product: Product
  variants: Variant[]
}

const CAPACITY = [
  { big: '20', unit: 'AA-batterier', note: 'Eget rom for nye AA.' },
  { big: '36', unit: 'AAA-batterier', note: 'Eget rom for nye AAA.' },
  { big: '1', unit: 'rom for brukte', note: 'Samle dem til gjenvinning.' },
]

const FAQS = [
  { id: 'f1', question: 'Hvilke batterier passer i aBoks?', answer: 'aBoks har egne rom for AA- og AAA-batterier, pluss et eget rom for brukte batterier som skal leveres til gjenvinning.' },
  { id: 'f2', question: 'Hvor mange batterier får jeg plass til?', answer: 'Du får plass til 20 AA-batterier og 36 AAA-batterier, i tillegg til et romslig rom for brukte batterier.' },
  { id: 'f3', question: 'Hvilket materiale er aBoks laget av?', answer: 'aBoks er laget av et solid, matt materiale som tåler daglig bruk og er enkelt å holde rent.' },
  { id: 'f4', question: 'Kan jeg henge aBoks på veggen?', answer: 'aBoks er designet for å stå støtt på benken eller i skuffen. En veggmontert løsning er på vei.' },
  { id: 'f5', question: 'Hva er leverings- og returvilkårene?', answer: 'Vi sender innen 1–2 virkedager, tilbyr fri frakt over kr 650 og 100 dagers åpent kjøp.' },
]

const DETAILS = [
  { id: 'd1', question: 'Beskrivelse', answer: 'aBoks holder nye og brukte batterier samlet i én elegant boks med tre adskilte rom. Slutt på løse batterier i skuffen – du har alltid oversikt.' },
  { id: 'd2', question: 'Spesifikasjoner', answer: 'Mål: 16 × 14 × 6 cm. Tre rom: AA, AAA og brukte. Matt finish. Fås i olivengrønn, mørk blå og sort.' },
  { id: 'd3', question: 'Frakt og retur', answer: 'Fri frakt over kr 650. Sendes innen 1–2 virkedager. 100 dagers åpent kjøp.' },
]

const TRUST = [
  'Fri frakt over kr 650',
  '100 dagers åpent kjøp',
  'Sendes innen 1–2 virkedager',
]

const FUTURE = [
  { name: 'aBoks Mini', desc: 'Kompakt utgave laget for skuffen.' },
  { name: 'aBoks Wall', desc: 'Veggmontert oppbevaring for garasjen.' },
  { name: 'aBoks Pro', desc: 'Større kapasitet for verkstedet.' },
]

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65
}

export default function ProductClient({ product, variants }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [toastVisible, setToastVisible] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const carouselRef = useRef<ProductImageCarouselHandle>(null)

  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 1100)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]

  const thumbImages = [
    ...variants.map((v) => ({ src: v.image, alt: v.name })),
    ...product.images,
  ].filter((t) => t.src)

  const displayImage = thumbImages[activeImageIdx]?.src ?? thumbImages[0]?.src ?? ''

  const handleAddToCart = () => {
    if (!selectedVariant) return
    addItem(
      {
        variantId: selectedVariant.id,
        productSlug: product.slug,
        colorName: selectedVariant.name,
        colorHex: selectedVariant.colorHex,
        colorImage: selectedVariant.image,
        price: product.price,
      },
      qty,
    )
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 1700)
  }

  const handleColorSelect = (variantId: string) => {
    setSelectedVariantId(variantId)
    const variant = variants.find((v) => v.id === variantId)
    if (variant?.image) {
      const idx = thumbImages.findIndex((t) => t.src === variant.image)
      if (idx >= 0) {
        setActiveImageIdx(idx)
        carouselRef.current?.goTo(idx)
      }
    }
  }

  return (
    <>
      <CartToast visible={toastVisible} />

      <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee' }}>
        {/* Breadcrumb */}
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)] pt-[18px]">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63' }}>
            <Link href="/" style={{ color: '#6b6f63', textDecoration: 'none' }}>Hjem</Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: '#1a1d17', fontWeight: 600 }}>{product.title}</span>
          </div>
        </div>

        {/* BUY SECTION
            Mobile order: title+desc → gallery → price+colors+cart
            Desktop: 2-col grid — gallery left (spans 2 rows), info right
        */}
        <section style={{ padding: 'clamp(28px,4vw,48px) 0 clamp(60px,8vw,96px)' }}>
          <div
            className="max-w-container mx-auto px-[clamp(20px,5vw,48px)] flex flex-col md:grid md:grid-cols-2 md:items-start"
            style={{ columnGap: 'clamp(36px,5vw,72px)', rowGap: 'clamp(24px,3vw,36px)' }}
          >
            {/* INFO TOP: title + tagline + description
                Mobile: first (order-1); Desktop: right col, row 1 */}
            <div className="order-1 md:col-start-2 md:row-start-1">
              <h1 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(40px,5vw,64px)', letterSpacing: '-0.022em', lineHeight: 1.02, color: '#1a1d17', margin: '0 0 8px' }}>
                {product.title}
              </h1>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', color: '#6b6f63', margin: '0 0 20px' }}>
                {product.tagline}
              </p>
              <p className="hidden md:block" style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', lineHeight: 1.6, color: '#3a3f33', margin: 0 }}>
                {product.description}
              </p>
            </div>

            {/* GALLERY
                Mobile: second (order-2); Desktop: left col, spans both rows */}
            <div className="order-2 md:col-start-1 md:row-start-1 md:row-span-2">
              <ProductImageCarousel
                ref={carouselRef}
                images={thumbImages}
                initialIndex={0}
                onIndexChange={setActiveImageIdx}
              />
            </div>

            {/* INFO BOTTOM: price + colors + cart + trust + accordion
                Mobile: third (order-3); Desktop: right col, row 2 */}
            <div className="order-3 md:col-start-2 md:row-start-2">
              {/* Stars + price */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '26px', color: '#1a1d17' }}>
                  {formatPrice(product.price)}
                </span>
                <span style={{ color: '#c9a76a', fontSize: '14px', letterSpacing: '2px' }}>★★★★★</span>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63' }}>128 anmeldelser</span>
              </div>

              {/* Color selector */}
              <div style={{ marginBottom: '26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', color: '#1a1d17' }}>Farge:</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6f63' }}>{selectedVariant?.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  {variants.map((v) => {
                    const light = isLightColor(v.colorHex)
                    return (
                      <button
                        key={v.id}
                        onClick={() => handleColorSelect(v.id)}
                        aria-label={v.name}
                        style={{
                          width: '44px', height: '44px', borderRadius: '999px', border: 'none',
                          cursor: 'pointer', padding: 0, background: v.colorHex,
                          boxShadow: selectedVariantId === v.id
                            ? `0 0 0 2px #faf6ee, 0 0 0 4px #39402c${light ? ', inset 0 0 0 1px #c0bdb5' : ''}`
                            : light ? '0 0 0 1.5px #b0ada5' : '0 0 0 1px rgba(0,0,0,.18)',
                          transition: 'transform 0.15s ease, filter 0.15s ease, box-shadow 0.2s ease',
                        }}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Qty + Add to cart */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #d6cfbd', borderRadius: '999px', overflow: 'hidden', background: '#fff' }}>
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Færre"
                    style={{ width: '48px', height: '50px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#1a1d17', lineHeight: 1 }}>
                    −
                  </button>
                  <span style={{ minWidth: '42px', textAlign: 'center', fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '16px', color: '#1a1d17' }}>
                    {qty}
                  </span>
                  <button onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Flere"
                    style={{ width: '48px', height: '50px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#1a1d17', lineHeight: 1 }}>
                    +
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  style={{
                    flex: 1, minWidth: '200px', display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: '10px', padding: '17px 32px', borderRadius: '999px',
                    background: '#39402c', color: '#faf6ee', fontFamily: 'var(--font-manrope)',
                    fontWeight: 600, fontSize: '15px', border: 'none', cursor: 'pointer', transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2a3020' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#39402c' }}
                >
                  Legg i handlekurv
                </button>
              </div>

              {/* Description — mobile only (hidden on desktop, shown in order-1 there) */}
              <p className="md:hidden" style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', lineHeight: 1.6, color: '#3a3f33', margin: '0 0 24px' }}>
                {product.description}
              </p>

              {/* Trust signals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px 0', borderTop: '1px solid #e7e2d4', borderBottom: '1px solid #e7e2d4', marginBottom: '30px' }}>
                {TRUST.map((t) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5f8253" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#3a3f33' }}>{t}</span>
                  </div>
                ))}
              </div>

              {/* Details accordion */}
              <Accordion items={DETAILS} borderColor="#e7e2d4" />
            </div>
          </div>
        </section>

        {/* CAPACITY BAND */}
        <section style={{ background: '#39402c', padding: 'clamp(64px,8vw,104px) 0' }}>
          <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
            <div style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto 56px' }}>
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a9c08f', margin: '0 0 16px' }}>
                Tre rom, full kapasitet
              </p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#faf6ee', margin: 0 }}>
                Plass til alt – hver for seg.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(28px,4vw,48px)' }}>
              {CAPACITY.map((c) => (
                <div key={c.unit} style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(60px,7vw,88px)', lineHeight: 1, color: '#faf6ee', marginBottom: '10px' }}>{c.big}</div>
                  <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '16px', color: '#faf6ee', marginBottom: '6px' }}>{c.unit}</div>
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', lineHeight: 1.5, color: '#c8d2c3', margin: 0 }}>{c.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VIDEO */}
        <section style={{ background: '#faf6ee', padding: 'clamp(64px,8vw,104px) 0' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
            <VideoPlaceholder thumbnail={displayImage || undefined} label="Produktvideo" />
          </div>
        </section>

        {/* PRODUCT FAQ */}
        <section style={{ background: '#f2e7d7', padding: 'clamp(64px,8vw,104px) 0' }}>
          <div style={{ maxWidth: '840px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,4vw,48px)' }}>
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px' }}>Vanlige spørsmål</p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,46px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
                Ofte stilte spørsmål
              </h2>
            </div>
            <Accordion items={FAQS} defaultOpen="f1" borderColor="#ddd2bb" />
          </div>
        </section>

        {/* FUTURE PRODUCTS */}
        <section style={{ background: '#faf6ee', padding: 'clamp(64px,8vw,104px) 0 clamp(96px,11vw,140px)' }}>
          <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
            <div style={{ maxWidth: '600px', marginBottom: 'clamp(36px,4vw,52px)' }}>
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px' }}>Snart fra aBoks</p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,46px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
                Mer orden er på vei.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'clamp(20px,2.4vw,28px)' }}>
              {FUTURE.map((p) => (
                <div key={p.name} style={{ background: '#fff', borderRadius: '22px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(42,36,24,.05)' }}>
                  <div style={{ aspectRatio: '4/3', background: '#efe6d3', borderBottom: '1px dashed #cdbf9f', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '14px', left: '14px', fontFamily: 'var(--font-manrope)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#39402c', background: '#e6ecdf', padding: '6px 12px', borderRadius: '999px' }}>
                      Kommer snart
                    </span>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', letterSpacing: '0.04em', color: '#a99a76' }}>Bildeplass</span>
                  </div>
                  <div style={{ padding: '24px 26px 28px' }}>
                    <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '19px', color: '#1a1d17', margin: '0 0 8px' }}>{p.name}</h3>
                    <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.55, color: '#6b6f63', margin: 0 }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* MOBILE STICKY BUY BUTTON */}
      {isNarrow && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 150,
            background: 'rgba(250,246,238,.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid #e7e2d4',
            padding: '12px clamp(16px,4vw,24px)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 -8px 24px -12px rgba(42,36,24,.18)',
          }}
        >
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontFamily: 'var(--font-manrope)', fontSize: '11px', color: '#6b6f63' }}>
              aBoks · {selectedVariant?.name}
            </div>
            <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17' }}>
              {formatPrice(product.price * qty)}
            </div>
          </div>
          <button
            onClick={handleAddToCart}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '15px',
              borderRadius: '999px',
              background: '#39402c',
              color: '#faf6ee',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Legg i handlekurv
          </button>
        </div>
      )}
    </>
  )
}
