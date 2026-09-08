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

  /**
   * `resetOnEnd` puts the still in the markup as an <img>, because iOS Safari
   * will not repaint `<video poster>` once the element has held media — the box
   * would go blank after playback instead of returning to the poster.
   */
  it('paints the poster as its own layer when it has to come back after playing', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av" resetOnEnd />,
    )
    assert.match(html, new RegExp(`<img[^>]*src="${VARIANT_IMAGE}"`))
  })

  it('leaves that layer out of every other call site', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av" />,
    )
    assert.doesNotMatch(html, /<img/)
  })

  /**
   * The layer covers the video the moment playback ends, so it has to paint over
   * it — and under the play button — with nothing to animate: a transition would
   * put the flash back, one fade-length long.
   */
  it('stacks the poster over the video and under the play button, without a fade', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av" resetOnEnd />,
    )
    const img = html.indexOf('<img')
    assert.ok(html.indexOf('<video') < img && img < html.indexOf('aria-label="Spill av"'))
    assert.match(html, /<img[^>]*z-index:1[^>]*transition:none/)
  })

  it('keeps the play button reachable', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={VARIANT_IMAGE} label="Spill av produktvideo: aBoks Sort" />,
    )
    assert.match(html, /aria-label="Spill av produktvideo: aBoks Sort"/)
  })
})
