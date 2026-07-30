import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { BulkSelectionToolbar } from './PinterestExportClient'

/**
 * The bulk-selection toolbar's rendered surface. The surrounding client holds the fetch, the
 * edit buffer and Payload's providers; the selection logic itself is covered by
 * src/lib/pinterest/export/selection.test.ts. What is asserted here is what an admin can
 * actually see and reach: the labels, the native disabled state and the markup.
 */

const noop = () => {}

const toolbar = (canSelectAll: boolean, canClearAll: boolean): string =>
  renderToStaticMarkup(
    <BulkSelectionToolbar
      canSelectAll={canSelectAll}
      canClearAll={canClearAll}
      onSelectAll={noop}
      onClearAll={noop}
    />,
  )

/** The `<button …>` opening tag whose text content is `label`. */
function buttonTag(html: string, label: string): string {
  const index = html.indexOf(`>${label}</button>`)
  assert.notEqual(index, -1, `no button labelled "${label}" in: ${html}`)
  const start = html.lastIndexOf('<button', index)
  return html.slice(start, index + 1)
}

describe('bulk selection toolbar', () => {
  it('renders both Norwegian labels', () => {
    const html = toolbar(true, true)
    assert.ok(html.includes('>Velg alle</button>'))
    assert.ok(html.includes('>Fjern alle valg</button>'))
  })

  it('keeps the sort note alongside the actions', () => {
    assert.ok(toolbar(true, true).includes('Sortering: Nyeste først'))
  })

  it('uses real buttons of type="button", so they are keyboard reachable and never submit', () => {
    const html = toolbar(true, true)
    for (const label of ['Velg alle', 'Fjern alle valg']) {
      assert.match(buttonTag(html, label), /type="button"/, label)
    }
  })

  it('uses the admin button classes, so focus and hover match the rest of Payload', () => {
    const html = toolbar(true, true)
    for (const label of ['Velg alle', 'Fjern alle valg']) {
      assert.match(buttonTag(html, label), /class="btn btn--style-secondary btn--size-small"/, label)
    }
  })

  it('exposes the native disabled attribute rather than a styled-only state', () => {
    const bothOff = toolbar(false, false)
    assert.match(buttonTag(bothOff, 'Velg alle'), /disabled/)
    assert.match(buttonTag(bothOff, 'Fjern alle valg'), /disabled/)
  })

  it('disables only "Velg alle" when everything is already selected', () => {
    const html = toolbar(false, true)
    assert.match(buttonTag(html, 'Velg alle'), /disabled/)
    assert.doesNotMatch(buttonTag(html, 'Fjern alle valg'), /disabled/)
  })

  it('disables only "Fjern alle valg" when nothing is selected', () => {
    const html = toolbar(true, false)
    assert.doesNotMatch(buttonTag(html, 'Velg alle'), /disabled/)
    assert.match(buttonTag(html, 'Fjern alle valg'), /disabled/)
  })

  it('enables both on a partly selected list', () => {
    const html = toolbar(true, true)
    assert.doesNotMatch(buttonTag(html, 'Velg alle'), /disabled/)
    assert.doesNotMatch(buttonTag(html, 'Fjern alle valg'), /disabled/)
  })
})
