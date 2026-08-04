import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { posterForVideo } from './videoPoster'

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Video'

describe('posterForVideo', () => {
  it('derives the poster name for every product variant video', () => {
    assert.equal(posterForVideo(`${BLOB}/aBoks-sort-video.mp4`), `${BLOB}/aBoks-sort-video-poster.webp`)
    assert.equal(posterForVideo(`${BLOB}/aBoks-hvit-video.mp4`), `${BLOB}/aBoks-hvit-video-poster.webp`)
    assert.equal(posterForVideo(`${BLOB}/aBoks-blue-video.mp4`), `${BLOB}/aBoks-blue-video-poster.webp`)
    // The olive variant points at the -1 render, not the square home page file.
    assert.equal(posterForVideo(`${BLOB}/aBoks-olive-video-1.mp4`), `${BLOB}/aBoks-olive-video-1-poster.webp`)
  })

  it('has nothing to offer when the variant has no video', () => {
    assert.equal(posterForVideo(null), undefined)
    assert.equal(posterForVideo(undefined), undefined)
    assert.equal(posterForVideo(''), undefined)
  })

  it('leaves non-mp4 URLs alone rather than inventing a poster', () => {
    assert.equal(posterForVideo(`${BLOB}/aBoks-sort-video.webm`), undefined)
    assert.equal(posterForVideo('not a url'), undefined)
  })

  it('keeps a query string after the extension', () => {
    assert.equal(
      posterForVideo(`${BLOB}/aBoks-sort-video.mp4?v=2`),
      `${BLOB}/aBoks-sort-video-poster.webp?v=2`,
    )
  })
})
