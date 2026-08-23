'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/store/cart'
import Accordion from '@/components/Accordion'
import VideoPlaceholder from '@/components/VideoPlaceholder'
import ClickToPlayVideo from '@/components/ClickToPlayVideo'
import ProductImageCarousel, {
  type ProductImageCarouselHandle,
} from '@/components/ProductImageCarousel'
import ImageLightbox from '@/components/ImageLightbox'
import Breadcrumbs, { type Crumb } from '@/components/Breadcrumbs'
import ProductSupportTrust from '@/components/ProductSupportTrust'
import { formatPrice } from '@/lib/format'
import { trackViewItem, trackAddToCart } from '@/lib/analytics'
import { getEffectivePrice, isSaleActive, type SaleInfo } from '@/lib/pricing'
import { availableStock, isSoldOut } from '@/lib/stock'
import { cartLineRef } from '@/store/cart'
import SaleCountdown from '@/components/SaleCountdown'
import Stars from '@/components/reviews/Stars'

interface Variant {
  id: string
  name: string
  colorHex: string
  image: string
  sku: string
  inventory: number
  sortOrder: number
  videoUrl: string | null
  /**
   * Still shown before the film starts, resolved on the server: the uploaded
   * `-poster.webp` where one exists, this variant's own image where it doesn't.
   */
  videoPoster: string | null
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

interface DetailItem {
  id: string
  title: string
  content: string
}

interface FaqItem {
  id: string
  question: string
  answer: string
}

interface Product {
  id: string
  title: string
  slug: string
  tagline: string
  description: string
  price: number
  /**
   * Which catalogue the product belongs to, straight from the CMS `section` select.
   *
   * 'accessories' is the stored value behind the «Tilbehør» label — see the Products
   * collection. It is the real field rather than a slug or a hand-kept list, so every
   * accessory published from now on is covered without another code change.
   */
  section: 'products' | 'accessories'
  /**
   * The product's own stock. Meaningful only when `variants` is empty — a product WITH
   * variants is sold from each variant's `inventory` and this is never read for it. The rule
   * lives in @/lib/stock; this page asks it rather than restating it.
   */
  stock: number
  images: { src: string; alt: string }[]
  features: Feature[]
  capacity: Capacity
  details: DetailItem[]
  faqs: FaqItem[]
  sale?: SaleInfo | null
}

interface Props {
  product: Product
  variants: Variant[]
  initialSku?: string
  breadcrumbs: Crumb[]
  /** Real approved-review summary for this product. Absent/zero → no rating is shown. */
  reviewSummary?: { count: number; average: number }
  /**
   * Rendered straight after the "Hvorfor aBoks" features. Passed in from the server page as
   * an already-rendered node so it stays a server component and ships no client JavaScript;
   * omitted for products whose material is not confirmed (see lib/materialStory).
   */
  materialStory?: React.ReactNode
}


/** True of anything we sell: shipping, returns, dispatch. Shown on every product page. */
const TRUST_UNIVERSAL = [
  'Fast frakt 69 kr (fri frakt over kr 650)',
  '100 dagers åpent kjøp',
  'Sendes fra Norge innen 1–3 virkedager',
]

/**
 * True only of an aBoks we make ourselves. A third-party accessory — a pack of batteries —
 * is neither printed in Norway from PLA Matte nor positioned as a gift, so claiming either
 * on its page would simply be false.
 */
const TRUST_ABOKS_ONLY = [
  'Laget i Norge av biobasert PLA Matte',
  'En perfekt gave til noen du er glad i',
]

/** The full list, in its original order — unchanged for every product in Produkter. */
const TRUST = [...TRUST_UNIVERSAL, ...TRUST_ABOKS_ONLY]

/**
 * The heading above the feature cards. The cards themselves are CMS content and are never
 * touched; only the section's own framing changes, because "Hvorfor aBoks" cannot introduce
 * a product that is not an aBoks.
 */
const FEATURE_SECTION_COPY = {
  products: {
    // Rendered uppercase by CSS, so this reads "HVORFOR ABOKS" on screen.
    eyebrow: 'Hvorfor aBoks',
    heading: 'Derfor velger kunder aBoks',
    subheading: 'Små detaljer som gjør hverdagen enklere.',
  },
  accessories: {
    // Reads "EGENSKAPER" on screen — the eyebrow labels the section rather than repeating
    // the heading directly beneath it.
    eyebrow: 'Egenskaper',
    heading: 'Produktfordeler',
    subheading: 'Egenskaper og fordeler ved produktet.',
  },
} as const

/** `href` is null for products that have no page yet — those images stay non-clickable. */
const FUTURE: { name: string; desc: string; image: string; href: string | null }[] = [
  { name: 'aBoks Spesial',     desc: 'Veggmontert beholder for trygg innsamling av brukte batterier. Utviklet for bedrifter og steder der batterier skiftes ofte.', image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-special-4x3.webp', href: null },
  { name: 'aBoks Office',      desc: 'Smart skrivebordsorganisering for kontor og hjemmekontor. Samler batterier, telefon, penner og småting på ett sted.', image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-office-4x3.webp', href: null },
  { name: 'aBoks Vegg',        desc: 'Snart tilgjengelig. Veggmontert oppbevaring som frigjør plass og holder batteriene lett tilgjengelige.', image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-vegg-kommer-snart.webp', href: null },
]

// Assembly guide (PDF) shown only on the aBoks Vegg page. Matched on the CMS title — the
// same key the homepage section uses (src/app/(frontend)/page.tsx), so an edited slug does
// not silently hide the link.
const VEGG_PRODUCT_TITLE = 'aBoks Vegg'
const VEGG_ASSEMBLY_GUIDE_URL =
  'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aboks-vegg/aBoks-Vegg-Monteringsveiledning.pdf'

/** Shared by the clickable and non-clickable variants so both keep identical framing. */
const FUTURE_IMAGE_BOX: React.CSSProperties = {
  aspectRatio: '4/3',
  background: '#efe6d3',
  borderBottom: '1px dashed #cdbf9f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65
}

export default function ProductClient({ product, variants, initialSku, breadcrumbs, reviewSummary, materialStory }: Props) {
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
  const [isNarrow, setIsNarrow] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const carouselRef = useRef<ProductImageCarouselHandle>(null)

  useEffect(() => {
    if (initialImageIdx > 0) {
      carouselRef.current?.goTo(initialImageIdx)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = useCartStore((s) => s.addItem)
  // Read only to cap what a variant-less product may add — see handleAddToCart.
  const cartItems = useCartStore((s) => s.items)
  const openCartDrawer = useCartStore((s) => s.openCartDrawer)

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 1100)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [saleExpired, setSaleExpired] = useState(false)

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0]
  const effectivePrice = saleExpired ? product.price : getEffectivePrice(product.price, product.sale)
  const saleActive = !saleExpired && isSaleActive(product.price, product.sale)

  // Does this product have colours to choose between at all? Everything below branches on
  // this rather than on `selectedVariant` being falsy, so a variant-less product is a real
  // buyable state and not an error state.
  const hasVariants = variants.length > 0
  // The one stock rule, applied once: the chosen variant's inventory, or — with no variants —
  // the product's own stock. Nothing else on this page reads either field directly.
  const stock = availableStock(product, variants, selectedVariant)
  const soldOut = isSoldOut(stock)
  /** Upper bound on the stepper. Unchanged (99) for variant products; capped by stock for the rest. */
  const maxQty = hasVariants ? 99 : Math.min(99, stock)

  /**
   * Is this a Tilbehør page?
   *
   * The single switch behind every aBoks-specific piece of this page: the capacity band, the
   * product video, the two trust lines that are only true of something we make ourselves, and
   * the framing above the feature cards. Each of those is about the *product's own* nature,
   * not about whether some field happens to be filled in — so all four read this one flag
   * rather than guessing from empty data. An aBoks whose capacity or video has not been
   * entered yet is a data gap to fix, not a product that should quietly lose its sections.
   *
   * `accessories` is the value stored behind the «Tilbehør» label in the Products collection,
   * so this covers every accessory published from now on with no further code change.
   */
  const isAccessory = product.section === 'accessories'

  const trustSignals = isAccessory ? TRUST_UNIVERSAL : TRUST
  const featureCopy = isAccessory ? FEATURE_SECTION_COPY.accessories : FEATURE_SECTION_COPY.products

  /**
   * Capacity-derived content.
   *
   * Everything below is read off the product's own capacity numbers in the CMS — never off the
   * slug — so a new model gets the right band the moment its numbers are entered. The three
   * shapes the band can take follow from how many battery types the box holds:
   *
   *   two types (aBoks, Vegg)   → three rooms: AA, AAA and brukte
   *   one type  (Mini, Nano)    → two rooms: that one type and brukte
   *   no types  (Spesial)       → one room, for brukte only — a single, centred stat
   */
  const hasAA = product.capacity.aa > 0
  const hasAAA = product.capacity.aaa > 0

  /** The stats for new batteries — one per battery type the product actually has a room for. */
  const newBatteryItems = [
    hasAA
      ? { big: String(product.capacity.aa), unit: 'AA-batterier', note: 'Eget rom for nye AA.' }
      : null,
    hasAAA
      ? { big: String(product.capacity.aaa), unit: 'AAA-batterier', note: 'Eget rom for nye AAA.' }
      : null,
  ].filter((c): c is { big: string; unit: string; note: string } => c !== null)

  /** How many battery types get their own room: 2, 1 or 0. Drives the eyebrow and the heading. */
  const newBatteryTypes = newBatteryItems.length

  const capacityItems = [
    ...newBatteryItems,
    ...(product.capacity.usedCompartments > 0
      ? [
          {
            big: String(product.capacity.usedCompartments),
            unit: 'rom for brukte',
            note:
              newBatteryTypes > 1
                ? 'Samle dem til gjenvinning.'
                : 'Samle brukte batterier til gjenvinning.',
          },
        ]
      : []),
  ]

  const capacityBandEyebrow =
    newBatteryTypes > 1
      ? 'Tre rom, full kapasitet'
      : newBatteryTypes === 1
        ? 'To rom, kompakt design'
        : 'Ett rom, enkel løsning'

  const capacityBandHeading =
    newBatteryTypes > 1
      ? 'Plass til alt – hver for seg.'
      : newBatteryTypes === 1
        ? `Plass til ${hasAA ? 'AA' : 'AAA'} – og brukte batterier.`
        : 'Kun plass til brukte batterier.'

  // view_item: fires on initial mount and whenever the selected variant changes
  useEffect(() => {
    if (hasVariants && !selectedVariant) return
    trackViewItem({
      // The line reference, so a variant-less product reports itself rather than an empty id.
      variantId: selectedVariant?.id ?? cartLineRef({ productId: product.id }),
      variantName: selectedVariant?.name ?? '',
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
    // A product with colours needs one chosen; one without is buyable as itself.
    if (hasVariants && !selectedVariant) return
    if (soldOut) return

    const line = {
      // Only ever set when there really is a variant — never a placeholder id.
      ...(selectedVariant ? { variantId: selectedVariant.id } : {}),
      productId: product.id,
      productSlug: product.slug,
      // The product's real name, straight from the CMS document this page was built from —
      // so the cart line says "aBoks Vegg" or an accessory's own title, not a guess.
      productTitle: product.title,
      colorName: selectedVariant?.name ?? '',
      colorHex: selectedVariant?.colorHex ?? '',
      // The product's own picture stands in when there is no colour to picture.
      colorImage: selectedVariant?.image || product.images[0]?.src || '',
      price: effectivePrice,
    }

    // For a variant-less product the cart must never end up holding more than exists, so what
    // is already on the line counts towards the limit. Variant products keep their existing
    // behaviour — the cart has never blocked on variant inventory and the checkout still
    // reports it rather than refusing it.
    const alreadyInCart = hasVariants
      ? 0
      : (cartItems.find((i) => cartLineRef(i) === cartLineRef(line))?.qty ?? 0)
    const addable = hasVariants ? qty : Math.max(0, Math.min(qty, stock - alreadyInCart))
    if (addable <= 0) return

    addItem(line, addable)
    // add_to_cart: fires after item is added to cart
    trackAddToCart({
      variantId: selectedVariant?.id ?? cartLineRef({ productId: product.id }),
      variantName: selectedVariant?.name ?? '',
      productTitle: product.title,
      price: effectivePrice,
      quantity: addable,
    })
    // Only now, with the line actually in the cart: every early return above — no colour
    // chosen, sold out, nothing addable within stock — leaves the drawer shut. It shows the
    // real cart, so it is the confirmation the toast used to be, and it also offers the way
    // on to the checkout. Adding again while it is open just updates the line inside it.
    openCartDrawer()
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
      <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee' }}>
        {/* Breadcrumb — trail comes from the server: Hjem → Produkter|Tilbehør → title */}
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <Breadcrumbs items={breadcrumbs} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: saleActive && product.sale?.saleStartDate && product.sale?.saleEndDate ? '14px' : '22px', flexWrap: 'wrap' }}>
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
                {/* Real rating only — no reviews yet means no rating badge (spec §13). */}
                {reviewSummary && reviewSummary.count > 0 && (
                  <Link
                    href={`/anmeldelser?product=${product.slug}`}
                    aria-label={`${reviewSummary.average.toFixed(1).replace('.', ',')} av 5 stjerner, ${reviewSummary.count} anmeldelser`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                  >
                    <Stars value={reviewSummary.average} size={15} showValue />
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63', textDecoration: 'underline' }}>
                      {reviewSummary.count} {reviewSummary.count === 1 ? 'anmeldelse' : 'anmeldelser'}
                    </span>
                  </Link>
                )}
              </div>

              {/* Sale countdown — сразу под ценой, левое выравнивание */}
              {saleActive && product.sale?.saleStartDate && product.sale?.saleEndDate && (
                <div style={{ marginBottom: '22px' }}>
                  <SaleCountdown
                    startDate={product.sale.saleStartDate}
                    endDate={product.sale.saleEndDate}
                    onExpire={() => setSaleExpired(true)}
                    align="left"
                  />
                </div>
              )}

              {/* Color selector — omitted entirely for a product that has no variants */}
              {hasVariants && (
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
              )}

              {/* Lagerstatus — same three states as before, now fed by the shared stock rule:
                  the chosen variant's inventory, or the product's own stock when it has no
                  variants. Identical markup and wording either way. */}
              {(selectedVariant || !hasVariants) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  {stock > 10 ? (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5f8253', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#3a3f33' }}>På lager</span>
                    </>
                  ) : stock > 0 ? (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5f8253', flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#3a3f33' }}>På lager: {stock} stk.</span>
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
                  <button onClick={() => setQty((q) => Math.max(1, Math.min(maxQty, q + 1)))} aria-label="Flere"
                    style={{ width: '48px', height: '50px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#1a1d17', lineHeight: 1 }}>
                    +
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={(hasVariants && !selectedVariant) || soldOut}
                  style={{
                    flex: 1, minWidth: '200px', display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: '10px', padding: '17px 32px', borderRadius: '999px',
                    background: soldOut ? '#c8c0b0' : '#39402c',
                    color: '#faf6ee', fontFamily: 'var(--font-manrope)',
                    fontWeight: 600, fontSize: '15px', border: 'none',
                    cursor: soldOut ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!soldOut) (e.currentTarget as HTMLButtonElement).style.background = '#2a3020'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = soldOut ? '#c8c0b0' : '#39402c'
                  }}
                >
                  {soldOut ? 'Utsolgt' : 'Legg i handlekurv'}
                </button>
              </div>

              {/* Development-support credit — sits directly under the cart button */}
              <ProductSupportTrust />

              {/* Description — mobile only (hidden on desktop, shown in order-1 there) */}
              <p className="md:hidden" style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', lineHeight: 1.6, color: '#3a3f33', margin: '0 0 24px' }}>
                {product.description}
              </p>

              {/* Trust signals — the two aBoks-specific claims are dropped from the list
                  itself for Tilbehør, so no empty row or gap is left in their place. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px 0', borderTop: '1px solid #e7e2d4', borderBottom: '1px solid #e7e2d4', marginBottom: '30px' }}>
                {trustSignals.map((t) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5f8253" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#3a3f33' }}>{t}</span>
                  </div>
                ))}
              </div>

              {/* Details accordion */}
              {product.details.length > 0 && (
                <Accordion
                  items={product.details.map((d) => ({ id: d.id, question: d.title, answer: d.content }))}
                  borderColor="#e7e2d4"
                />
              )}

              {/* Assembly guide — aBoks Vegg only */}
              {product.title.trim().toLowerCase() === VEGG_PRODUCT_TITLE.toLowerCase() && (
                <div style={{ textAlign: 'center', marginTop: '18px' }}>
                  <a
                    href={VEGG_ASSEMBLY_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#5a6150',
                      textDecoration: 'none', opacity: 0.85, transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.opacity = '1'
                      el.style.textDecoration = 'underline'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.opacity = '0.85'
                      el.style.textDecoration = 'none'
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="M7 10l5 5 5-5" />
                      <path d="M12 15V3" />
                    </svg>
                    Last ned monteringsveiledning
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CAPACITY BAND — Tilbehør has no compartments to count, so the whole band is
            omitted for it. The <section> carries its own background and padding, so nothing
            is left behind and the section below simply moves up. */}
        {!isAccessory && (
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
            {/* One stat (Spesial: brukte batterier only) gets a single centred column rather
                than a lone item stranded in a multi-column grid; two or three stats keep the
                auto-fit row, where `justifyContent` is a no-op because the 1fr tracks already
                fill the width. Both forms stack on narrow screens as before. */}
            <div style={{ display: 'grid', gridTemplateColumns: capacityItems.length === 1 ? 'minmax(0, 320px)' : 'repeat(auto-fit, minmax(200px, 1fr))', justifyContent: 'center', gap: 'clamp(28px,4vw,48px)' }}>
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
        )}

        {/* VIDEO — omitted entirely for Tilbehør, wrapper included. Without a film the block
            falls back to `VideoPlaceholder`, which is a promise of a video to come; that is
            right for an aBoks we are still filming and wrong for a third-party accessory that
            will never have one. The <section> owns its own padding, so nothing is left behind
            and the features below move straight up. */}
        {!isAccessory && (
        <section style={{ background: '#faf6ee', padding: 'clamp(64px,8vw,104px) 0' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
            {selectedVariant?.videoUrl ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  boxShadow: '0 24px 56px -20px rgba(42,36,24,.3)',
                  background: '#e7d9bd',
                }}
              >
                {/* Keyed on film *and* still so switching colour unmounts the
                    old player: playback stops, and Safari — which lays a poster
                    out once and ignores a later swap — has to build a fresh
                    element for the new colour. */}
                <ClickToPlayVideo
                  key={`${selectedVariant.videoUrl}|${selectedVariant.videoPoster ?? ''}`}
                  src={selectedVariant.videoUrl}
                  poster={selectedVariant.videoPoster ?? undefined}
                  label={`Spill av produktvideo: aBoks ${selectedVariant.name}`}
                  muted
                  buttonSize={72}
                  placeholderBackground="#e7d9bd"
                  wrapperStyle={{ position: 'absolute', inset: 0 }}
                  videoStyle={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '24px',
                    bottom: '22px',
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: '#faf6ee',
                    background: 'rgba(26,29,23,.5)',
                    padding: '7px 14px',
                    borderRadius: '999px',
                    pointerEvents: 'none',
                  }}
                >
                  Produktvideo
                </span>
              </div>
            ) : (
              <VideoPlaceholder thumbnail={displayImage || undefined} label="Produktvideo" />
            )}
          </div>
        </section>
        )}

        {/* FEATURES */}
        {product.features.length > 0 && (
          <section style={{ background: '#faf6ee', padding: 'clamp(64px,8vw,104px) 0' }}>
            <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

              {/* Section header — the only part that differs by section. Same markup, same
                  styles, same spacing; only the three strings change. See
                  FEATURE_SECTION_COPY. */}
              <div style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto clamp(44px,6vw,68px)' }}>
                <p style={{
                  fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px',
                  letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px',
                }}>
                  {featureCopy.eyebrow}
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-cormorant)', fontWeight: 500,
                  fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07,
                  color: '#1a1d17', margin: '0 0 18px',
                }}>
                  {featureCopy.heading}
                </h2>
                <p style={{
                  fontFamily: 'var(--font-manrope)', fontSize: '16px', lineHeight: 1.65,
                  color: '#6b6f63', margin: 0,
                }}>
                  {featureCopy.subheading}
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

        {/* MATERIAL STORY — server-rendered slot, straight after "Hvorfor aBoks" */}
        {materialStory}

        {/* PRODUCT FAQ */}
        {product.faqs.length > 0 && (
          <section style={{ background: '#f2e7d7', padding: 'clamp(64px,8vw,104px) 0' }}>
            <div style={{ maxWidth: '840px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
              <div style={{ textAlign: 'center', marginBottom: 'clamp(32px,4vw,48px)' }}>
                <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px' }}>Vanlige spørsmål</p>
                <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(30px,3.8vw,46px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: 0 }}>
                  Ofte stilte spørsmål
                </h2>
              </div>
              <Accordion items={product.faqs} defaultOpen={product.faqs[0]?.id} borderColor="#ddd2bb" />
            </div>
          </section>
        )}

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
                  {p.image && (p.href ? (
                    /* Only the image links — title, text and the rest of the card stay inert. */
                    <Link
                      href={p.href}
                      data-btn
                      aria-label={`Åpne ${p.name}`}
                      className="group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#5e6a48]"
                      style={{ ...FUTURE_IMAGE_BOX, cursor: 'pointer', textDecoration: 'none', overflow: 'hidden' }}
                    >
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                        style={{ objectFit: 'cover' }}
                      />
                    </Link>
                  ) : (
                    <div style={FUTURE_IMAGE_BOX}>
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ))}
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
              {/* Unchanged for a product with colours; a product without one names itself. */}
              {selectedVariant ? `aBoks · ${selectedVariant.name}` : product.title}
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
            disabled={(hasVariants && !selectedVariant) || soldOut}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '15px',
              borderRadius: '999px',
              background: soldOut ? '#c8c0b0' : '#39402c',
              color: '#faf6ee',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 600,
              fontSize: '15px',
              border: 'none',
              cursor: soldOut ? 'not-allowed' : 'pointer',
            }}
          >
            {soldOut ? 'Utsolgt' : 'Legg i handlekurv'}
          </button>
        </div>
      )}
    </>
  )
}
