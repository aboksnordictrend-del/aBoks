import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubmitButton, SUBMIT_LABELS, submitLabel } from './SubmitButton'

/**
 * What the customer can actually press. The important case is `processing`: while photos are
 * being resized in the browser the button must be natively disabled, because a submit at that
 * moment would post the raw camera files and trip Vercel's 413.
 */

const render = (processing: boolean, pending: boolean): string =>
  renderToStaticMarkup(<SubmitButton processing={processing} pending={pending} />)

describe('review submit button', () => {
  it('is enabled and invites submission when idle', () => {
    const html = render(false, false)
    assert.ok(html.includes('>Send anmeldelse</button>'))
    assert.ok(!html.includes('disabled'))
    assert.match(html, /aria-busy="false"/)
  })

  it('shows "Behandler bilder …" while photos are being processed', () => {
    assert.ok(render(true, false).includes('>Behandler bilder …</button>'))
    assert.equal(SUBMIT_LABELS.processing, 'Behandler bilder …')
  })

  it('is disabled while photos are being processed', () => {
    const html = render(true, false)
    assert.match(html, /disabled/)
    assert.match(html, /aria-busy="true"/)
  })

  it('is disabled while the Server Action is in flight', () => {
    const html = render(false, true)
    assert.match(html, /disabled/)
    assert.ok(html.includes('>Sender…</button>'))
  })

  it('stays disabled when processing and submission overlap', () => {
    assert.match(render(true, true), /disabled/)
  })

  it('prefers the processing label over the sending label, so the state shown is the blocking one', () => {
    assert.equal(submitLabel(true, true), SUBMIT_LABELS.processing)
    assert.equal(submitLabel(false, true), SUBMIT_LABELS.pending)
    assert.equal(submitLabel(false, false), SUBMIT_LABELS.idle)
  })

  it('is a real submit button, so Enter in a text field still works', () => {
    assert.match(render(false, false), /type="submit"/)
  })
})
