'use client'

import { useState } from 'react'
import type { ConfigurableProduct, SolutionConfiguratorContent } from '@/lib/solutions/types'
import { useCartStore } from '@/store/cart'
import { trackAddToCart } from '@/lib/analytics'
import { getEffectivePrice } from '@/lib/pricing'
import { formatPrice } from '@/lib/format'
import ConfiguratorRow from './ConfiguratorRow'
import {
  BORDER_WARM,
  CREAM,
  INK,
  MUTED,
  OLIVE,
  PALE_SAGE,
  SANS,
  SERIF,
  SOFT,
  eyebrowStyle,
  h2Style,
  introStyle,
  primaryButton,
  secondaryButton,
} from '../theme'

/** What the customer has chosen for one product. */
interface Selection {
  variantId: string
  quantity: number
}

/**
 * The first colour a product opens on: the first one in the CMS order that is in stock, and
 * otherwise simply the first. Stock decides where to start, never what may be ordered.
 */
function initialVariantId(product: ConfigurableProduct): string {
  const inStock = product.variants.find((v) => v.inventory > 0)
  return (inStock ?? product.variants[0])?.id ?? ''
}

/**
 * The configurator: a colour and a quantity per product, a running summary, and one action
 * that puts the whole configuration into the shop's existing cart.
 *
 * It is a solution, not a bundle. There is no bundle SKU, no bundle price and no fixed ratio
 * between the products — each line is added as the ordinary product variant it is, exactly as
 * the product page would add it, so the cart, the drawer and the checkout treat it as
 * something they already understand. Any number of products works; this page passes two.
 */
export default function SolutionConfigurator({
  content,
  products,
  /** Scrolls to the inquiry form. */
  onQuoteRequest,
  anchorId = 'konfigurer',
}: {
  content: SolutionConfiguratorContent
  products: ConfigurableProduct[]
  onQuoteRequest: React.MouseEventHandler<HTMLAnchorElement>
  anchorId?: string
}) {
  const [selections, setSelections] = useState<Record<string, Selection>>(() =>
    Object.fromEntries(
      products.map((product) => [
        product.slug,
        { variantId: initialVariantId(product), quantity: product.defaultQuantity },
      ]),
    ),
  )

  const addItem = useCartStore((s) => s.addItem)
  const openCartDrawer = useCartStore((s) => s.openCartDrawer)

  const update = (slug: string, patch: Partial<Selection>) =>
    setSelections((current) => ({ ...current, [slug]: { ...current[slug], ...patch } }))

  /**
   * Everything the summary, the total and the add all need, in one pass. The effective price
   * is computed here — once per product, from the CMS price and its sale window — so the row,
   * the summary and the cart line can never disagree.
   */
  const lines = products.map((product) => {
    const selection = selections[product.slug]
    const variant = product.variants.find((v) => v.id === selection?.variantId)
    const unitPrice = getEffectivePrice(product.price, product.sale)
    const quantity = selection?.quantity ?? 0
    return {
      product,
      variant,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      // A product with colours needs one chosen before it can go in the cart; one without is
      // buyable as itself. Same rule the product page applies.
      addable: quantity > 0 && (product.variants.length === 0 || Boolean(variant)),
    }
  })

  const chosen = lines.filter((line) => line.quantity > 0)
  const total = chosen.reduce((sum, line) => sum + line.lineTotal, 0)
  const addableLines = lines.filter((line) => line.addable)

  const handleAddSolution = () => {
    if (addableLines.length === 0) return

    for (const line of addableLines) {
      const { product, variant, quantity, unitPrice } = line
      addItem(
        {
          // Only ever set when there really is a variant — never a placeholder id.
          ...(variant ? { variantId: variant.id } : {}),
          productId: product.id,
          productSlug: product.slug,
          productTitle: product.title,
          colorName: variant?.name ?? '',
          colorHex: variant?.colorHex ?? '',
          colorImage: variant?.image || product.image || '',
          price: unitPrice,
        },
        quantity,
      )
      // The existing per-line tracking, once per product — the shared analytics and CAPI
      // deduplication are left exactly as they are.
      trackAddToCart({
        variantId: variant?.id ?? `product-${product.id}`,
        variantName: variant?.name ?? '',
        productTitle: product.title,
        price: unitPrice,
        quantity,
      })
    }

    // Once, after every line is in: the drawer is the confirmation for the whole solution,
    // not for each product.
    openCartDrawer()
  }

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-heading`}
      style={{
        background: CREAM,
        padding: 'clamp(72px,9vw,120px) 0',
        scrollMarginTop: 'clamp(84px,11vh,110px)',
      }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <div style={{ maxWidth: '720px' }}>
          <p style={eyebrowStyle}>Sett sammen løsningen</p>
          <h2 id={`${anchorId}-heading`} style={h2Style}>
            {content.heading}
          </h2>
          <p style={introStyle}>{content.intro}</p>
        </div>

        <div
          className="mt-[clamp(36px,4.5vw,56px)] grid grid-cols-1 lg:grid-cols-[1.5fr_1fr]"
          style={{ gap: 'clamp(20px,2.6vw,32px)', alignItems: 'start' }}
        >
          {/* The products */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px,2vw,22px)' }}>
            {lines.map((line) => (
              <ConfiguratorRow
                key={line.product.slug}
                product={line.product}
                variant={line.variant}
                quantity={line.quantity}
                unitPrice={line.unitPrice}
                onVariantChange={(variantId) => update(line.product.slug, { variantId })}
                onQuantityChange={(quantity) => update(line.product.slug, { quantity })}
              />
            ))}
          </div>

          {/* Summary — sticky beside the products on a wide screen, under them otherwise */}
          <div className="lg:sticky lg:top-[120px]">
            <div
              style={{
                background: PALE_SAGE,
                borderRadius: '24px',
                padding: 'clamp(24px,2.8vw,32px)',
              }}
            >
              <h3
                style={{
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: 'clamp(22px,2.2vw,28px)',
                  letterSpacing: '-0.015em',
                  color: INK,
                  margin: '0 0 18px',
                }}
              >
                {content.summaryHeading}
              </h3>

              {chosen.length === 0 ? (
                <p
                  style={{
                    fontFamily: SANS,
                    fontSize: '15px',
                    lineHeight: 1.65,
                    color: SOFT,
                    margin: 0,
                  }}
                >
                  Velg produkter og antall for å sette sammen løsningen.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {chosen.map((line) => (
                    <li
                      key={line.product.slug}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                        padding: '14px 0',
                        borderBottom: `1px solid rgba(26,29,23,.10)`,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: SANS,
                            fontWeight: 700,
                            fontSize: '15px',
                            color: INK,
                          }}
                        >
                          {line.quantity} × {line.product.title}
                        </span>
                        {line.variant && (
                          <span
                            style={{
                              display: 'block',
                              fontFamily: SANS,
                              fontSize: '13.5px',
                              color: MUTED,
                              marginTop: '2px',
                            }}
                          >
                            {line.variant.name}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontFamily: SANS,
                          fontWeight: 600,
                          fontSize: '15px',
                          color: INK,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatPrice(line.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* No total until there is something to total — an empty configuration shows
                  the invitation above, not "kr 0". */}
              {chosen.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '16px',
                    paddingTop: '18px',
                  }}
                >
                  <span
                    style={{ fontFamily: SANS, fontWeight: 700, fontSize: '15px', color: INK }}
                  >
                    Totalt
                  </span>
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontWeight: 600,
                      fontSize: 'clamp(24px,2.4vw,30px)',
                      color: INK,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatPrice(total)}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddSolution}
                disabled={addableLines.length === 0}
                data-btn={addableLines.length === 0 ? undefined : true}
                style={{
                  ...primaryButton,
                  width: '100%',
                  marginTop: '18px',
                  paddingLeft: '24px',
                  paddingRight: '24px',
                  border: 'none',
                  cursor: addableLines.length === 0 ? 'not-allowed' : 'pointer',
                  background: addableLines.length === 0 ? '#c8c0b0' : OLIVE,
                }}
              >
                Legg løsningen i handlekurven
              </button>

              <p
                style={{
                  fontFamily: SANS,
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: MUTED,
                  margin: '14px 0 0',
                  textAlign: 'center',
                }}
              >
                Produktene legges i handlekurven som separate varelinjer.
              </p>
            </div>

            {/* Larger or tailored orders */}
            <div
              style={{
                marginTop: 'clamp(16px,2vw,22px)',
                padding: 'clamp(22px,2.6vw,28px)',
                background: '#fff',
                border: `1px solid ${BORDER_WARM}99`,
                borderRadius: '24px',
              }}
            >
              <h3
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: '16px',
                  color: INK,
                  margin: '0 0 10px',
                }}
              >
                {content.quoteHeading}
              </h3>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: '14.5px',
                  lineHeight: 1.65,
                  color: SOFT,
                  margin: '0 0 18px',
                }}
              >
                {content.quoteText}
              </p>
              <a
                href="#foresporsel"
                data-btn
                onClick={onQuoteRequest}
                className="w-full justify-center"
                style={{ ...secondaryButton, paddingLeft: '24px', paddingRight: '24px' }}
              >
                Be om tilbud
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
