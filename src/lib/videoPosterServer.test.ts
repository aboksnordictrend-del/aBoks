import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { withVideoPosters } from './videoPosterServer'
import type { BlobImage } from './blobImages'

/**
 * The join between the naming convention and what is really in Blob Storage.
 * The listing is injected, so nothing here touches the network.
 */

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'

/** The four stills that really sit next to the /produkter/aboks films. */
const VIDEO_FOLDER: BlobImage[] = [
  'Video/aBoks-sort-video-poster.webp',
  'Video/aBoks-hvit-video-poster.webp',
  'Video/aBoks-blue-video-poster.webp',
  'Video/aBoks-olive-video-1-poster.webp',
].map((pathname) => ({ pathname, url: `${BLOB}/${pathname}` }))

function variant(name: string, video: string | null, image: string) {
  return { name, videoUrl: video, image }
}

describe('withVideoPosters', () => {
  it('leaves /produkter/aboks on its uploaded stills', async () => {
    const resolved = await withVideoPosters(
      [
        variant('Sort', `${BLOB}/Video/aBoks-sort-video.mp4`, `${BLOB}/aBoks-sort.webp`),
        variant('Olivengrønn', `${BLOB}/Video/aBoks-olive-video-1.mp4`, `${BLOB}/aBoks-olive.webp`),
      ],
      async () => VIDEO_FOLDER,
    )

    assert.deepEqual(
      resolved.map((v) => v.videoPoster),
      [`${BLOB}/Video/aBoks-sort-video-poster.webp`, `${BLOB}/Video/aBoks-olive-video-1-poster.webp`],
    )
  })

  it('gives each aBoks Vegg colour its own image, since none of the films has a still', async () => {
    const colours = ['sort', 'olivengronn', 'mork-bla', 'creme']
    const resolved = await withVideoPosters(
      colours.map((c) => variant(c, `${BLOB}/Video/aBoks-Vegg-${c}.mp4`, `${BLOB}/aboks-vegg/${c}.webp`)),
      async () => VIDEO_FOLDER,
    )

    assert.deepEqual(
      resolved.map((v) => v.videoPoster),
      colours.map((c) => `${BLOB}/aboks-vegg/${c}.webp`),
    )
  })

  it('reads each folder once, however many variants share it', async () => {
    const asked: string[] = []
    await withVideoPosters(
      [
        variant('Sort', `${BLOB}/Video/a.mp4`, `${BLOB}/sort.webp`),
        variant('Creme', `${BLOB}/Video/b.mp4`, `${BLOB}/creme.webp`),
        variant('Blå', `${BLOB}/aboks-vegg/c.mp4`, `${BLOB}/bla.webp`),
      ],
      async (prefix) => {
        asked.push(prefix)
        return []
      },
    )
    assert.deepEqual(asked.sort(), ['Video/', 'aboks-vegg/'])
  })

  it('asks for no listing at all when no variant has a video', async () => {
    let called = false
    const resolved = await withVideoPosters(
      [variant('Sort', null, `${BLOB}/sort.webp`)],
      async () => {
        called = true
        return []
      },
    )
    assert.equal(called, false)
    assert.equal(resolved[0].videoPoster, `${BLOB}/sort.webp`)
  })

  it('keeps the rest of the variant untouched', async () => {
    const [resolved] = await withVideoPosters(
      [{ name: 'Sort', sku: 'AB-V-S', videoUrl: null, image: `${BLOB}/sort.webp` }],
      async () => [],
    )
    assert.equal(resolved.sku, 'AB-V-S')
    assert.equal(resolved.name, 'Sort')
  })

  it('falls back to variant images when the folder cannot be read', async () => {
    const [resolved] = await withVideoPosters(
      [variant('Sort', `${BLOB}/Video/aBoks-sort-video.mp4`, `${BLOB}/aBoks-sort.webp`)],
      async () => [],
    )
    assert.equal(resolved.videoPoster, `${BLOB}/aBoks-sort.webp`)
  })
})
