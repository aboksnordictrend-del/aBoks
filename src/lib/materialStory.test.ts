import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { showsMaterialStory } from './materialStory'

describe('showsMaterialStory — which products may carry the PLA Matte claim', () => {
  it('allows the four confirmed PLA Matte products', () => {
    for (const slug of ['aboks', 'aboks-vegg', 'aboks-mini', 'aboks-nano']) {
      assert.equal(showsMaterialStory(slug), true, `expected ${slug} to show the material story`)
    }
  })

  it('does not let an unknown product inherit the claim', () => {
    // The point of the allowlist: a new CMS row must be reviewed before it makes a
    // statement about its own material and where it is made.
    assert.equal(showsMaterialStory('aboks-etikett'), false)
    assert.equal(showsMaterialStory('gavekort'), false)
    assert.equal(showsMaterialStory('some-future-accessory'), false)
  })

  it('handles a missing or non-string slug without throwing', () => {
    assert.equal(showsMaterialStory(undefined), false)
    assert.equal(showsMaterialStory(null), false)
    assert.equal(showsMaterialStory(''), false)
  })

  it('matches the slug exactly rather than by prefix', () => {
    assert.equal(showsMaterialStory('aboks-vegg-tilbehor'), false)
    assert.equal(showsMaterialStory('ABOKS'), false)
  })
})
