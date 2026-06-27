'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/store/cart'
import CartToast from '@/components/CartToast'
import Accordion from '@/components/Accordion'
import VideoPlaceholder from '@/components/VideoPlaceholder'
import ProductImageCarousel, {
  type ProductImageCarouselHandle,
} from '@/components/ProductImageCarousel'
import ImageLightbox from '@/components/ImageLightbox'
import { formatPrice } from '@/lib/format'
import { trackViewItem, trackAddToCart } from '@/lib/analytics'
import { getEffectivePrice, isSaleActive, type SaleInfo } from '@/lib/pricing'

interface Variant {
  id: string
  name: string
  colorHex: string
  image: string
  sku: string
  inventory: number
  sortOrder: number
}

interface Feature {
  id: string
  number: string
  title: string
  description: string
}

interface Capacity {
  aa: number
  aaa: number
  usedCompartments: number
}

interface Product {
  id: string
  title: string
  slug: string
  tagline: string
  description: string
  price: number
  images: { src: string; alt: string }[]
  features: Feature[]
  capacity: Capacity
  sale?: SaleInfo | null
}

interface Props {
  product: Product
  variants: Variant[]
  initialSku?: string
}


const TRUST = [
  'Fri frakt over kr 650',
  '100 dagers åpent kjøp',
  'Sendes innen 1–2 virkedager',
]

const FUTURE = [
  { name: 'aBoks Mini',        desc: 'Kompakt utgave laget for skuffen.',              image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aaBoks-blue.webp' },
  { name: 'aBoks Huset – Gul', desc: 'Har du et gult hus? Da er dette noe for deg.',    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-gul-house.webp' },
  { name: 'aBoks Huset – Rød', desc: 'Perfekt til det røde huset.',                    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-red-house.webp' },
]

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65
}

export default function ProductClient({ product, variants, initialSku }: Props) {
  const initialVariant = initialSku
    ? (variants.find((v) => v.sku === initialSku) ?? variants[0])
    : variants[0]

  const initialThumbImages = [
    ...variants.map((v) => ({ src: v.image, alt: v.name })),
    ...product.images,
  ].filter((t) => t.src)

  const initialImageIdx = initialVariant?.image
    ? Math.max(0, initialThumbImages.findIndex((t) => t.src === initialVariant.image))
    : 0

  const [selectedVariantId, setSelectedVariantId] = useState(initialVariant?.id ?? variants[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [activeImageIdx, setActiveImageIdx] = useState(initialImageIdx)
  const [toastVisible, setToastVisible] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const carouselRef = useRef<ProductImageCarouselHandle>(null)

  useEffect(() => {
    if (initialImageIdx > 0) {
      carouselRef.current?.goTo(initialImageIdx)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 1100)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]
  const effectivePrice = getEffectivePrice(product.price, product.sale)
  const saleActive = isSaleActive(product.price, product.sale)

  // Capacity-derived content — keeps AAA references correct per product
  const hasAAA = product.capacity.aaa > 0

  const capacityItems = [
    product.capacity.aa > 0
      ? { big: String(product.capacity.aa), unit: 'AA-batterier', note: 'Eget rom for nye AA.' }
      : null,
    product.capacity.aaa > 0
      ? { big: String(product.capacity.aaa), unit: 'AAA-batterier', note: 'Eget rom for nye AAA.' }
      : null,
    product.capacity.usedCompartments > 0
      ? {
          big: String(product.capacity.usedCompartments),
          unit: 'rom for brukte',
          note: hasAAA ? 'Samle dem til gjenvinning.' : 'Samle brukte batterier til gjenvinning.',
        }
      : null,
  ].filter((c): c is { big: string; unit: string; note: string } => c !== null)

  const capacityBandEyebrow = hasAAA ? 'Tre rom, full kapasitet' : 'To rom, kompakt design'
  const capacityBandHeading = hasAAA ? 'Plass til alt – hver for seg.' : 'Plass til AA – og brukte batterier.'

  const DETAILS = [
    {
      id: 'd1',
      question: 'Beskrivelse',
      answer: hasAAA
        ? `${product.title} holder nye og brukte batterier samlet i én elegant boks med tre adskilte rom. Slutt på løse batterier i skuffen – du har alltid oversikt.`
        : `${product.title} holder nye og brukte batterier samlet i én kompakt boks med to adskilte rom. Slutt på løse batterier i skuffen – du har alltid oversikt.`,
    },
    {
      id: 'd2',
      question: 'Spesifikasjoner',
      answer: hasAAA
        ? 'Mål: 16 × 14 × 6 cm. Tre rom: AA, AAA og brukte. Matt finish. Fås i olivengrønn, mørk blå og sort.'
        : 'Kompakt design. To rom: AA og brukte. Matt finish.',
    },
    { id: 'd3', question: 'Frakt og retur', answer: 'Fri frakt over kr 650. Sendes innen 1–2 virkedager. 100 dagers åpent kjøp.' },
  ]

  const FAQS = [
    {
      id: 'f1',
      question: 'Hvilke batterier passer i aBoks?',
      answer: hasAAA
        ? 'aBoks har egne rom for AA- og AAA-batterier, pluss et eget rom for brukte batterier som skal leveres til gjenvinning.'
        : `${product.title} har egne rom for AA-batterier, pluss et eget rom for brukte batterier som skal leveres til gjenvinning.`,
    },
    {
      id: 'f2',
      question: 'Hvor mange batterier får jeg plass til?',
      answer: hasAAA
        ? `Du får plass til ${product.capacity.aa} AA-batterier og ${product.capacity.aaa} AAA-batterier, i tillegg til et romslig rom for brukte batterier.`
        : `Du får plass til ${product.capacity.aa} AA-batterier, i tillegg til et romslig rom for brukte batterier.`,
    },
    { id: 'f3', question: 'Hvilket materiale er aBoks laget av?', answer: 'aBoks er laget av et solid, matt materiale som tåler daglig bruk og er enkelt å holde rent.' },
    { id: 'f4', question: 'Kan jeg henge aBoks på veggen?', answer: 'aBoks er designet for å stå støtt på benken eller i skuffen. En veggmontert løsning er på vei.' },
    { id: 'f5', question: 'Hva er leverings- og returvilkårene?', answer: 'Vi sender innen 1–2 virkedager, tilbyr fri frakt over kr 650 og 100 dagers åpent kjøp.' },
  ]

  // view_item: fires on initial mount and whenever the selected variant changes
  useEffect(() => {
    if (!selectedVariant) return
    trackViewItem({
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      productTitle: product.title,
      price: effectivePrice,
    })
  }, [selectedVariantId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        price: effectivePrice,
      },
      qty,
    )
    // add_to_cart: fires after item is added to cart
    trackAddToCart({
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      productTitle: product.title,
      price: effectivePrice,
      quantity: qty,
    })
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
                onZoom={setLightboxIndex}
              />
            </div>

            {/* INFO BOTTOM: price + colors + cart + trust + accordion
                Mobile: third (order-3); Desktop: right col, row 2 */}
            <div className="order-3 md:col-start-2 md:row-start-2">
              {/* Stars + price */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', flexWrap: 'wrap' }}>
                {saleActive ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '26px', color: '#b06a4a' }}>
                      {formatPrice(effectivePrice)}
                    </span>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', color: '#9a9488', textDecoration: 'line-through' }}>
                      {formatPrice(product.price)}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '26px', color: '#1a1d17' }}>
                    {formatPrice(product.price)}
                  </span>
                )}
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

              {/* Lagerstatus — lest fra selectedVariant.inventory (state, ikke URL) */}
              {selectedVariant && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  {selectedVariant.inventory > 10 ? (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5f8253', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#3a3f33' }}>På lager</span>
                    </>
                  ) : selectedVariant.inventory > 0 ? (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5f8253', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#3a3f33' }}>På lager: {selectedVariant.inventory} stk.</span>
                    </>
                  ) : (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b06a4a', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6057' }}>Utsolgt</span>
                    </>
                  )}
                </div>
              )}

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
                  disabled={!selectedVariant || selectedVariant.inventory === 0}
                  style={{
                    flex: 1, minWidth: '200px', display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: '10px', padding: '17px 32px', borderRadius: '999px',
                    background: selectedVariant?.inventory === 0 ? '#c8c0b0' : '#39402c',
                    color: '#faf6ee', fontFamily: 'var(--font-manrope)',
                    fontWeight: 600, fontSize: '15px', border: 'none',
                    cursor: selectedVariant?.inventory === 0 ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedVariant?.inventory !== 0)
                      (e.currentTarget as HTMLButtonElement).style.background = '#2a3020'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      selectedVariant?.inventory === 0 ? '#c8c0b0' : '#39402c'
                  }}
                >
                  {selectedVariant?.inventory === 0 ? 'Utsolgt' : 'Legg i handlekurv'}
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
                {capacityBandEyebrow}
              </p>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#faf6ee', margin: 0 }}>
                {capacityBandHeading}
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(28px,4vw,48px)' }}>
              {capacityItems.map((c) => (
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

        {/* FEATURES */}
        {product.features.length > 0 && (
          <section style={{ background: '#faf6ee', padding: 'clamp(64px,8vw,104px) 0' }}>
            <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

              {/* Section header */}
              <div style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto clamp(44px,6vw,68px)' }}>
                <p style={{
                  fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px',
                  letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px',
                }}>
                  Hvorfor aBoks
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-cormorant)', fontWeight: 500,
                  fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07,
                  color: '#1a1d17', margin: '0 0 18px',
                }}>
                  Derfor velger kunder aBoks
                </h2>
                <p style={{
                  fontFamily: 'var(--font-manrope)', fontSize: '16px', lineHeight: 1.65,
                  color: '#6b6f63', margin: 0,
                }}>
                  Små detaljer som gjør hverdagen enklere.
                </p>
              </div>

              {/* Feature cards — 1 col mobile, 3 col desktop */}
              <div
                className="grid grid-cols-1 md:grid-cols-3"
                style={{ gap: 'clamp(16px,2vw,24px)' }}
              >
                {product.features.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      background: '#fff',
                      borderRadius: '20px',
                      border: '1px solid #e7e2d4',
                      padding: 'clamp(26px,3vw,40px)',
                      boxShadow: '0 2px 12px rgba(42,36,24,.05)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Number */}
                    <span style={{
                      fontFamily: 'var(--font-cormorant)', fontWeight: 400,
                      fontSize: '28px', lineHeight: 1, letterSpacing: '-0.01em',
                      color: '#c9a76a', marginBottom: '20px', display: 'block',
                    }}>
                      {f.number}
                    </span>

                    {/* Title */}
                    <h3 style={{
                      fontFamily: 'var(--font-manrope)', fontWeight: 700,
                      fontSize: 'clamp(17px,1.4vw,20px)', lineHeight: 1.25,
                      color: '#1a1d17', margin: '0 0 14px',
                    }}>
                      {f.title}
                    </h3>

                    {/* Description */}
                    <p style={{
                      fontFamily: 'var(--font-manrope)', fontSize: '15px',
                      lineHeight: 1.7, color: '#6b6f63', margin: 0,
                      flexGrow: 1,
                    }}>
                      {f.description}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          </section>
        )}

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
                  {p.image && (
                    <div style={{ aspectRatio: '4/3', background: '#efe6d3', borderBottom: '1px dashed #cdbf9f', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  )}
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

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox
            images={thumbImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </AnimatePresence>

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
            {saleActive ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#b06a4a' }}>
                  {formatPrice(effectivePrice * qty)}
                </span>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#9a9488', textDecoration: 'line-through' }}>
                  {formatPrice(product.price * qty)}
                </span>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17' }}>
                {formatPrice(product.price * qty)}
              </div>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant || selectedVariant.inventory === 0}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '15px',
              borderRadius: '999px',
              background: selectedVariant?.inventory === 0 ? '#c8c0b0' : '#39402c',
              color: '#faf6ee',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              cursor: selectedVariant?.inventory === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {selectedVariant?.inventory === 0 ? 'Utsolgt' : 'Legg i handlekurv'}
          </button>
        </div>
      )}
    </>
  )
}
