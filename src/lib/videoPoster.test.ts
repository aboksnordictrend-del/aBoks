import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { blobFolder, blobPathname, pickVideoPoster, posterForVideo } from './videoPoster'

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

describe('blobPathname', () => {
  it('names the blob a poster URL points at, so a listing can be searched for it', () => {
    assert.equal(blobPathname(`${BLOB}/aBoks-sort-video-poster.webp`), 'Video/aBoks-sort-video-poster.webp')
  })

  it('ignores a cache-busting query', () => {
    assert.equal(blobPathname(`${BLOB}/aBoks-sort-video-poster.webp?v=2`), 'Video/aBoks-sort-video-poster.webp')
  })

  it('has nothing to say about an absent URL', () => {
    assert.equal(blobPathname(undefined), undefined)
    assert.equal(blobPathname(null), undefined)
    assert.equal(blobPathname(''), undefined)
  })
})

describe('blobFolder', () => {
  it('is the prefix the listing is asked for', () => {
    assert.equal(blobFolder('Video/aBoks-sort-video-poster.webp'), 'Video/')
    assert.equal(blobFolder('aboks-vegg/stills/sort-poster.webp'), 'aboks-vegg/stills/')
    assert.equal(blobFolder('sort-poster.webp'), '')
  })
})

describe('pickVideoPoster', () => {
  const VEGG_IMAGE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-vegg-sort.webp'
  // What /produkter/aboks really has next to its films.
  const UPLOADED = new Set([
    'Video/aBoks-sort-video-poster.webp',
    'Video/aBoks-hvit-video-poster.webp',
    'Video/aBoks-blue-video-poster.webp',
    'Video/aBoks-olive-video-1-poster.webp',
  ])

  it('keeps the purpose-made still for the films that have one', () => {
    assert.equal(
      pickVideoPoster(`${BLOB}/aBoks-olive-video-1.mp4`, VEGG_IMAGE, UPLOADED),
      `${BLOB}/aBoks-olive-video-1-poster.webp`,
    )
    assert.equal(
      pickVideoPoster(`${BLOB}/aBoks-sort-video.mp4`, VEGG_IMAGE, UPLOADED),
      `${BLOB}/aBoks-sort-video-poster.webp`,
    )
  })

  it('shows the variant image for a film that was uploaded without a still', () => {
    // aBoks-Vegg-4x3-poster.webp is not in the folder — asking for it is what left
    // the frame on its flat background.
    assert.equal(pickVideoPoster(`${BLOB}/aBoks-Vegg-4x3.mp4`, VEGG_IMAGE, UPLOADED), VEGG_IMAGE)
  })

  it('gives every aBoks Vegg colour its own picture, both ways round', () => {
    const colours = ['sort', 'olivengronn', 'mork-bla', 'creme', 'sort']
    for (const colour of colours) {
      const image = `https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/aBoks-vegg-${colour}.webp`
      assert.equal(pickVideoPoster(`${BLOB}/aBoks-Vegg-${colour}.mp4`, image, UPLOADED), image)
    }
  })

  it('picks up a still uploaded later without any code change', () => {
    const withVeggStill = new Set([...UPLOADED, 'Video/aBoks-Vegg-4x3-poster.webp'])
    assert.equal(
      pickVideoPoster(`${BLOB}/aBoks-Vegg-4x3.mp4`, VEGG_IMAGE, withVeggStill),
      `${BLOB}/aBoks-Vegg-4x3-poster.webp`,
    )
  })

  it('prefers the variant image when the folder could not be read', () => {
    // An unreadable folder must not send the page after a URL that may 404.
    assert.equal(pickVideoPoster(`${BLOB}/aBoks-sort-video.mp4`, VEGG_IMAGE, new Set()), VEGG_IMAGE)
  })

  it('leaves the video posterless when there is nothing to show', () => {
    assert.equal(pickVideoPoster(`${BLOB}/aBoks-Vegg-4x3.mp4`, '', UPLOADED), undefined)
    assert.equal(pickVideoPoster(null, '', UPLOADED), undefined)
    assert.equal(pickVideoPoster(null, VEGG_IMAGE, UPLOADED), VEGG_IMAGE)
  })
})
