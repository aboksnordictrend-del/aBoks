import type { Payload } from 'payload'
import { getEffectivePrice } from './pricing'
import { formatVariantDisplayName } from '@/collections/hooks/variantDisplayName'
import { lineRefFor, parseLineRef } from './cart/lineRef'
import { canFulfil, productStock } from './stock'

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

/**
 * What the client is allowed to send: an identifier and a count. Nothing else.
 *
 * Exactly one identifier per line, and which one says what kind of line it is:
 *   `variantId` — a product that has colour variants; the variant is the thing being bought
 *   `productId` — a product with no variants at all (a battery multipack, say)
 *
 * A line carrying both is read as a variant line: a variant always wins, and its parent
 * product's own stock is irrelevant. See @/lib/cart/lineRef and @/lib/stock.
 */
export interface CartLineInput {
  variantId?: string | number | null
  productId?: string | number | null
  quantity: number
}

/** One fully-resolved line. All money is authoritative, none of it came from the client. */
export interface PricedLine {
  /**
   * Variant id, or null when the product has no variants. Null is a real answer here, not a
   * missing one — it is what distinguishes the two kinds of line everywhere downstream.
   */
  variantId: string | null
  /** Parent product id — the unit promo-code product restrictions match on. */
  productId: string
  /** Snapshot name, resolved with the same rule the order snapshot uses. */
  displayName: string
  /** Colour / variant label ("Mørk blå"). Empty for a product with no variants. */
  variantName: string
  quantity: number
  unitPriceOere: number
  lineTotalOere: number
  unitPriceKr: number
  lineTotalKr: number
  /**
   * Current stock from this line's own authoritative source — the variant's `inventory` for a
   * variant line, the product's `stock` for a variant-less one. Null means nothing is stored.
   * See the availability note on `priceCart` for what is and is not enforced.
   */
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
  /**
   * A line was sent as a bare product, but that product does have variants — so there is a
   * colour to choose and no single stock figure to sell from. A cart saved before a product
   * gained its first variant, or a tampered request trying to buy past `products.stock`.
   */
  | 'variant_required'
  /** A variant-less line asked for more units than `products.stock` has. */
  | 'insufficient_stock'
  | 'lookup_failed'

export type CartPricingResult =
  | { ok: true; cart: PricedCart }
  | {
      ok: false
      reason: CartPricingFailureReason
      message: string
      /** The offending line's reference, when one specific line caused the failure. */
      ref?: string
    }

const FAILURE_MESSAGE: Record<CartPricingFailureReason, string> = {
  cart_empty: 'Handlekurven er tom.',
  invalid_line: 'Handlekurven inneholder en ugyldig linje.',
  invalid_quantity: 'Ugyldig antall i handlekurven.',
  variant_not_found: 'Et produkt i handlekurven finnes ikke lenger.',
  product_not_found: 'Et produkt i handlekurven finnes ikke lenger.',
  product_unavailable: 'Et produkt i handlekurven er ikke tilgjengelig lenger.',
  invalid_price: 'Vi klarte ikke å hente prisen på et produkt i handlekurven.',
  variant_required: 'Et produkt i handlekurven må velges på nytt. Åpne produktsiden og legg det i kurven igjen.',
  insufficient_stock: 'Vi har ikke nok på lager av et produkt i handlekurven. Reduser antallet og prøv igjen.',
  lookup_failed: 'Vi klarte ikke å hente handlekurven akkurat nå. Prøv igjen.',
}

function fail(reason: CartPricingFailureReason, ref?: string): CartPricingResult {
  return { ok: false, reason, message: FAILURE_MESSAGE[reason], ...(ref ? { ref } : {}) }
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
  /** Only ever read for a product that has no variants — see @/lib/stock. */
  stock?: number | null
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

/** One normalised, deduplicated request line, before the catalogue has been consulted. */
interface WantedLine {
  /** `"12"` for a variant line, `"product-34"` for a variant-less one. */
  ref: string
  variantId: string | null
  /** Known up front only for a product line; a variant line learns it from its variant. */
  productId: string | null
  quantity: number
}

/**
 * How many variant rows one bounded lookup will read when checking whether the products in a
 * product-only line really have none. A product has a handful of colours; this is a ceiling
 * on abuse, not a business limit.
 */
const VARIANT_EXISTENCE_LOOKUP_LIMIT = 200

/**
 * Prices a cart from the catalogue.
 *
 * Bounded queries — never one per line: the variants, then their parent products (together
 * with any product asked for directly), then, only when the cart contains a variant-less
 * line, one existence check for variants of those products. Returns a discriminated result
 * instead of throwing, so every caller has to deal with a stale cart.
 *
 * ── Availability ──
 *
 * An unpublished product is rejected, because it is no longer for sale.
 *
 * Stock is enforced for a **variant-less** line: those are sold from `products.stock`, and a
 * cart is allowed to hold more than exists only for as long as nobody tries to pay. Asking to
 * buy 3 of a product with 2 left fails here — before Kustom is called and before an order
 * number is burned — which is what keeps `products.stock` from going negative.
 *
 * Stock is still only *reported* for a **variant** line (`inventory`), unchanged: blocking a
 * low-stock variant cart at checkout is a sales decision the shop has already made the other
 * way, and changing it here would change the behaviour of every existing aBoks product.
 */
export async function priceCart(
  payload: Payload,
  lines: CartLineInput[],
): Promise<CartPricingResult> {
  if (!Array.isArray(lines) || lines.length === 0) return fail('cart_empty')

  // Normalise and validate the input before touching the database.
  const wanted: WantedLine[] = []
  for (const line of lines) {
    if (!line || typeof line !== 'object') return fail('invalid_line')

    // One reference per line, whichever identifier the client sent. A variant always wins.
    const ref = lineRefFor(line)
    const parsed = ref ? parseLineRef(ref) : null
    if (!ref || !parsed) return fail('invalid_line')

    if (!isValidQuantity(line.quantity)) return fail('invalid_quantity', ref)

    // A repeated line is merged rather than rejected — two entries for the same thing are a
    // client bug, not an attack, and merging keeps the discount base and the stock check
    // honest (3 + 2 of the same product is a request for 5, not two requests for 3 and 2).
    const existing = wanted.find((w) => w.ref === ref)
    if (existing) {
      const merged = existing.quantity + line.quantity
      if (!isValidQuantity(merged)) return fail('invalid_quantity', ref)
      existing.quantity = merged
    } else {
      wanted.push({
        ref,
        variantId: parsed.kind === 'variant' ? parsed.variantId : null,
        productId: parsed.kind === 'product' ? parsed.productId : null,
        quantity: line.quantity,
      })
    }
  }

  const wantedVariantIds = wanted.map((w) => w.variantId).filter((id): id is string => id !== null)
  // Products asked for by id — i.e. the lines that claim to have no variant to buy.
  const wantedProductIds = wanted.map((w) => w.productId).filter((id): id is string => id !== null)

  let variantDocs: VariantDoc[]
  let productDocs: ProductDoc[]
  /** Of the directly-requested products, those that turn out to have variants after all. */
  let productsWithVariants: Set<string>
  try {
    if (wantedVariantIds.length > 0) {
      const variantResult = await payload.find({
        collection: 'product-variants',
        where: { id: { in: wantedVariantIds } },
        limit: wantedVariantIds.length,
        depth: 0,
        overrideAccess: true,
      })
      variantDocs = variantResult.docs as unknown as VariantDoc[]
    } else {
      variantDocs = []
    }

    const productIds = [
      ...new Set([
        ...variantDocs.map((v) => relId(v.product)).filter((id): id is string => Boolean(id)),
        ...wantedProductIds,
      ]),
    ]
    if (productIds.length === 0) {
      // Nothing to look up — every variant was either missing or orphaned. Skip the second
      // query and let the per-line loop below report precisely which of the two it was;
      // failing here would blame the product for a variant that simply no longer exists.
      productDocs = []
    } else {
      const productResult = await payload.find({
        collection: 'products',
        where: { id: { in: productIds } },
        limit: productIds.length,
        depth: 0,
        overrideAccess: true,
      })
      productDocs = productResult.docs as unknown as ProductDoc[]
    }

    // Only a cart containing a variant-less line pays for this query, and a cart of ordinary
    // aBoks products never reaches it. It is what makes the rule impossible to bypass: a
    // request naming a product that *does* have variants cannot buy against `products.stock`.
    productsWithVariants = new Set<string>()
    if (wantedProductIds.length > 0) {
      const existing = await payload.find({
        collection: 'product-variants',
        where: { product: { in: wantedProductIds } },
        limit: VARIANT_EXISTENCE_LOOKUP_LIMIT,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of existing.docs as unknown as VariantDoc[]) {
        const parentId = relId(doc.product)
        if (parentId) productsWithVariants.add(parentId)
      }
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

  for (const line of wanted) {
    const { ref, quantity } = line

    // ── Resolve the line to a variant (or none) and its parent product ──
    let variant: VariantDoc | null = null
    let productId: string

    if (line.variantId !== null) {
      variant = variantById.get(line.variantId) ?? null
      if (!variant) return fail('variant_not_found', ref)

      const parentId = relId(variant.product)
      if (!parentId) return fail('product_not_found', ref)
      productId = parentId
    } else {
      // A bare product line. It is only legitimate when the product genuinely has no
      // variants; otherwise there is a colour to choose and a variant to sell from.
      productId = line.productId as string
      if (productsWithVariants.has(productId)) return fail('variant_required', ref)
    }

    const product = productById.get(productId)
    if (!product) return fail('product_not_found', ref)

    // `published` is a checkbox that reads as null on rows predating the column; only an
    // explicit `false` means "taken out of the shop".
    if (product.published === false) return fail('product_unavailable', ref)

    if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) {
      return fail('invalid_price', ref)
    }

    // Stock, from this line's own source. Enforced only for a variant-less line — see the
    // availability note in this function's header.
    const inventory = variant
      ? typeof variant.inventory === 'number'
        ? variant.inventory
        : null
      : typeof product.stock === 'number'
        ? product.stock
        : null
    if (!variant && !canFulfil(productStock(product), quantity)) {
      return fail('insufficient_stock', ref)
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
      variantId: line.variantId,
      productId,
      // A variant-less line has no colour to fold in, so its name is the product's own title
      // — the same string `resolveLineDisplayName` freezes onto the order for such a line.
      displayName: variant ? resolveDisplayName(variant, product) : (product.title?.trim() ?? ''),
      variantName: variant?.name?.trim() ?? '',
      quantity,
      unitPriceOere,
      lineTotalOere,
      unitPriceKr: oereToKr(unitPriceOere),
      lineTotalKr: oereToKr(lineTotalOere),
      inventory,
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
