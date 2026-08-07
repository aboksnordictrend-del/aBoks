import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import ClickToPlayVideo from './ClickToPlayVideo'

/**
 * The markup a visitor receives before pressing anything: the film must still be
 * absent from `src`, and the frame they look at while deciding must be a real
 * image. Which of the two poster sources wins after the missing-image probe runs
 * is covered as a pure function in @/lib/videoPoster.test.ts.
 */

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'
const VIDEO = `${BLOB}/Video/aBoks-Vegg-sort.mp4`
const VARIANT_IMAGE = `${BLOB}/aBoks-vegg-sort.webp`

describe('ClickToPlayVideo', () => {
  it('holds the film in data-src so nothing is fetched until the press', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={`${BLOB}/Video/aBoks-Vegg-sort-poster.webp`} label="Spill av" />,
    )
    assert.match(html, new RegExp(`data-src="${VIDEO}"`))
    assert.match(html, /preload="none"/)
    assert.doesNotMatch(html, new RegExp(`[^-]src="${VIDEO}"`))
  })

  it('serves the uploaded still first, so pages that have one are untouched', () => {
    const poster = `${BLOB}/Video/aBoks-olive-video-1-poster.webp`
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} poster={poster} posterFallback={VARIANT_IMAGE} label="Spill av" />,
    )
    assert.match(html, new RegExp(`poster="${poster}"`))
  })

  it('posters a film that has no still of its own with the image handed to it', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} posterFallback={VARIANT_IMAGE} label="Spill av" />,
    )
    assert.match(html, new RegExp(`poster="${VARIANT_IMAGE}"`))
  })

  it('keeps the play button reachable', () => {
    const html = renderToStaticMarkup(
      <ClickToPlayVideo src={VIDEO} posterFallback={VARIANT_IMAGE} label="Spill av produktvideo: aBoks Sort" />,
    )
    assert.match(html, /aria-label="Spill av produktvideo: aBoks Sort"/)
  })
})
