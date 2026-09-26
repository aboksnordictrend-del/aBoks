import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import SolutionConfigurator from './SolutionConfigurator'
import { formatPrice } from '@/lib/format'
import { QUOTE_TEXT } from '@/lib/quoteRequest'
import type { ConfigurableProduct, SolutionConfiguratorContent } from '@/lib/solutions/types'

/**
 * The whole configurator, as a solution page renders it.
 *
 * `ConfiguratorRow.test.tsx` covers the per-card guidance in detail; this is about the pieces
 * around it that the guidance must not disturb — the summary panel, the package total, and the
 * quote offer at each product's own threshold. Quantities are set through `defaultQuantity`,
 * which is what the route passes and what the component's initial state is built from.
 */

const content: SolutionConfiguratorContent = {
  heading: 'Sett sammen din Kontorpakke',
  intro: 'Velg antall og farge.',
  productSlugs: ['aboks-office', 'aboks-xl'],
  summaryHeading: 'Din Kontorpakke',
  quoteHeading: 'Større bestilling?',
  quoteText: 'Vi lager gjerne et tilbud.',
}

const product = (
  slug: string,
  title: string,
  price: number,
  defaultQuantity: number,
): ConfigurableProduct => ({
  id: slug === 'aboks-xl' ? '11' : '12',
  slug,
  title,
  tagline: '',
  price,
  sale: null,
  image: '',
  imageAlt: title,
  defaultQuantity,
  variants: [],
})

/** Office (549 / 499 / 449, quote 40) and XL (849 / 799 / 749, quote 11). */
function render(officeQty: number, xlQty: number): string {
  return renderToStaticMarkup(
    <SolutionConfigurator
      content={content}
      products={[
        product('aboks-office', 'aBoks Office', 549, officeQty),
        product('aboks-xl', 'aBoks XL', 849, xlQty),
      ]}
      onQuoteRequest={() => {}}
    />,
  )
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** An amount as it reads in flattened text — `formatPrice` uses a non-breaking space. */
function nok(amount: number): string {
  return formatPrice(amount).replace(/ /g, ' ')
}

describe('solution configurator — package totals', () => {
  it('sums each product at its own band and nothing else', () => {
    // 12 Office (10–19 → 499) + 3 XL (1–3 → 849). 15 units between them, and neither line is
    // priced as if the package quantity were its own.
    const body = text(render(12, 3))
    assert.ok(body.includes(`${nok(12 * 499)} for 12 stk.`), 'Office line total')
    assert.ok(body.includes(`${nok(3 * 849)} for 3 stk.`), 'XL line total')
    assert.ok(body.includes(nok(12 * 499 + 3 * 849)), 'package total')
  })

  it('keeps the summary panel to the per-unit price and the line total', () => {
    const body = text(render(12, 0))
    assert.ok(body.includes('Din Kontorpakke'))
    assert.ok(body.includes('12 × aBoks Office'))
    assert.ok(body.includes(`${nok(499)} per stk.`), 'effective unit price')
    assert.ok(body.includes(nok(549)), 'base price, struck through')
    assert.ok(body.includes(nok(12 * 499)), 'line total')
  })

  it('does not repeat the next-tier sentence in the summary panel', () => {
    // The guidance belongs on the interactive card. It must appear exactly once per product,
    // not again beside the summary.
    const body = text(render(12, 0))
    const occurrences = body.split('Kjøp 20 stk. og betal').length - 1
    assert.equal(occurrences, 1)
  })

  it('shows no total at all for an empty configuration', () => {
    const body = text(render(0, 0))
    assert.ok(body.includes('Velg produkter og antall'))
    assert.ok(!body.includes('Totalt'))
  })
})

describe('solution configurator — the quote offer', () => {
  it('always offers the standing "Be om tilbud" action', () => {
    // Unchanged behaviour: the card beside the summary is there at any quantity.
    assert.ok(text(render(1, 1)).includes(QUOTE_TEXT.cta))
    assert.ok(text(render(0, 0)).includes(QUOTE_TEXT.cta))
  })

  it('names a product only once it reaches its own threshold', () => {
    // Office at 39 and XL at 10 — both one short.
    const below = text(render(39, 10))
    assert.ok(!below.includes('40 × aBoks Office'))
    assert.ok(!below.includes('eller flere'), 'no per-product quote note yet')

    // Office at 40 crosses its threshold; XL at 10 has not crossed its own.
    const office = text(render(40, 10))
    assert.ok(office.includes('40 × aBoks Office:'))
    assert.ok(office.includes(QUOTE_TEXT.explanation(40)))
    assert.ok(!office.includes('10 × aBoks XL:'))

    // XL at 11 crosses its own, at a lower number than the standard one.
    const xl = text(render(9, 11))
    assert.ok(xl.includes('11 × aBoks XL:'))
    assert.ok(xl.includes(QUOTE_TEXT.explanation(11)))
    assert.ok(!xl.includes('9 × aBoks Office:'))
  })

  it('keeps the ordinary checkout available at the threshold', () => {
    const body = text(render(40, 11))
    // Both lines are still priced, still totalled, and the add-to-cart action is untouched.
    assert.ok(body.includes(`${nok(40 * 449)} for 40 stk.`))
    assert.ok(body.includes(`${nok(11 * 749)} for 11 stk.`))
    assert.ok(body.includes(nok(40 * 449 + 11 * 749)), 'package total includes both lines')
    assert.ok(body.includes('Legg løsningen i handlekurven'))
    assert.ok(body.includes(QUOTE_TEXT.note), 'the offer says the price still applies')
  })

  it('does not present a quote threshold as a cheaper price anywhere', () => {
    for (const [officeQty, xlQty] of [
      [20, 7],
      [39, 10],
      [40, 11],
      [120, 30],
    ]) {
      const body = text(render(officeQty, xlQty))
      assert.ok(!body.includes('Kjøp 40 stk.'), `office @${officeQty}`)
      assert.ok(!body.includes('Kjøp 11 stk.'), `xl @${xlQty}`)
    }
  })
})
