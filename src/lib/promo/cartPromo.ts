/**
 * Client-side promo-code logic for the cart — deliberately free of React and of `fetch`.
 *
 * Everything that decides *what happens* lives here as pure functions and a reducer: how a
 * response is interpreted, when a stale answer must be ignored, when an applied code is
 * dropped versus kept, and which rows the summary shows. The hook and the component below it
 * only wire this to React.
 *
 * The one rule this module exists to enforce: **the client never computes a discount.** There
 * is no arithmetic here on `discountValue`, no percentage, no subtraction. Every figure shown
 * to the customer is a number the server sent back, copied through unchanged.
 */

import { resolvedLineRef } from '@/lib/cart/lineRef'

/** The trusted figures the endpoint returns. Display-only — never recomputed, never stored. */
export interface PromoTotals {
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  eligibleSubtotal: number
  discountAmount: number
  subtotalBeforeDiscount: number
  subtotalAfterDiscount: number
  shipping: number
  totalBeforeDiscount: number
  totalAfterDiscount: number
}

/** Minimal cart-line shape this module needs (the store's `CartItem` satisfies it). */
export interface PromoCartItem {
  /** Set for a variant line; absent for a product that has no variants. */
  variantId?: string
  /** Set for a variant-less line — its only identity. */
  productId?: string
  qty: number
}

/* ------------------------------ messages ------------------------------ */

export const PROMO_TEXT = {
  label: 'Rabattkode',
  placeholder: 'Skriv inn rabattkode',
  apply: 'Bruk kode',
  remove: 'Fjern',
  checking: 'Kontrollerer...',
  /** `Rabattkode WELCOME10 er aktivert` */
  applied: (code: string) => `Rabattkode ${code} er aktivert`,
  discountRow: (code: string) => `Rabatt ${code}`,
} as const

const GENERIC_UNVERIFIED = 'Vi fikk ikke bekreftet rabattkoden akkurat nå. Prøv igjen om litt.'
const GENERIC_INVALID = 'Rabattkoden kunne ikke brukes.'
const RATE_LIMITED = 'For mange forsøk. Prøv igjen om litt.'
const rateLimitedIn = (seconds: number) => `For mange forsøk. Prøv igjen om ${seconds} sekunder.`

/* ------------------------------ request ------------------------------ */

export interface PromoValidationRequestBody {
  code: string
  items: { variantId?: string; productId?: string; quantity: number }[]
  email?: string
}

/**
 * The exact body sent to the endpoint: the code, and one identifier plus a quantity per line.
 *
 * Built from scratch rather than by copying and deleting fields, so a price, name or total
 * on the cart item cannot leak into the request by accident — the store's `CartItem` carries
 * `price`, `colorName`, `colorImage` and `colorHex`, and none of them have a way in here.
 *
 * The identifier is the variant when the line has one, otherwise the product. A line with
 * neither is dropped: the server could not price it, and it cannot be bought either.
 */
export function buildValidationRequest(
  code: string,
  items: PromoCartItem[],
  email?: string | null,
): PromoValidationRequestBody {
  const body: PromoValidationRequestBody = {
    code: code.trim(),
    items: items
      .filter((item) => item.variantId || item.productId)
      .map((item) =>
        item.variantId
          ? { variantId: item.variantId, quantity: item.qty }
          : { productId: item.productId as string, quantity: item.qty },
      ),
  }
  // Only ever included when the surrounding flow genuinely has an email already; the cart
  // never asks for one, and none is stored for this purpose.
  if (email && email.trim()) body.email = email.trim()
  return body
}

/**
 * Stable fingerprint of what the cart contains. Two carts with the same lines and quantities
 * produce the same string regardless of line order, so reordering does not trigger a pointless
 * revalidation — but any quantity or membership change does.
 *
 * Lines are identified by reference, so a variant-less product is fingerprinted as itself
 * rather than collapsing onto `undefined:` together with every other such line.
 */
export function cartSignature(items: PromoCartItem[]): string {
  return items
    .map((item) => `${resolvedLineRef(item)}:${item.qty}`)
    .sort()
    .join('|')
}

/* ------------------------------ response ------------------------------ */

export type PromoOutcome =
  /** The code applies; `totals` is what to display. */
  | { kind: 'valid'; totals: PromoTotals }
  /** A real, final answer about the code — the applied code must be dropped. */
  | { kind: 'invalid'; message: string }
  /**
   * We could not get an answer (network, rate limit, our own error). The code string is
   * KEPT — the customer typed something that may well be fine, and throwing it away for a
   * transient failure would be wrong — but no discount is displayed, because none is trusted.
   */
  | { kind: 'unverified'; message: string; retryAfter?: number }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** Reads the success body, rejecting anything that is not a complete set of finite numbers. */
function readTotals(body: Record<string, unknown>): PromoTotals | null {
  const code = typeof body.code === 'string' ? body.code : null
  const discountType = body.discountType
  if (!code) return null
  if (discountType !== 'percentage' && discountType !== 'fixed') return null

  const fields = [
    'discountValue',
    'eligibleSubtotal',
    'discountAmount',
    'subtotalBeforeDiscount',
    'subtotalAfterDiscount',
    'shipping',
    'totalBeforeDiscount',
    'totalAfterDiscount',
  ] as const

  const values: Record<string, number> = {}
  for (const field of fields) {
    const value = num(body[field])
    if (value === null) return null
    values[field] = value
  }

  return { code, discountType, ...values } as PromoTotals
}

/**
 * Turns an HTTP status + parsed body into an outcome.
 *
 * The split that matters is *final answer* vs *no answer*:
 *   200 / 400 / 409 with `valid: false` → the code, or the cart, is genuinely wrong → invalid
 *   403 / 429 / 500 / 503 / anything odd → we never got a verdict           → unverified
 *
 * 403 counts as "no answer" on purpose: a rejected Origin is our configuration problem, and
 * blaming the customer's code for it would be a lie.
 *
 * Only messages the server produced (our own validator's Norwegian strings) are shown, and
 * only when they are non-empty strings; anything else falls back to a fixed message, so a
 * raw error can never reach the customer.
 */
export function interpretResponse(status: number, body: unknown): PromoOutcome {
  if (status === 429) {
    const retryAfter = isRecord(body) ? num(body.retryAfter) : null
    return retryAfter && retryAfter > 0
      ? { kind: 'unverified', message: rateLimitedIn(Math.ceil(retryAfter)), retryAfter }
      : { kind: 'unverified', message: RATE_LIMITED }
  }

  if (status === 403 || status >= 500) {
    return { kind: 'unverified', message: GENERIC_UNVERIFIED }
  }

  if (!isRecord(body)) return { kind: 'unverified', message: GENERIC_UNVERIFIED }

  if (status === 200 && body.valid === true) {
    const totals = readTotals(body)
    // A malformed success is treated as no answer rather than as a discount we cannot trust.
    return totals ? { kind: 'valid', totals } : { kind: 'unverified', message: GENERIC_UNVERIFIED }
  }

  if (body.valid === false) {
    const message =
      typeof body.message === 'string' && body.message.trim() ? body.message : GENERIC_INVALID
    return { kind: 'invalid', message }
  }

  return { kind: 'unverified', message: GENERIC_UNVERIFIED }
}

/** A failed `fetch` (offline, DNS, aborted connection). Never blames the code. */
export function networkOutcome(): PromoOutcome {
  return { kind: 'unverified', message: GENERIC_UNVERIFIED }
}

/* ------------------------------ state machine ------------------------------ */

export type PromoStatus = 'idle' | 'checking' | 'applied' | 'error' | 'unverified'

export interface PromoState {
  /** The applied code, or null. Mirrors what the store persists. */
  code: string | null
  status: PromoStatus
  /** Trusted server figures, present only while `status === 'applied'`. */
  totals: PromoTotals | null
  message: string | null
  /**
   * Id of the request this state is waiting for. A result carrying a different id is from a
   * superseded request and is discarded — that is the whole stale-response guard.
   */
  requestId: number
}

export const initialPromoState: PromoState = {
  code: null,
  status: 'idle',
  totals: null,
  message: null,
  requestId: 0,
}

/** State for a store that already has a persisted code but has not verified it yet. */
export function restoredPromoState(code: string | null): PromoState {
  return code ? { ...initialPromoState, code } : initialPromoState
}

export type PromoEvent =
  /** The customer pressed "Bruk kode" (or Enter). */
  | { type: 'submit'; code: string; requestId: number }
  /** The cart changed under an applied code. */
  | { type: 'revalidate'; requestId: number }
  | { type: 'result'; requestId: number; outcome: PromoOutcome }
  /** The customer pressed "Fjern". */
  | { type: 'remove' }
  /** The cart became empty. */
  | { type: 'cartEmptied' }

export function promoReducer(state: PromoState, event: PromoEvent): PromoState {
  switch (event.type) {
    case 'submit': {
      // A second click (or a held Enter key) while a check is in flight is ignored, so one
      // customer action can never produce two requests.
      if (state.status === 'checking') return state
      const code = event.code.trim()
      if (!code) return state
      return {
        code: state.code,
        status: 'checking',
        totals: state.totals,
        message: null,
        requestId: event.requestId,
      }
    }

    case 'revalidate': {
      // Unlike `submit`, this always supersedes: the cart really did change, so an in-flight
      // check is now answering the wrong question. Bumping requestId invalidates its result.
      if (!state.code) return state
      return { ...state, status: 'checking', message: null, requestId: event.requestId }
    }

    case 'result': {
      if (event.requestId !== state.requestId) return state // stale — a newer request won

      if (event.outcome.kind === 'valid') {
        return {
          code: event.outcome.totals.code,
          status: 'applied',
          totals: event.outcome.totals,
          message: null,
          requestId: state.requestId,
        }
      }

      if (event.outcome.kind === 'invalid') {
        // A final "no" — the code is dropped and the reason is shown.
        return {
          code: null,
          status: 'error',
          totals: null,
          message: event.outcome.message,
          requestId: state.requestId,
        }
      }

      // Unverified: keep the code, drop the totals. Nothing untrusted stays on screen, and a
      // transient failure never costs the customer their code.
      return {
        code: state.code,
        status: 'unverified',
        totals: null,
        message: event.outcome.message,
        requestId: state.requestId,
      }
    }

    case 'remove':
    case 'cartEmptied':
      // requestId is bumped so a result already in flight is discarded on arrival.
      return { ...initialPromoState, requestId: state.requestId + 1 }
  }
}

/* ------------------------------ summary rows ------------------------------ */

export interface SummaryRow {
  key: 'subtotal' | 'discount' | 'shipping' | 'total'
  label: string
  /** Amount in kroner. Negative on the discount row. */
  value: number
  /** Shipping only: render the word "Gratis" instead of an amount. */
  free?: boolean
}

/**
 * The order-summary rows.
 *
 * Without a promo code the rows are exactly what the cart showed before — same labels, same
 * values, same order — so an ordinary cart is untouched.
 *
 * With one applied, every figure comes from the server response, including the subtotal and
 * shipping: those were computed from live catalogue prices, so if a price changed since the
 * cart was filled, the customer sees the real numbers rather than the stale local ones.
 */
export function buildSummaryRows(
  local: { subtotal: number; shipping: number; total: number },
  promo: PromoTotals | null,
): SummaryRow[] {
  if (!promo) {
    return [
      { key: 'subtotal', label: 'Delsum', value: local.subtotal },
      { key: 'shipping', label: 'Frakt', value: local.shipping, free: local.shipping === 0 },
      { key: 'total', label: 'Totalt', value: local.total },
    ]
  }

  return [
    { key: 'subtotal', label: 'Delsum', value: promo.subtotalBeforeDiscount },
    {
      key: 'discount',
      label: PROMO_TEXT.discountRow(promo.code),
      value: -promo.discountAmount,
    },
    { key: 'shipping', label: 'Frakt', value: promo.shipping, free: promo.shipping === 0 },
    { key: 'total', label: 'Totalt', value: promo.totalAfterDiscount },
  ]
}

/* ------------------------------ misc ------------------------------ */

/**
 * Enter applies the code; every other key is ordinary typing.
 *
 * The field is not wrapped in a `<form>`, so Enter is handled explicitly — which also means
 * the behaviour is our own code and can be unit-tested rather than left to the browser.
 */
export function shouldSubmitOnKey(key: string): boolean {
  return key === 'Enter'
}

/**
 * Whether a revalidation is due.
 *
 * `lastCheckedKey` is the `code|signature` pair the last completed request covered. Comparing
 * against it is what stops an endless loop: a result changes neither the code nor the cart,
 * so the key is unchanged and no further request is triggered.
 */
export function promoCheckKey(code: string | null, signature: string): string | null {
  return code ? `${code}|${signature}` : null
}

/* ------------------------------ compact (drawer) presentation ------------------------------ */

/**
 * The wording the slide-out cart uses.
 *
 * Separate from `PROMO_TEXT` only because the drawer's row is a *disclosure* rather than a
 * labelled field: it has a trigger line, and the shorter `Rabattkode` / `Bruk` read better in
 * a 440px panel. Nothing about the cart page's wording changes — `PROMO_TEXT` is untouched,
 * and both variants drive the very same state machine above.
 */
export const PROMO_COMPACT_TEXT = {
  /** The collapsed row. Reads as a link, behaves as a disclosure button. */
  trigger: 'Har du en rabattkode?',
  placeholder: 'Rabattkode',
  apply: 'Bruk',
  checking: PROMO_TEXT.checking,
  remove: PROMO_TEXT.remove,
  /** `Rabattkode: WELCOME10` */
  applied: (code: string) => `Rabattkode: ${code}`,
  /** Confirmation beneath the applied row. */
  appliedNote: 'Rabatten er trukket fra.',
} as const

/** What the disclosure shows. */
export type PromoDisclosureView = 'collapsed' | 'expanded' | 'applied'

/**
 * Which of the three the compact row is in.
 *
 * Pure on purpose: the only state the component itself owns is `toggled` (has the customer
 * pressed the trigger), and every other reason to be open is derived from the shared promo
 * state. That is what makes the field re-open by itself when a code is rejected — collapsing
 * an error out of sight would hide the only explanation the customer gets.
 *
 * `applied` wins over everything: there is nothing left to type.
 */
export function promoDisclosureView(input: {
  toggled: boolean
  status: PromoStatus
  code: string | null
  message: string | null
}): PromoDisclosureView {
  if (input.status === 'applied' && input.code) return 'applied'
  if (input.toggled) return 'expanded'
  if (input.status === 'checking') return 'expanded'
  // An error or an "we could not check it" message keeps the field open under it.
  if (input.message) return 'expanded'
  return 'collapsed'
}

/**
 * Submitting the compact field, including what has to happen to the keyboard.
 *
 * Split out of the component for the same reason everything else in this file is: the rule
 * is "a real submission dismisses the keyboard, a no-op does not", and that is worth pinning
 * down rather than leaving in a click handler.
 *
 * The dismissal happens as the request goes out, not when it comes back. Neither outcome is
 * known at this point and neither should matter: whether the server accepts the code or
 * rejects it, the customer is done typing, and leaving the field focused on a phone leaves
 * the keyboard covering the summary they are waiting to see change.
 *
 * Returns whether anything was submitted, so a caller can tell a real click from a dead one.
 */
export function submitPromoCode(
  input: { draft: string; busy: boolean },
  effects: { apply: (code: string) => void; dismissKeyboard: () => void },
): boolean {
  // A second press while a check is running is already ignored by the reducer; stopping here
  // as well means it cannot steal the keyboard away from a customer who is still correcting
  // a code.
  if (input.busy) return false
  if (input.draft.trim() === '') return false

  effects.apply(input.draft)
  effects.dismissKeyboard()
  return true
}

/**
 * Font size for the promo input, in px. Both variants, and never below 16.
 *
 * This is a functional requirement, not a stylistic one: iOS Safari zooms the page into any
 * input whose computed font-size is under 16px, and it does not zoom back out on blur. In the
 * drawer that left a `min(440px, 100vw)` panel's right edge — «Bruk», «Fjern», the amounts —
 * cut off the visual viewport, with no way back except pinching; on /handlekurv it left the
 * whole page zoomed and pannable after a code was applied. Same cause, same fix.
 *
 * Nothing in globals.css, Tailwind's preflight or any CSS module sets a font-size on an input,
 * and these are applied inline — so what is here is the computed size. Vertical padding is
 * trimmed alongside them so neither field's height changes.
 *
 * Kept as two entries rather than one number because they are two fields with two designs;
 * the floor is what they share, and `IOS_NO_ZOOM_MIN_FONT_PX` is what states it.
 */
export const PROMO_INPUT_FONT_PX = { panel: 16, compact: 16 } as const

/** Below this, iOS Safari zooms the page on focus. */
export const IOS_NO_ZOOM_MIN_FONT_PX = 16
