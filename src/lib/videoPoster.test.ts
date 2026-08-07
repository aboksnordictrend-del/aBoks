import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { posterForVideo, resolvePosterSource } from './videoPoster'

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

describe('resolvePosterSource', () => {
  const derived = `${BLOB}/aBoks-sort-video-poster.webp`
  const variantImage = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-vegg-sort.webp'

  it('keeps the uploaded still for videos that have one', () => {
    assert.equal(resolvePosterSource(derived, variantImage, false), derived)
  })

  it('shows the variant image once the derived still turns out to be missing', () => {
    assert.equal(resolvePosterSource(derived, variantImage, true), variantImage)
  })

  it('follows the caller from colour to colour', () => {
    // Each aBoks Vegg colour hands over its own picture; the poster is whatever
    // the selected variant carries, never a leftover from the previous one.
    const perColour = ['sort', 'olivengronn', 'mork-bla', 'creme', 'sort']
    for (const colour of perColour) {
      const image = `https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-vegg-${colour}.webp`
      assert.equal(resolvePosterSource(derived, image, true), image)
    }
  })

  it('falls back to the variant image when no poster can be derived at all', () => {
    assert.equal(resolvePosterSource(undefined, variantImage, false), variantImage)
  })

  it('leaves the video posterless when neither source exists', () => {
    assert.equal(resolvePosterSource(undefined, undefined, false), undefined)
    assert.equal(resolvePosterSource(undefined, '', true), '')
  })

  it('still asks for the derived still when there is nothing to fall back to', () => {
    // Exactly what the page did before the fallback existed: a URL that may 404,
    // which the browser quietly ignores, leaving the flat background.
    assert.equal(resolvePosterSource(derived, undefined, true), derived)
  })
})
