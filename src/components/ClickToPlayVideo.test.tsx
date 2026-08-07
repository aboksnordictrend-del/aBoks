import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ClickToPlayVideo from './ClickToPlayVideo'

/**
 * The markup a visitor receives before pressing anything: the film still absent
 * from `src`, and the poster exactly as handed in — the element must not decide
 * anything about it in the browser, because Safari only lays a poster out once.
 * Which of the two sources wins is settled on the server, in
 * @/lib/videoPosterServer.ts.
 */

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'
const VIDEO = `${BLOB}/Video/aBoks-Vegg-sort.mp4`
const VARIANT_IMAGE = `${BLOB}/aboks-vegg/sort.webp`

describe('ClickToPlayVideo', () => {
  it('holds the film in data-src so nothing is fetched until the press', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av" />,
    )
    assert.match(html, new RegExp(`data-src="${VIDEO}"`))
    assert.match(html, /preload="none"/)
    assert.doesNotMatch(html, new RegExp(`[^-]src="${VIDEO}"`))
  })

  it('renders the poster it was given, in the first paint', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av" />,
    )
    assert.match(html, new RegExp(`poster="${VARIANT_IMAGE}"`))
  })

  it('carries an uploaded still through just as readily', () => {
    const still = `${BLOB}/Video/aBoks-olive-video-1-poster.webp`
    const html = renderToStaticMarkup(<ClickToPlayVideo src={VIDEO} poster={still} label="Spill av" />)
    assert.match(html, new RegExp(`poster="${still}"`))
  })

  it('leaves the poster attribute off when there is no still', () => {
    const html = renderToStaticMarkup(<ClickToPlayVideo src={VIDEO} label="Spill av" />)
    assert.doesNotMatch(html, /poster=/)
  })

  it('keeps the play button reachable', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av produktvideo: aBoks Sort" />,
    )
    assert.match(html, /aria-label="Spill av produktvideo: aBoks Sort"/)
  })
})
