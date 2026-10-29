import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HOME_SHARE_IMAGE, HOME_TITLE } from './homeSeo'

describe('homepage metadata', () => {
  it('names the brand exactly once in the title', () => {
    assert.equal(HOME_TITLE, 'aBoks – norskdesignet batteriboks for nye og brukte batterier')
    assert.equal(HOME_TITLE.split('aBoks').length - 1, 1)
  })

  it('shares the new hero photo straight from Blob, at its real size', () => {
    assert.equal(HOME_SHARE_IMAGE.url, 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Hero-desktop-ny.webp')
    assert.deepEqual([HOME_SHARE_IMAGE.width, HOME_SHARE_IMAGE.height], [1659, 948])
    assert.equal(HOME_SHARE_IMAGE.type, 'image/webp')
    assert.ok(!HOME_SHARE_IMAGE.url.includes('/images/hero-desktop.webp'), 'not the old image')
  })
})
