import type { Payload } from 'payload'
import { getEffectivePrice } from './pricing'
import { formatVariantDisplayName } from '@/collections/hooks/variantDisplayName'

/**
 * Trusted, server-side pricing of a cart.
 *
 * The browser sends nothing but variant ids and quantities. Every price, name and total is
 * re-read from the catalogue here, so a tampered `price` in localStorage — the cart store is
 * a persisted zustand store, entirely under the customer's control — cannot influence what
 * is charged, what a promo code is calculated from, or what is stored on the order.
 *
 * This is the one place cart money is computed. The promo validator, the Kustom order lines
 * and the stored order snapshot are all meant to be derived from a single `PricedCart`, so
 * they can never disagree with each other.
 *
 * ── Money representation ──
 * Everything is computed in **integer øre** and only converted to kroner at the edges. The
 * rest of the project stores decimal kroner (Orders.unitPrice, subtotal, total …) and Kustom
 * wants øre, so both are returned: the `*Oere` fields are the arithmetic truth, the kroner
 * fields are the snapshot to store and display. No sum is ever accumulated in floating point.
 */

/** Shipping the customer pays when the cart is under the free-shipping threshold. */
export const SHIPPING_COST_KR = 69
/** Goods subtotal (BEFORE any promo discount) at which shipping becomes free. */
export const FREE_SHIPPING_THRESHOLD_KR = 650

export const SHIPPING_COST_OERE = SHIPPING_COST_KR * 100
export const FREE_SHIPPING_THRESHOLD_OERE = FREE_SHIPPING_THRESHOLD_KR * 100

/** Kroner → øre. The single rounding step between the catalogue and all arithmetic. */
export function toOere(kr: number): number {
  return Math.round(kr * 100)
}

/** Øre → kroner. Exact for any integer øre value (no 0.1 + 0.2 drift). */
export function oereToKr(oere: number): number {
  return oere / 100
}

/** Maximum quantity for a single line — mirrors the cart's own +/- clamp. */
export const MAX_LINE_QUANTITY = 99

/** What the client is allowed to send: an identifier and a count. Nothing else. */
export interface CartLineInput {
  variantId: string | number
  quantity: number
}

/** One fully-resolved line. All money is authoritative, none of it came from the client. */
export interface PricedLine {
  variantId: string
  /** Parent product id — the unit promo-code product restrictions match on. */
  productId: string
  /** Snapshot name, resolved with the same rule the order snapshot uses. */
  displayName: string
  /** Colour / variant label ("Mørk blå"). */
  variantName: string
  quantity: number
  unitPriceOere: number
  lineTotalOere: number
  unitPriceKr: number
  lineTotalKr: number
  /** Current stock, for a later availability decision. Not enforced here — see below. */
  inventory: number | null
}

/** The canonical cart result. Shipping and totals are pre-discount by definition. */
export interface PricedCart {
  lines: PricedLine[]
  subtotalOere: number
  shippingOere: number
  totalOere: number
  subtotalKr: number
  shippingKr: number
  totalKr: number
  /** True when the subtotal reached the free-shipping threshold. */
  freeShipping: boolean
}

export type CartPricingFailureReason =
  | 'cart_empty'
  | 'invalid_line'
  | 'invalid_quantity'
  | 'variant_not_found'
  | 'product_not_found'
  | 'product_unavailable'
  | 'invalid_price'
  | 'lookup_failed'

export type CartPricingResult =
  | { ok: true; cart: PricedCart }
  | {
      ok: false
      reason: CartPricingFailureReason
      message: string
      /** The offending line, when one specific line caused the failure. */
      variantId?: string
    }

const FAILURE_MESSAGE: Record<CartPricingFailureReason, string> = {
  cart_empty: 'Handlekurven er tom.',
  invalid_line: 'Handlekurven inneholder en ugyldig linje.',
  invalid_quantity: 'Ugyldig antall i handlekurven.',
  variant_not_found: 'Et produkt i handlekurven finnes ikke lenger.',
  product_not_found: 'Et produkt i handlekurven finnes ikke lenger.',
  product_unavailable: 'Et produkt i handlekurven er ikke tilgjengelig lenger.',
  invalid_price: 'Vi klarte ikke å hente prisen på et produkt i handlekurven.',
  lookup_failed: 'Vi klarte ikke å hente handlekurven akkurat nå. Prøv igjen.',
}

function fail(reason: CartPricingFailureReason, variantId?: string): CartPricingResult {
  return { ok: false, reason, message: FAILURE_MESSAGE[reason], ...(variantId ? { variantId } : {}) }
}

/** Minimal shapes read from the catalogue — deliberately narrower than the generated types. */
type VariantDoc = {
  id: number | string
  product?: number | string | { id: number | string } | null
  name?: string | null
  displayName?: string | null
  inventory?: number | null
}

type ProductDoc = {
  id: number | string
  title?: string | null
  price?: number | null
  published?: boolean | null
  salePrice?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
}

function relId(rel: VariantDoc['product']): string | null {
  if (rel == null) return null
  if (typeof rel === 'object') return rel.id != null ? String(rel.id) : null
  return String(rel)
}

/**
 * The name the customer will see for this line.
 *
 * Same preference order as the order snapshot (`resolveLineDisplayName`): the variant's own
 * Visningsnavn first — that is literally what the admin panel shows — then product title +
 * colour rebuilt with the shared formatter, then the title alone. Reimplemented here against
 * the local doc shapes rather than imported, because the snapshot version is typed for order
 * lines; the *rule* lives in one place (`formatVariantDisplayName`) and is shared.
 */
function resolveDisplayName(variant: VariantDoc, product: ProductDoc): string {
  const fromVariant = variant.displayName?.trim()
  if (fromVariant) return fromVariant

  const title = product.title?.trim()
  const colorName = variant.name?.trim()
  if (title && colorName) return formatVariantDisplayName(title, colorName)
  if (title) return title
  return colorName ?? ''
}

/** A whole number in [1, MAX_LINE_QUANTITY]. Rejects NaN, 0, negatives and fractions. */
function isValidQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_LINE_QUANTITY
  )
}

/**
 * Shipping for a given goods subtotal.
 *
 * Deliberately takes the subtotal **before** any promo discount: a promo code must never
 * push an order back under the free-shipping threshold, and must never buy free shipping
 * either. This preserves exactly the rule the cart and the current checkout already apply.
 */
export function shippingForSubtotalOere(subtotalOere: number): number {
  return subtotalOere >= FREE_SHIPPING_THRESHOLD_OERE ? 0 : SHIPPING_COST_OERE
}

/**
 * Prices a cart from the catalogue.
 *
 * Two bounded queries (variants, then their parent products) — never one per line. Returns a
 * discriminated result instead of throwing, so every caller has to deal with a stale cart.
 *
 * Availability: an unpublished product is rejected, because it is no longer for sale. Stock
 * is *reported* (`inventory`) but not enforced — the current checkout does not block on it
 * either, and turning a low-stock cart into a hard failure is a sales decision, not a
 * pricing one.
 */
export async function priceCart(
  payload: Payload,
  lines: CartLineInput[],
): Promise<CartPricingResult> {
  if (!Array.isArray(lines) || lines.length === 0) return fail('cart_empty')

  // Normalise and validate the input before touching the database.
  const wanted: { variantId: string; quantity: number }[] = []
  for (const line of lines) {
    if (!line || typeof line !== 'object') return fail('invalid_line')

    const variantId = line.variantId != null ? String(line.variantId).trim() : ''
    if (!variantId) return fail('invalid_line')

    if (!isValidQuantity(line.quantity)) return fail('invalid_quantity', variantId)

    // A repeated variant is merged rather than rejected — two entries for the same variant
    // are a client bug, not an attack, and merging keeps the discount base honest.
    const existing = wanted.find((w) => w.variantId === variantId)
    if (existing) {
      const merged = existing.quantity + line.quantity
      if (!isValidQuantity(merged)) return fail('invalid_quantity', variantId)
      existing.quantity = merged
    } else {
      wanted.push({ variantId, quantity: line.quantity })
    }
  }

  let variantDocs: VariantDoc[]
  let productDocs: ProductDoc[]
  try {
    const variantResult = await payload.find({
      collection: 'product-variants',
      where: { id: { in: wanted.map((w) => w.variantId) } },
      limit: wanted.length,
      depth: 0,
      overrideAccess: true,
    })
    variantDocs = variantResult.docs as unknown as VariantDoc[]

    const productIds = [...new Set(variantDocs.map((v) => relId(v.product)).filter(Boolean))]
    if (productIds.length === 0) {
      // Nothing to look up — every variant was either missing or orphaned. Skip the second
      // query and let the per-line loop below report precisely which of the two it was;
      // failing here would blame the product for a variant that simply no longer exists.
      productDocs = []
    } else {
      const productResult = await payload.find({
        collection: 'products',
        where: { id: { in: productIds as string[] } },
        limit: productIds.length,
        depth: 0,
        overrideAccess: true,
      })
      productDocs = productResult.docs as unknown as ProductDoc[]
    }
  } catch (err) {
    payload.logger?.error?.(
      `[cartPricing] catalogue lookup failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return fail('lookup_failed')
  }

  const variantById = new Map(variantDocs.map((v) => [String(v.id), v]))
  const productById = new Map(productDocs.map((p) => [String(p.id), p]))

  const priced: PricedLine[] = []
  let subtotalOere = 0

  for (const { variantId, quantity } of wanted) {
    const variant = variantById.get(variantId)
    if (!variant) return fail('variant_not_found', variantId)

    const productId = relId(variant.product)
    if (!productId) return fail('product_not_found', variantId)

    const product = productById.get(productId)
    if (!product) return fail('product_not_found', variantId)

    // `published` is a checkbox that reads as null on rows predating the column; only an
    // explicit `false` means "taken out of the shop".
    if (product.published === false) return fail('product_unavailable', variantId)

    if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) {
      return fail('invalid_price', variantId)
    }

    // Sale handling stays in the existing shared rule — sale window, sale-must-be-lower and
    // all — so the cart, the product page and checkout can never disagree about the price.
    const effectiveKr = getEffectivePrice(product.price, {
      salePrice: product.salePrice,
      saleStartDate: product.saleStartDate,
      saleEndDate: product.saleEndDate,
    })

    const unitPriceOere = toOere(effectiveKr)
    const lineTotalOere = unitPriceOere * quantity
    subtotalOere += lineTotalOere

    priced.push({
      variantId,
      productId,
      displayName: resolveDisplayName(variant, product),
      variantName: variant.name?.trim() ?? '',
      quantity,
      unitPriceOere,
      lineTotalOere,
      unitPriceKr: oereToKr(unitPriceOere),
      lineTotalKr: oereToKr(lineTotalOere),
      inventory: typeof variant.inventory === 'number' ? variant.inventory : null,
    })
  }

  const shippingOere = shippingForSubtotalOere(subtotalOere)
  const totalOere = subtotalOere + shippingOere

  return {
    ok: true,
    cart: {
      lines: priced,
      subtotalOere,
      shippingOere,
      totalOere,
      subtotalKr: oereToKr(subtotalOere),
      shippingKr: oereToKr(shippingOere),
      totalKr: oereToKr(totalOere),
      freeShipping: shippingOere === 0,
    },
  }
}
