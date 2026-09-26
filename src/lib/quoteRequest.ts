/**
 * The «Be om tilbud» offer that appears once a line reaches its product's quote threshold.
 *
 * Quote eligibility is decided in @/lib/quantityPricing and nowhere else; this module is only
 * about what the customer is shown and where the button takes them. The two are kept apart on
 * purpose — a threshold is a pricing-table fact, a CTA is a page.
 *
 * ── It does not replace the checkout ──
 *
 * Reaching the threshold changes nothing about the order: the published price still applies,
 * the line still counts towards the subtotal and towards free shipping, and «Gå til kassen»
 * is exactly where it was. The customer simply now has two ways to buy, and picks one.
 *
 * ── It reuses the existing B2B enquiry ──
 *
 * There is no new form, no new endpoint and no new inbox. The link lands on the inquiry form
 * that already exists on /bedrifter (`#tilbud`, posting to /api/bedrifter/foresporsel) with
 * the product and the quantity carried across, so the customer does not retype what they were
 * already looking at. On a solution page, which has its own copy of that same form, the CTA
 * stays on the page and presets it directly.
 *
 * ── Why the link carries a slug and a number, not a message ──
 *
 * The parameters are structured, and the sentence is rebuilt from them at the far end against
 * the live catalogue. Nothing that arrives in the URL is ever put into the form verbatim, so a
 * link cannot be crafted that opens the form with someone else's words already typed into it.
 */

import { formatPrice } from './format'
import {
  getLineTotal,
  getUnitPrice,
  quoteThresholdFor,
  type QuantityPricedProduct,
} from './quantityPricing'

/** The wording, in one place, so every surface offers the same thing. */
export const QUOTE_TEXT = {
  cta: 'Be om tilbud',
  heading: 'Bestiller du flere?',
  /** The short explanation under the CTA. Named quantity, so it is never vague. */
  explanation: (threshold: number) =>
    `Bestiller du ${threshold} eller flere? Kontakt oss for et skreddersydd tilbud – vi kan tilby egne priser ved større bestillinger.`,
  /** Reassurance that the CTA is an addition, not a detour. */
  note: 'Du kan fortsatt fullføre kjøpet til prisen over.',
} as const

/** What a surface knows about the line it is offering a quote on. */
export interface QuoteRequestContext {
  /** Payload slug — how the far end identifies the product again. */
  productSlug: string
  /** The product's name as the customer just saw it. */
  productTitle: string
  quantity: number
  /** The published unit price at that quantity, in kroner. */
  unitPrice: number
  /** quantity × unitPrice, in kroner. */
  lineTotal: number
}

/**
 * The context for one product at one quantity, priced by the shared engine.
 *
 * Callers pass the product and the quantity they are displaying; the price and the line total
 * come from @/lib/quantityPricing, so a quote request can never quote a figure the page did
 * not show.
 */
export function quoteContextFor(
  product: QuantityPricedProduct & { title: string },
  quantity: number,
): QuoteRequestContext {
  return {
    productSlug: product.slug,
    productTitle: product.title,
    quantity,
    unitPrice: getUnitPrice(product, quantity),
    lineTotal: getLineTotal(product, quantity),
  }
}

/** Query-parameter names. Norwegian, because the URL is customer-visible. */
export const QUOTE_PARAM = { product: 'produkt', quantity: 'antall' } as const

/** Where /bedrifter's inquiry form lives. */
export const QUOTE_ANCHOR = 'tilbud'

/**
 * The link a «Be om tilbud» button points at when the form is on another page.
 *
 * A real href, so a middle click and a typed URL both work; a page that has the form already
 * takes the click over itself instead and never navigates.
 */
export function quoteRequestHref(context: Pick<QuoteRequestContext, 'productSlug' | 'quantity'>): string {
  const params = new URLSearchParams({
    [QUOTE_PARAM.product]: context.productSlug,
    [QUOTE_PARAM.quantity]: String(Math.max(1, Math.floor(context.quantity))),
  })
  return `/bedrifter?${params.toString()}#${QUOTE_ANCHOR}`
}

/** A product and a quantity read back off a URL, or null when it carries neither usably. */
export interface QuoteRequestParams {
  productSlug: string
  quantity: number
}

/**
 * Reads the two parameters back.
 *
 * Deliberately strict, and the same strictness `parseQuantityParam` applies on the solution
 * pages: only a plain run of digits is a quantity, and a slug is only accepted in the shape
 * slugs actually take. Anything else means the link says nothing and the form opens as it
 * always did.
 */
export function readQuoteRequestParams(search: string): QuoteRequestParams | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }

  const slug = (params.get(QUOTE_PARAM.product) ?? '').trim()
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null

  const raw = (params.get(QUOTE_PARAM.quantity) ?? '').trim()
  if (!/^\d{1,6}$/.test(raw)) return null
  const quantity = Number.parseInt(raw, 10)
  if (quantity < 1) return null

  return { productSlug: slug, quantity }
}

/**
 * The sentence the inquiry form's message field is prefilled with.
 *
 * It names everything the recipient needs to answer without a second e-mail: the product, how
 * many, and what that currently comes to at the published price — which is also what makes it
 * obvious to the customer that the quote is about the very line they were looking at.
 */
export function quoteRequestMessage(context: QuoteRequestContext): string {
  return (
    `Vi ønsker et tilbud på ${context.quantity} stk. ${context.productTitle}. ` +
    `Publisert pris er ${formatPrice(context.unitPrice)} per stk. ` +
    `(${formatPrice(context.lineTotal)} totalt).`
  )
}

/** The approximate-quantity field on the inquiry form, prefilled from the same context. */
export function quoteRequestQuantityField(context: QuoteRequestContext): string {
  return String(context.quantity)
}

/**
 * The explanation shown beside a CTA, for a product whose threshold has been reached.
 * Returns null for a product that has no threshold, so a caller cannot show a quote offer
 * that the pricing engine does not actually make.
 */
export function quoteExplanationFor(
  product: Pick<QuantityPricedProduct, 'slug'>,
): string | null {
  const threshold = quoteThresholdFor(product)
  return threshold === null ? null : QUOTE_TEXT.explanation(threshold)
}
