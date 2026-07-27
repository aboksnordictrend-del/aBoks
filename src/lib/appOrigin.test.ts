import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPreviewDeployment,
  normalizeOriginHost,
  resolveApplicationOrigin,
  type AppOriginEnv,
} from './appOrigin'

const PROD = 'https://aboks.no'
const BRANCH = 'aboks-git-promo-preview-team.vercel.app'
const DEPLOYMENT = 'aboks-k3j4h5-team.vercel.app'

const resolve = (env: AppOriginEnv, fallback?: string) =>
  resolveApplicationOrigin({ env, ...(fallback ? { fallback } : {}) })

describe('resolveApplicationOrigin — Vercel Preview', () => {
  it('prefers the stable branch URL', () => {
    // The exact production bug: NEXT_PUBLIC_SERVER_URL is shared, so it says aboks.no here.
    const origin = resolve({
      NEXT_PUBLIC_SERVER_URL: PROD,
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: BRANCH,
      VERCEL_URL: DEPLOYMENT,
    })
    assert.equal(origin, `https://${BRANCH}`)
    assert.notEqual(origin, PROD, 'a Preview must never call back to Production')
  })

  it('falls back to the deployment URL when no branch URL is set', () => {
    const origin = resolve({
      NEXT_PUBLIC_SERVER_URL: PROD,
      VERCEL_ENV: 'preview',
      VERCEL_URL: DEPLOYMENT,
    })
    assert.equal(origin, `https://${DEPLOYMENT}`)
  })

  it('normalises whatever shape Vercel provides', () => {
    // VERCEL_URL is bare; a hand-set value may carry protocol, slash or padding.
    assert.equal(
      resolve({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: `https://${BRANCH}/` }),
      `https://${BRANCH}`,
    )
    assert.equal(
      resolve({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: `  ${BRANCH}  ` }),
      `https://${BRANCH}`,
    )
  })

  it('rejects a malformed Vercel hostname and falls back safely', () => {
    for (const bad of ['', '   ', '::::', 'http://', 'notahost', undefined]) {
      const origin = resolve({
        NEXT_PUBLIC_SERVER_URL: PROD,
        VERCEL_ENV: 'preview',
        VERCEL_BRANCH_URL: bad,
        VERCEL_URL: bad,
      })
      // Never invents a hostname — degrades to the configured URL.
      assert.equal(origin, PROD, `bad host ${JSON.stringify(bad)} must not be used`)
    }
  })

  it('uses the deployment URL when only the branch URL is malformed', () => {
    const origin = resolve({
      NEXT_PUBLIC_SERVER_URL: PROD,
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: '::::',
      VERCEL_URL: DEPLOYMENT,
    })
    assert.equal(origin, `https://${DEPLOYMENT}`)
  })

  it('never returns an origin with a trailing slash or path', () => {
    const origin = resolve({
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: `https://${BRANCH}/admin?x=1`,
    })
    assert.equal(origin, `https://${BRANCH}`)
  })
})

describe('resolveApplicationOrigin — Production', () => {
  it('resolves to the configured production URL, exactly as before', () => {
    const origin = resolve({
      NEXT_PUBLIC_SERVER_URL: PROD,
      VERCEL_ENV: 'production',
      VERCEL_BRANCH_URL: BRANCH,
      VERCEL_URL: DEPLOYMENT,
    })
    assert.equal(origin, PROD, 'the Vercel hostnames are ignored in production')
  })

  it('ignores Vercel hostnames when VERCEL_ENV is absent', () => {
    assert.equal(
      resolve({ NEXT_PUBLIC_SERVER_URL: PROD, VERCEL_URL: DEPLOYMENT }),
      PROD,
    )
  })

  it('keeps the historical VERCEL_URL fallback when nothing is configured', () => {
    assert.equal(resolve({ VERCEL_ENV: 'production', VERCEL_URL: DEPLOYMENT }), `https://${DEPLOYMENT}`)
  })
})

describe('resolveApplicationOrigin — local development', () => {
  it('returns the configured localhost URL unchanged', () => {
    assert.equal(resolve({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' }), 'http://localhost:3000')
  })

  it('honours a non-default dev port', () => {
    assert.equal(resolve({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3001' }), 'http://localhost:3001')
  })

  it('uses the caller fallback when nothing at all is set', () => {
    // payload.config keeps localhost; the checkout keeps its own aboks.no default.
    assert.equal(resolve({}), 'http://localhost:3000')
    assert.equal(resolve({}, 'https://aboks.no'), 'https://aboks.no')
  })
})

describe('isPreviewDeployment', () => {
  it('is true only for VERCEL_ENV=preview', () => {
    assert.equal(isPreviewDeployment({ VERCEL_ENV: 'preview' }), true)
    assert.equal(isPreviewDeployment({ VERCEL_ENV: 'production' }), false)
    assert.equal(isPreviewDeployment({ VERCEL_ENV: 'development' }), false)
    assert.equal(isPreviewDeployment({}), false)
  })
})

describe('normalizeOriginHost', () => {
  it('promotes a bare hostname to https', () => {
    assert.equal(normalizeOriginHost('aboks-x.vercel.app'), 'https://aboks-x.vercel.app')
  })

  it('trusts an explicit URL as written — including http on localhost', () => {
    assert.equal(normalizeOriginHost('http://localhost:3000'), 'http://localhost:3000')
    assert.equal(normalizeOriginHost('https://aboks.no'), 'https://aboks.no')
  })

  it('rejects degenerate values instead of inventing a host', () => {
    for (const bad of [undefined, null, '', '   ', 'http://', '::::', 'notahost', 42 as never]) {
      assert.equal(normalizeOriginHost(bad), null, `should reject ${JSON.stringify(bad)}`)
    }
  })
})

describe('generated Kustom merchant_urls', () => {
  // Mirrors the four URLs built in checkoutFlow.createTrustedCheckout.
  const merchantUrls = (origin: string) => ({
    terms: `${origin}/kjopsvilkar`,
    checkout: `${origin}/kasse?order_id={checkout.order.id}`,
    confirmation: `${origin}/kasse/bekreftelse?order_id={checkout.order.id}`,
    push: `${origin}/api/kustom/webhook?order_id={checkout.order.id}`,
  })

  it('stay on the Preview deployment', () => {
    const origin = resolve({
      NEXT_PUBLIC_SERVER_URL: PROD,
      VERCEL_ENV: 'preview',
      VERCEL_BRANCH_URL: BRANCH,
    })
    const urls = merchantUrls(origin)

    for (const url of Object.values(urls)) {
      assert.ok(url.startsWith(`https://${BRANCH}/`), `${url} must be on the preview host`)
      assert.ok(!url.includes('aboks.no'), `${url} must not reach production`)
    }
    assert.equal(urls.push, `https://${BRANCH}/api/kustom/webhook?order_id={checkout.order.id}`)
  })

  it('are unchanged in production', () => {
    const urls = merchantUrls(resolve({ NEXT_PUBLIC_SERVER_URL: PROD, VERCEL_ENV: 'production' }))
    assert.equal(urls.terms, 'https://aboks.no/kjopsvilkar')
    assert.equal(urls.checkout, 'https://aboks.no/kasse?order_id={checkout.order.id}')
    assert.equal(urls.confirmation, 'https://aboks.no/kasse/bekreftelse?order_id={checkout.order.id}')
    assert.equal(urls.push, 'https://aboks.no/api/kustom/webhook?order_id={checkout.order.id}')
  })
})
