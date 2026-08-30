import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import FraktOgReturPage from './page'
import { ANGRERETTSKJEMA_URL, RETURSKJEMA_URL } from '@/lib/returDocuments'

/**
 * The two return documents a customer has to be able to reach from /frakt-og-retur. The
 * page is a static server component, so rendering it is enough — what is asserted here is
 * exactly what ships: the URLs, the labels, and the new-tab behaviour that makes a Blob PDF
 * open the same way on desktop and on mobile.
 */

const html = renderToStaticMarkup(<FraktOgReturPage />)

/** The rendered <a …> tag whose href is `url`, or undefined. */
function anchorFor(url: string): string | undefined {
  return html.match(new RegExp(`<a[^>]*href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))?.[0]
}

describe('/frakt-og-retur return documents', () => {
  it('has an "Angrerett og retur" section', () => {
    assert.ok(html.includes('Angrerett og retur'))
    assert.ok(
      html.includes(
        'Ønsker du å benytte angreretten eller returnere en vare, finner du nødvendige',
      ),
    )
  })

  it('links the Angrerettskjema PDF', () => {
    assert.equal(
      ANGRERETTSKJEMA_URL,
      'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Angrerettskjema.pdf',
    )
    assert.ok(anchorFor(ANGRERETTSKJEMA_URL), 'no link points at Angrerettskjema.pdf')
    assert.ok(html.includes('Last ned angrerettskjema'))
  })

  it('links the aBoks Returskjema PDF', () => {
    assert.equal(
      RETURSKJEMA_URL,
      'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks_returskjema.pdf',
    )
    assert.ok(anchorFor(RETURSKJEMA_URL), 'no link points at aBoks_returskjema.pdf')
    assert.ok(html.includes('Last ned returskjema'))
  })

  it('opens both PDFs in a new tab, with rel="noopener"', () => {
    for (const url of [ANGRERETTSKJEMA_URL, RETURSKJEMA_URL]) {
      const anchor = anchorFor(url)!
      assert.match(anchor, /target="_blank"/)
      assert.match(anchor, /rel="noopener noreferrer"/)
      assert.match(anchor, /aria-label="[^"]*PDF[^"]*"/)
    }
  })

  it('links the files inline — never with Blob’s ?download=1, which breaks in-app browsers', () => {
    assert.ok(!ANGRERETTSKJEMA_URL.includes('download=1'))
    assert.ok(!RETURSKJEMA_URL.includes('download=1'))
  })

  it('leaves the rest of the page intact', () => {
    // The sections are numbered, so a new one must renumber the tail rather than collide.
    for (const number of ['01', '05', '06', '07', '08', '11']) {
      assert.ok(html.includes(`>${number}<`), `section ${number} is missing`)
    }
    assert.ok(html.includes('Reklamasjon'))
    assert.ok(html.includes('Tilbakebetaling'))
    assert.ok(html.includes('Kontakt oss'))
  })
})
