'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import InquiryForm from './InquiryForm'
import { anchorClick } from '@/lib/anchorScroll'
import {
  quoteContextFor,
  quoteRequestMessage,
  quoteRequestQuantityField,
  readQuoteRequestParams,
} from '@/lib/quoteRequest'
import type { BedrifterProduct } from '@/lib/bedrifterProducts'
import {
  ANCHOR_OFFSET,
  BEIGE,
  BORDER_WARM,
  CHECK_GREEN,
  CREAM,
  GOLD,
  INK,
  MUTED,
  OLIVE,
  PALE_SAGE,
  SANS,
  SECTION_PAD,
  SERIF,
  SOFT,
  eyebrowStyle,
  h2Style,
  introStyle,
  primaryButton,
  secondaryButton,
} from './theme'
import { useRevealFactory } from './useReveal'
import BusinessSolutions from './BusinessSolutions'
import ProductSectionList, { buildProductSections } from './ProductSections'
import BusinessCalculator from './calculator/BusinessCalculator'
import type { BusinessSolution } from '@/lib/bedrifterSolutions'

/**
 * Existing catalogue entry, assembled from Payload in `page.tsx`. Defined in
 * `lib/bedrifterProducts` — the package pages read the same shape — and re-exported here so
 * everything that already imports it from this file keeps working.
 */
export type { BedrifterProduct }

/* ────────────────────────────── design tokens ──────────────────────────────
   The values the homepage and product pages use inline. They live in `theme.ts` because
   the page is split across several files now — see the note there. */

/* ────────────────────────────── page content ────────────────────────────── */

const HERO_DESKTOP = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bedrifter/Hero-for-bedrifter-desktop-new.webp'
const HERO_MOBILE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Bedrifter/Hero-for-bedrifter-mobile-new.webp'
const HERO_ALT =
  'aBoks Spesial montert på veggen og aBoks Office på skrivebordet i et kontormiljø'

const HERO_POINTS = ['Trygg innsamling', 'Flere innsamlingspunkter', 'For kontor og arbeidsplass']

const PROBLEM_POINTS = [
  'Nye og brukte batterier blandes sammen',
  'Brukte batterier blir liggende på arbeidsplassen',
  'Det mangler lett tilgjengelige innsamlingspunkter',
  'Batterier kan havne i restavfallet',
]

const PLACEMENTS = [
  'Ved arbeidsstasjonen',
  'På kontoret',
  'I verkstedet',
  'På lageret',
  'I personalrommet',
  'Ved inngangen',
]

const CHECKLIST = [
  'Har brukte batterier en fast oppsamlingsplass?',
  'Er beholderen lett tilgjengelig for ansatte?',
  'Holdes nye og brukte batterier adskilt?',
  'Er innsamlingspunktet tydelig merket?',
  'Tømmes beholderen regelmessig?',
  'Leveres batteriene til godkjent mottak?',
]

const COOPERATION = [
  {
    title: 'Bedriftsbestilling',
    text: 'For bedrifter som ønsker flere produkter til egne lokaler, arbeidsstasjoner eller fellesområder.',
    points: [
      'Tilbud basert på antall',
      'Samlet levering',
      'Hjelp til valg av riktige modeller',
      'Pris ved større bestillinger etter avtale',
    ],
    note: null,
  },
  {
    title: 'Forhandlere',
    text: 'For butikker og nettbutikker som ønsker å tilby aBoks til sine kunder.',
    points: [
      'Innkjøpspris etter avtale',
      'Mulighet for mindre startordre',
      'Produktbilder og salgsmateriell',
      'Løpende bestillinger',
    ],
    note: null,
  },
  {
    title: 'Dropshipping',
    text: 'For nettbutikker som ønsker å tilby aBoks uten å lagerføre hele sortimentet.',
    points: [],
    note: 'Dropshipping kan vurderes etter avtale.',
  },
]

const PROCESS = [
  {
    number: '01',
    title: 'Fortell oss hva dere trenger',
    text: 'Beskriv arbeidsplassen, antall steder og hvilke produkter dere er interessert i.',
  },
  {
    number: '02',
    title: 'Vi foreslår en løsning',
    text: 'Vi hjelper med valg av modeller, antall og en praktisk plassering.',
  },
  {
    number: '03',
    title: 'Dere mottar et uforpliktende tilbud',
    text: 'Tilbudet tilpasses behovet og omfanget av bestillingen.',
  },
]

/* ────────────────────────────── small pieces ────────────────────────────── */

function CheckMark({ color = CHECK_GREEN, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: '3px' }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/* ────────────────────────────── page ────────────────────────────── */

export default function BedrifterClient({ products }: { products: BedrifterProduct[] }) {
  const reveal = useRevealFactory()
  const [interest, setInterest] = useState('')
  const [message, setMessage] = useState('')
  /** The last message this page wrote into the form — see `presetMessage`. */
  const presetMessage = useRef('')
  /**
   * Approximate quantity, prefilled when the visitor arrived from a «Be om tilbud» elsewhere
   * on the site. `undefined` leaves the form's own field entirely alone, which is what every
   * other way of reaching this page does.
   */
  const [quantity, setQuantity] = useState<string | undefined>(undefined)

  /** "Meld interesse" — presets the form's dropdown, then scrolls to it. */
  const pickInterest = (value: string, anchor = 'foresporsel') =>
    anchorClick(anchor, () => setInterest(value))

  /**
   * "Be om tilbud" on a solution — the same as `pickInterest`, plus a message naming the
   * solution the visitor came from, since the dropdown has no option per package.
   *
   * Anything the visitor typed themselves is left alone: the message is only written when
   * the field is empty or still holds a preset this page put there.
   */
  const requestQuote = (solution?: BusinessSolution) =>
    anchorClick('foresporsel', () => {
      setInterest(solution?.interestOption ?? 'Produkter til egen bedrift')
      const next = solution
        ? `Vi ønsker et tilbud på ${solution.name}.`
        : 'Vi ønsker hjelp til å finne en løsning som passer våre lokaler.'
      setMessage((current) => (current === '' || current === presetMessage.current ? next : current))
      presetMessage.current = next
    })

  /**
   * «Be om tilbud» for one product at one quantity.
   *
   * Used by the price tables' quote rows, and — through the effect below — by a visitor who
   * arrived from the cart or a product page with the product and quantity in the URL. Both go
   * through this one function, so the form is filled the same way whichever they came from,
   * and both reuse the existing enquiry rather than introducing a second one.
   *
   * The message is written only into an empty field or one this page filled itself; anything
   * the visitor has typed is left exactly as it is.
   */
  const fillQuoteRequest = (product: BedrifterProduct, requestedQuantity: number) => {
    const context = quoteContextFor(product, requestedQuantity)
    const next = quoteRequestMessage(context)
    setInterest((current) => current || 'Større bestilling')
    setMessage((current) => (current === '' || current === presetMessage.current ? next : current))
    presetMessage.current = next
    setQuantity(quoteRequestQuantityField(context))
  }

  /** The price table's quote row: fill the form, then scroll to it. */
  const requestProductQuote = (product: BedrifterProduct, requestedQuantity: number) =>
    anchorClick('tilbud', () => fillQuoteRequest(product, requestedQuantity))

  /**
   * A «Be om tilbud» that started somewhere else on the site.
   *
   * Read from `window.location.search` in an effect rather than through `useSearchParams`, on
   * purpose: this page is statically rendered with `revalidate = 3600`, and reading search
   * params during render would opt the whole route out of that. Nothing on the server depends
   * on this — the page renders identically with and without the parameters, and the form is
   * filled once, in the browser, after hydration.
   *
   * Only a known product slug and a plain quantity are accepted, and the sentence is rebuilt
   * here from the live catalogue: nothing that arrives in the URL is shown verbatim.
   */
  useEffect(() => {
    const request = readQuoteRequestParams(window.location.search)
    if (!request) return
    const product = products.find((candidate) => candidate.slug === request.productSlug)
    if (!product) return
    fillQuoteRequest(product, request.quantity)
    // Products are resolved on the server and stable for the life of the page; this runs once.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Every product on the page, in the order `page.tsx` resolved from the CMS — built by the
   * shared helper the package pages use, so both build their sections the same way.
   */
  const productSections = buildProductSections(products)

  // Split into two groups so the mobile hero can use the homepage's layering: copy at the
  // top of the image, actions pinned to the bottom. From `md` up the wrapper is a plain
  // block, `mt-auto` resolves to 0 and the two groups flow as one continuous column.
  const heroCopy = (
    <>
      <div>
        <p style={{ ...eyebrowStyle, margin: '0 0 16px' }}>Løsninger for bedrifter</p>
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 'clamp(34px,3.6vw,56px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.06,
            color: INK,
            margin: '0 0 18px',
          }}
        >
          Trygg batterihåndtering – <em style={{ fontStyle: 'italic', color: OLIVE }}>der batteriene brukes.</em>
        </h1>
        {/* Desktop only — the mobile hero reads as eyebrow, heading, buttons, points. */}
        <p
          className="hidden md:block"
          style={{
            fontFamily: SANS,
            fontSize: 'clamp(15.5px,1.25vw,18px)',
            lineHeight: 1.65,
            color: SOFT,
            margin: '0 0 30px',
            maxWidth: '46ch',
          }}
        >
          Praktiske løsninger for trygg batterihåndtering på moderne arbeidsplasser.
        </p>
      </div>

      <div className="mt-auto md:mt-0">
        {/* One row on mobile, exactly like the homepage hero's pair of buttons. The
            half-width basis plus `flex-wrap` lets them stack instead of overflowing on
            the narrowest phones, where the two labels cannot share a line. */}
        <div className="mx-auto flex w-full max-w-[380px] flex-wrap gap-3 md:mx-0 md:max-w-none md:gap-[14px]">
          <a
            href="#foresporsel"
            data-btn
            onClick={anchorClick('foresporsel')}
            className="grow basis-[calc(50%-6px)] px-[22px] sm:px-9 md:grow-0 md:basis-auto"
            style={primaryButton}
          >
            Be om tilbud
          </a>
          <a
            href="#losninger"
            data-btn
            onClick={anchorClick('losninger')}
            className="grow basis-[calc(50%-6px)] px-[22px] sm:px-8 md:grow-0 md:basis-auto"
            style={secondaryButton}
          >
            Se løsningene
          </a>
        </div>
        <ul
          className="mt-[22px] flex flex-wrap justify-center gap-x-5 gap-y-2 md:mt-[30px] md:flex-col md:justify-start md:gap-[11px]"
          style={{ listStyle: 'none', padding: 0 }}
        >
          {HERO_POINTS.map((point) => (
            <li
              key={point}
              className="[text-shadow:0_1px_3px_rgba(250,246,238,0.9)] md:[text-shadow:none]"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 'clamp(13.5px,1.05vw,15px)',
                lineHeight: 1.45,
                color: SOFT,
              }}
            >
              <CheckMark size={16} />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </>
  )

  return (
    <main>
      {/* ==================== HERO ====================
          One copy of the hero text (one H1) across three layouts:
            · below `md`  — full-height section, mobile photo as the background, copy layered
                            on top with the actions pinned to the bottom (homepage pattern);
            · `md`–`lg`   — desktop photo as a band, copy flowing underneath it;
            · from `lg`   — copy lifts out of the flow into the empty wall area of the photo.
          The fixed header is transparent over all three (HERO_TOP_ROUTES in Header.tsx). */}
      <section
        className="relative h-[100svh] min-h-[620px] overflow-hidden md:h-auto md:min-h-0 md:overflow-visible"
        style={{ background: CREAM }}
      >
        {/* Mobile background — fills the whole section, header included */}
        <div className="absolute inset-0 md:hidden" style={{ background: '#e9e5df' }}>
          <Image
            src={HERO_MOBILE}
            alt={HERO_ALT}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center 55%' }}
          />
        </div>

        {/* Desktop / tablet image. Scaled about its bottom edge, which trims 8.3% of the
            empty wall off the top (≈70px at a 1440px-wide viewport) and lets the tabletop
            sit lower and larger in the frame. A transform does not affect layout, so the
            hero keeps the height it gets from the image's natural 1660×948 ratio. */}
        <div className="hidden md:block" style={{ overflow: 'hidden' }}>
          <Image
            src={HERO_DESKTOP}
            alt={HERO_ALT}
            width={1660}
            height={948}
            priority
            sizes="100vw"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              transform: 'scale(1.09)',
              transformOrigin: 'center bottom',
            }}
          />
        </div>

        {/* Layered over the photo below `md` and again from `lg` up; a plain block in
            between. At `lg` the copy is nudged down by half the padding so it clears the
            transparent header's nav row — the clearance the homepage hero leaves. */}
        <div className="absolute inset-0 z-[2] md:relative md:inset-auto lg:absolute lg:inset-0 lg:flex lg:items-center lg:pt-[96px]">
          <div className="max-w-container mx-auto h-full w-full px-[clamp(20px,5vw,48px)] md:h-auto">
            {/* Padding lives in classes so it can differ per layout: clearing the fixed
                header on mobile, and collapsing at `lg` where the block is centred. */}
            <div className="flex h-full max-w-[620px] flex-col pb-[clamp(30px,7vw,48px)] pt-[clamp(88px,22vw,120px)] text-center md:block md:h-auto md:pb-[clamp(56px,8vw,84px)] md:pt-[clamp(34px,5vw,56px)] md:text-left lg:max-w-[42%] lg:py-0">
              {heroCopy}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== COMPLETE SOLUTIONS ====================
          The packages, introduced before the individual models further down. Its content
          lives in `lib/bedrifterSolutions.ts`; each card leads to /bedrifter/<slug>. */}
      {/* ==================== COMPLETE SOLUTIONS + CALCULATOR ====================
          The calculator answers the question the four cards leave behind — which one fits
          us, and how many units? — so it is rendered between them and the closing note,
          through `afterCards`. Its rules live in `lib/bedrifter/calculator`; the result
          links on to the solution page with the recommended quantities in the URL. */}
      <BusinessSolutions
        products={products}
        reveal={reveal}
        onQuoteRequest={requestQuote}
        afterCards={
          <BusinessCalculator
            reveal={reveal}
            productTitles={Object.fromEntries(products.map((p) => [p.slug, p.title]))}
          />
        }
      />

      {/* ==================== PROBLEM ==================== */}
      <section aria-labelledby="utfordringer-heading" style={{ background: BEIGE, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '720px' }}>
            <p style={eyebrowStyle}>En enklere rutine</p>
            <h2 id="utfordringer-heading" style={h2Style}>
              Små batterier skaper store utfordringer.
            </h2>
            <p style={introStyle}>
              På mange arbeidsplasser brukes og skiftes batterier flere steder. Uten en fast
              løsning blir brukte batterier ofte liggende i skuffer, skap eller arbeidsområder –
              eller havner i feil avfall.
            </p>
          </motion.div>

          <ul
            className="grid grid-cols-1 md:grid-cols-2"
            style={{
              listStyle: 'none',
              margin: 'clamp(36px,4.5vw,56px) 0 0',
              padding: 0,
              columnGap: 'clamp(24px,3vw,48px)',
              rowGap: '2px',
            }}
          >
            {PROBLEM_POINTS.map((point, i) => (
              <motion.li
                key={point}
                {...reveal(i * 0.06)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '20px 0',
                  borderTop: `1px solid ${BORDER_WARM}`,
                  fontFamily: SANS,
                  fontSize: 'clamp(15.5px,1.3vw,17px)',
                  lineHeight: 1.55,
                  color: SOFT,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '999px',
                    background: GOLD,
                    flexShrink: 0,
                    marginTop: '9px',
                  }}
                />
                {point}
              </motion.li>
            ))}
          </ul>

          <motion.p
            {...reveal(0.1)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              margin: 'clamp(36px,4.5vw,56px) 0 0',
              padding: 'clamp(24px,3vw,34px) clamp(24px,3.4vw,40px)',
              background: CREAM,
              borderRadius: '22px',
              fontFamily: SERIF,
              fontWeight: 500,
              fontStyle: 'italic',
              fontSize: 'clamp(20px,2.1vw,28px)',
              lineHeight: 1.32,
              letterSpacing: '-0.01em',
              color: OLIVE,
              maxWidth: '860px',
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: '28px', height: '1.5px', background: GOLD, flexShrink: 0, marginTop: '18px' }}
            />
            Med en fast plass for brukte batterier blir det enklere for ansatte å sortere riktig
            – hver gang.
          </motion.p>
        </div>
      </section>

      {/* ==================== PRODUCT SOLUTIONS ==================== */}
      <section
        id="produkter"
        aria-labelledby="produkter-heading"
        style={{ background: CREAM, padding: SECTION_PAD, scrollMarginTop: ANCHOR_OFFSET }}
      >
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '720px', marginBottom: 'clamp(48px,6vw,80px)' }}>
            <p style={eyebrowStyle}>Løsninger for ulike behov</p>
            <h2 id="produkter-heading" style={h2Style}>
              Utviklet for arbeidsplassen.
            </h2>
            <p style={introStyle}>
              Fra veggmontert innsamling til organisering av skrivebordet – løsningene er laget
              for å gjøre batterihåndtering enkel og tilgjengelig der batteriene faktisk brukes.
            </p>
          </motion.div>

          <ProductSectionList
            sections={productSections}
            reveal={reveal}
            onInterest={(section) => pickInterest(section.interestOption)}
            onDocumentRequest={(section) => pickInterest(section.interestOption, 'tilbud')}
            onPriceTableQuote={(section) =>
              requestProductQuote(
                section.product,
                // The quantity the quote row names. A product with no threshold renders no
                // quote row at all, so the fallback is never actually used.
                section.quoteQuantity ?? 1,
              )
            }
          />
        </div>
      </section>

      {/* ==================== MULTIPLE COLLECTION POINTS ==================== */}
      <section aria-labelledby="plassering-heading" style={{ background: OLIVE, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ columnGap: 'clamp(40px,6vw,88px)', rowGap: 'clamp(32px,4vw,48px)', alignItems: 'center' }}
          >
            <motion.div {...reveal()}>
              <p style={{ ...eyebrowStyle, color: '#a9c08f' }}>Der batteriene brukes</p>
              <h2 id="plassering-heading" style={{ ...h2Style, color: CREAM }}>
                Én løsning. <em style={{ fontStyle: 'italic' }}>Flere innsamlingspunkter.</em>
              </h2>
              <p style={{ ...introStyle, color: '#c8d2c3', maxWidth: '48ch' }}>
                Plasser aBoks der batteriene faktisk brukes og skiftes. Det gjør riktig sortering
                enklere og reduserer risikoen for at brukte batterier blir liggende eller havner i
                restavfallet.
              </p>
            </motion.div>

            <motion.ul
              {...reveal(0.1)}
              style={{
                listStyle: 'none',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                margin: 0,
                padding: 0,
              }}
            >
              {PLACEMENTS.map((place) => (
                <li
                  key={place}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '11px 20px',
                    borderRadius: '999px',
                    border: '1px solid rgba(250,246,238,0.28)',
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: '14px',
                    color: CREAM,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: '5px', height: '5px', borderRadius: '999px', background: GOLD, flexShrink: 0 }}
                  />
                  {place}
                </li>
              ))}
            </motion.ul>
          </div>
        </div>
      </section>

      {/* ==================== CHECKLIST ==================== */}
      <section aria-labelledby="sjekkliste-heading" style={{ background: CREAM, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '660px', marginBottom: 'clamp(32px,4vw,48px)' }}>
            <p style={eyebrowStyle}>Sjekkliste</p>
            <h2 id="sjekkliste-heading" style={{ ...h2Style, fontSize: 'clamp(29px,3.4vw,44px)' }}>
              Har dere en trygg rutine for brukte batterier?
            </h2>
          </motion.div>

          <motion.div
            {...reveal(0.08)}
            style={{
              background: '#fff',
              border: '1px solid #e7e2d4',
              borderRadius: '24px',
              padding: 'clamp(28px,3.6vw,48px)',
              boxShadow: '0 2px 12px rgba(42,36,24,.05)',
            }}
          >
            <ul
              className="grid grid-cols-1 md:grid-cols-2"
              style={{ listStyle: 'none', margin: 0, padding: 0, columnGap: 'clamp(24px,3vw,48px)', rowGap: '18px' }}
            >
              {CHECKLIST.map((item) => (
                <li
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '13px',
                    fontFamily: SANS,
                    fontSize: 'clamp(15px,1.25vw,16.5px)',
                    lineHeight: 1.6,
                    color: SOFT,
                  }}
                >
                  <CheckMark />
                  {item}
                </li>
              ))}
            </ul>
            <p
              style={{
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: 1.65,
                color: MUTED,
                fontStyle: 'italic',
                margin: 'clamp(26px,3vw,34px) 0 0',
                paddingTop: 'clamp(22px,2.6vw,28px)',
                borderTop: '1px solid rgba(26,29,23,0.09)',
              }}
            >
              En enkel og synlig rutine gjør det lettere for alle å gjøre det riktig.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ==================== COOPERATION ==================== */}
      <section aria-labelledby="samarbeid-heading" style={{ background: BEIGE, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '660px', marginBottom: 'clamp(36px,4.5vw,56px)' }}>
            <p style={eyebrowStyle}>Samarbeid</p>
            <h2 id="samarbeid-heading" style={h2Style}>
              Løsninger for bedrifter og forhandlere.
            </h2>
          </motion.div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'clamp(20px,2.4vw,28px)',
            }}
          >
            {COOPERATION.map((card, i) => (
              <motion.div
                key={card.title}
                {...reveal(i * 0.08)}
                style={{
                  background: '#fff',
                  borderRadius: '22px',
                  padding: 'clamp(28px,3vw,38px)',
                  boxShadow: '0 2px 6px rgba(42,36,24,.05)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <h3
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: '19px',
                    color: INK,
                    margin: '0 0 12px',
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: SANS,
                    fontSize: '15.5px',
                    lineHeight: 1.65,
                    color: SOFT,
                    margin: 0,
                  }}
                >
                  {card.text}
                </p>

                {card.points.length > 0 && (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '22px 0 0',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {card.points.map((point) => (
                      <li
                        key={point}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          fontFamily: SANS,
                          fontSize: '15px',
                          lineHeight: 1.55,
                          color: MUTED,
                        }}
                      >
                        <CheckMark size={16} />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}

                {card.note && (
                  <p
                    style={{
                      fontFamily: SERIF,
                      fontStyle: 'italic',
                      fontWeight: 500,
                      fontSize: '21px',
                      lineHeight: 1.35,
                      color: OLIVE,
                      margin: '22px 0 0',
                      paddingTop: '22px',
                      borderTop: `1px solid ${BORDER_WARM}`,
                    }}
                  >
                    {card.note}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PROCESS ==================== */}
      <section aria-labelledby="prosess-heading" style={{ background: CREAM, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '660px', marginBottom: 'clamp(40px,5vw,64px)' }}>
            <p style={eyebrowStyle}>Slik gjør vi det</p>
            <h2 id="prosess-heading" style={h2Style}>
              Fra behov til forslag.
            </h2>
          </motion.div>

          <ol
            className="grid grid-cols-1 md:grid-cols-3"
            style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'clamp(28px,3.4vw,40px)' }}
          >
            {PROCESS.map((step, i) => (
              <motion.li key={step.number} {...reveal(i * 0.08)} style={{ position: 'relative' }}>
                {/* Dashed connector between the circles — the same treatment the
                    "Slik kommer du i gang" steps use on the homepage. */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: '52px',
                      height: '52px',
                      borderRadius: '999px',
                      background: CREAM,
                      border: '1.5px solid #c0b49a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: SERIF,
                      fontWeight: 500,
                      fontSize: '21px',
                      color: INK,
                      flexShrink: 0,
                    }}
                  >
                    {step.number}
                  </span>
                  {i < PROCESS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="hidden md:block"
                      style={{
                        flexGrow: 1,
                        marginLeft: '14px',
                        borderTop: '1.5px dashed #c0b49a',
                      }}
                    />
                  )}
                </div>
                <h3
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: '18px',
                    lineHeight: 1.35,
                    color: INK,
                    margin: '0 0 10px',
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontFamily: SANS,
                    fontSize: '15.5px',
                    lineHeight: 1.65,
                    color: MUTED,
                    margin: 0,
                    maxWidth: '40ch',
                  }}
                >
                  {step.text}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ==================== INQUIRY ==================== */}
      <section
        id="foresporsel"
        aria-labelledby="foresporsel-heading"
        style={{ background: PALE_SAGE, padding: SECTION_PAD, scrollMarginTop: ANCHOR_OFFSET }}
      >
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          {/* `#tilbud` is the form's own anchor — the section's `#foresporsel` lands a
              little higher, on the section padding. Both clear the sticky header. */}
          <div id="tilbud" style={{ maxWidth: '760px', margin: '0 auto', scrollMarginTop: ANCHOR_OFFSET }}>
            <motion.div {...reveal()} style={{ marginBottom: 'clamp(28px,3.4vw,42px)' }}>
              <p style={eyebrowStyle}>Kontakt oss</p>
              <h2 id="foresporsel-heading" style={h2Style}>
                Be om et uforpliktende tilbud.
              </h2>
              <p style={introStyle}>
                Fortell oss hva dere trenger, så tar vi kontakt med et forslag til løsning.
              </p>
            </motion.div>

            <motion.div {...reveal(0.08)}>
              <InquiryForm
              interest={interest}
              onInterestChange={setInterest}
              message={message}
              onMessageChange={setMessage}
              quantity={quantity}
            />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== FINAL CTA ==================== */}
      <section style={{ background: CREAM, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div
            {...reveal()}
            style={{
              borderRadius: '28px',
              background: OLIVE,
              padding: 'clamp(44px,6vw,80px) clamp(28px,5vw,72px)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'clamp(28px,4vw,48px)',
              alignItems: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: 'clamp(30px,3.8vw,50px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.06,
                  color: CREAM,
                  margin: '0 0 16px',
                }}
              >
                Usikker på hvilken løsning som passer?
              </h2>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: '17px',
                  lineHeight: 1.65,
                  color: '#c8d2c3',
                  margin: 0,
                  maxWidth: '48ch',
                }}
              >
                Fortell oss hvor og hvordan batteriene brukes, så hjelper vi dere med å finne en
                praktisk løsning.
              </p>
            </div>
            <div className="flex md:justify-end">
              <a
                href="#foresporsel"
                data-btn
                onClick={anchorClick('foresporsel')}
                className="w-full justify-center sm:w-auto"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '17px 40px',
                  borderRadius: '999px',
                  background: CREAM,
                  color: INK,
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: '15px',
                  textDecoration: 'none',
                  minHeight: '54px',
                }}
              >
                Kontakt oss
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
