import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { PromoDisclosureRow } from './PromoCodeDisclosure'
import PromoCodeField from './PromoCodeField'
import type { UsePromoCodeResult } from '@/lib/promo/usePromoCode'
import { IOS_NO_ZOOM_MIN_FONT_PX } from '@/lib/promo/cartPromo'
import type { PromoDisclosureView, PromoTotals } from '@/lib/promo/cartPromo'

/**
 * What the slide-out cart's promo row actually prints, in each of its three states.
 *
 * `PromoDisclosureRow` is rendered rather than `PromoCodeDisclosure` for the same reason
 * `PayoutModalBody` is rendered rather than its button: the open/closed decision is the pure
 * `promoDisclosureView` (asserted in src/lib/promo/cartPromo.test.ts, including that pressing
 * the trigger opens the field), and everything left here is markup. Rendering the drawer
 * itself is not possible — a zustand-persisted store reports its empty initial state to the
 * server renderer, so the panel would always draw an empty cart.
 */

const TOTALS: PromoTotals = {
  code: 'SOMMER20',
  discountType: 'percentage',
  discountValue: 20,
  eligibleSubtotal: 449,
  discountAmount: 89.8,
  subtotalBeforeDiscount: 449,
  subtotalAfterDiscount: 359.2,
  shipping: 69,
  totalBeforeDiscount: 518,
  totalAfterDiscount: 428.2,
}

const noop = () => {}

function promo(overrides: Partial<UsePromoCodeResult> = {}): UsePromoCodeResult {
  return {
    status: 'idle',
    code: null,
    totals: null,
    message: null,
    busy: false,
    apply: noop,
    remove: noop,
    ...overrides,
  }
}

const row = (view: PromoDisclosureView, state: UsePromoCodeResult): string =>
  renderToStaticMarkup(<PromoDisclosureRow view={view} promo={state} onToggle={noop} />)

/** The number of `<input>` elements in the markup — the field is either there or it is not. */
const inputs = (html: string): number => (html.match(/<input/g) ?? []).length

describe('drawer promo row — collapsed', () => {
  it('is the «Har du en rabattkode?» line and nothing else', () => {
    const html = row('collapsed', promo())
    assert.match(html, /Har du en rabattkode\?/)
    assert.equal(inputs(html), 0, 'a collapsed row must not cost the footer a field')
    assert.match(html, /aria-expanded="false"/)
  })

  it('is a button, so it is reachable by keyboard inside the drawer', () => {
    assert.match(row('collapsed', promo()), /<button type="button"/)
  })
})

describe('drawer promo row — expanded', () => {
  it('shows the field and the Bruk button on one line', () => {
    const html = row('expanded', promo())
    assert.equal(inputs(html), 1)
    assert.match(html, /placeholder="Rabattkode"/)
    assert.match(html, />Bruk</)
    assert.match(html, /aria-expanded="true"/)
  })

  it('names the field for a screen reader, which has no visible label to go on', () => {
    assert.match(row('expanded', promo()), /aria-label="Rabattkode"/)
  })

  it('reports progress while a code is being checked', () => {
    const html = row('expanded', promo({ status: 'checking', busy: true }))
    assert.match(html, /Kontrollerer/)
    assert.match(html, /<input[^>]*disabled/)
    // The button keeps its label, so the row does not reflow mid-check.
    assert.match(html, />Bruk</)
  })

  it('shows the server’s reason under the field for a code that was refused', () => {
    const html = row('expanded', promo({ status: 'error', message: 'Rabattkoden er utløpt.' }))
    assert.match(html, /Rabattkoden er utløpt\./)
    assert.match(html, /aria-invalid="true"/)
    // Under it, not beside it: the message follows the input in the markup.
    assert.ok(html.indexOf('<input') < html.indexOf('Rabattkoden er utløpt.'))
  })

  it('does not blame the code when it simply could not be checked', () => {
    const html = row(
      'expanded',
      promo({ status: 'unverified', code: 'SOMMER20', message: 'Prøv igjen om litt.' }),
    )
    assert.match(html, /Prøv igjen om litt\./)
    assert.doesNotMatch(html, /aria-invalid/)
  })
})

describe('drawer promo row — applied', () => {
  const applied = promo({ status: 'applied', code: 'SOMMER20', totals: TOTALS })

  it('names the code compactly and confirms it', () => {
    const html = row('applied', applied)
    assert.match(html, /Rabattkode: SOMMER20/)
    assert.match(html, /Rabatten er trukket fra\./)
  })

  it('offers Fjern, and nothing left to type', () => {
    const html = row('applied', applied)
    assert.match(html, />Fjern</)
    assert.equal(inputs(html), 0)
    assert.doesNotMatch(html, /Har du en rabattkode/)
  })

  it('never restates the discount amount itself — that is the summary’s Rabatt row', () => {
    const html = row('applied', applied)
    assert.doesNotMatch(html, /89[.,]8/)
  })
})

/**
 * The two carts share one component. These pin the cart page's variant so the drawer's
 * compact wording cannot leak into /handlekurv.
 */
describe('the cart page’s variant is unchanged', () => {
  const panel = (state: UsePromoCodeResult) => renderToStaticMarkup(<PromoCodeField promo={state} />)

  it('keeps its visible label and its own wording', () => {
    const html = panel(promo())
    assert.match(html, /<label/)
    assert.match(html, /placeholder="Skriv inn rabattkode"/)
    assert.match(html, />Bruk kode</)
  })

  it('keeps its own applied sentence', () => {
    const html = panel(promo({ status: 'applied', code: 'SOMMER20', totals: TOTALS }))
    assert.match(html, /Rabattkode SOMMER20 er aktivert/)
    assert.doesNotMatch(html, /Rabattkode: SOMMER20/)
  })

  it('swaps its button label while checking, as it always has', () => {
    assert.match(panel(promo({ status: 'checking', busy: true })), />Kontrollerer\.\.\.</)
  })
})

describe('the two fields do not collide in one document', () => {
  it('gives each instance its own ids', () => {
    const together = renderToStaticMarkup(
      <>
        <PromoCodeField promo={promo()} />
        <PromoDisclosureRow view="expanded" promo={promo()} onToggle={noop} />
      </>,
    )
    const ids = together.match(/id="promo-code-input-[^"]*"/g) ?? []
    assert.equal(ids.length, 2)
    assert.notEqual(ids[0], ids[1], 'a duplicated id would point the label at the wrong field')
  })
})

/**
 * The iOS zoom fix, asserted on the markup the browser actually gets.
 *
 * The size is inline, and nothing in globals.css, Tailwind's preflight or any module sets a
 * font-size on an input — so what is written here is the computed value. A rule that lowered
 * it would put the drawer straight back into the zoomed, clipped state.
 */
describe('the drawer’s field does not make iOS zoom the page', () => {
  /** The declared font-size of the first `<input>` in the markup, in px. */
  const inputFontPx = (html: string): number => {
    const tag = html.match(/<input[^>]*>/)?.[0] ?? ''
    const declared = tag.match(/font-size:\s*([\d.]+)px/)?.[1]
    assert.ok(declared, `no font-size on the input: ${tag}`)
    return Number(declared)
  }

  it('renders the compact field at 16px or more', () => {
    const px = inputFontPx(row('expanded', promo()))
    assert.ok(
      px >= IOS_NO_ZOOM_MIN_FONT_PX,
      `compact input is ${px}px — Safari zooms in and never zooms back out`,
    )
  })

  it('stays at 16px while a code is being checked and after one is refused', () => {
    for (const state of [
      promo({ status: 'checking', busy: true }),
      promo({ status: 'error', message: 'Rabattkoden er utløpt.' }),
    ]) {
      assert.ok(inputFontPx(row('expanded', state)) >= IOS_NO_ZOOM_MIN_FONT_PX)
    }
  })

  it('holds the cart page’s field to 16px too — the same zoom happened there', () => {
    const px = inputFontPx(renderToStaticMarkup(<PromoCodeField promo={promo()} />))
    assert.ok(px >= IOS_NO_ZOOM_MIN_FONT_PX, `panel input is ${px}px`)
  })

  it('never focuses the field itself — pressing Bruk must not reopen the keyboard', () => {
    const source = readFileSync(new URL('./PromoCodeField.tsx', import.meta.url), 'utf8')
    assert.ok(!/\.focus\(/.test(source), 'PromoCodeField must not call focus() on anything')
    // The ref exists for exactly one purpose.
    assert.match(source, /inputRef\.current\?\.blur\(\)/)
  })
})
