import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildCsrfOrigins } from './csrfOrigins'

describe('buildCsrfOrigins', () => {
  it('always includes the serverURL', () => {
    const origins = buildCsrfOrigins('http://localhost:3000', { isDev: true })
    assert.ok(origins.includes('http://localhost:3000'))
  })

  it('adds localhost + 127.0.0.1 for the serverURL port', () => {
    const origins = buildCsrfOrigins('http://localhost:3000', { isDev: true })
    assert.ok(origins.includes('http://localhost:3000'))
    assert.ok(origins.includes('http://127.0.0.1:3000'))
  })

  it('trusts the real dev origin when the panel runs on port 3001 (via serverURL)', () => {
    const origins = buildCsrfOrigins('http://localhost:3001', { isDev: true })
    // The current local origin from the user's screenshot must pass the allowlist.
    assert.ok(origins.includes('http://localhost:3001'))
    assert.ok(origins.includes('http://127.0.0.1:3001'))
  })

  it('derives the port from PORT env when serverURL still points at the default', () => {
    // 3000 busy → next dev binds 3001 and honours PORT=3001, while NEXT_PUBLIC_SERVER_URL
    // is still http://localhost:3000.
    const origins = buildCsrfOrigins('http://localhost:3000', { isDev: true, port: '3001' })
    assert.ok(origins.includes('http://localhost:3001'))
    assert.ok(origins.includes('http://127.0.0.1:3001'))
    // The default-port origins remain trusted too.
    assert.ok(origins.includes('http://localhost:3000'))
  })

  it('never contains a wildcard', () => {
    const origins = buildCsrfOrigins('http://localhost:3001', { isDev: true, port: '3001' })
    assert.ok(!origins.includes('*'))
    assert.ok(!origins.some((o) => o.includes('*')))
  })

  it('does not add arbitrary LAN/IP origins — only localhost and 127.0.0.1', () => {
    const origins = buildCsrfOrigins('http://localhost:3001', { isDev: true, port: '3001' })
    const localOnly = origins.every(
      (o) => o === 'http://localhost:3001' || o.startsWith('http://localhost:') || o.startsWith('http://127.0.0.1:'),
    )
    assert.ok(localOnly)
  })

  it('in production trusts only the serverURL (no localhost injection)', () => {
    const origins = buildCsrfOrigins('https://aboks.no', { isDev: false })
    assert.deepEqual(origins, ['https://aboks.no'])
  })

  it('falls back to the default dev port when serverURL has no port', () => {
    const origins = buildCsrfOrigins('http://localhost', { isDev: true })
    assert.ok(origins.includes('http://localhost:3000'))
    assert.ok(origins.includes('http://127.0.0.1:3000'))
  })
})

describe('buildCsrfOrigins — Vercel Preview deployments', () => {
  const PROD = 'https://aboks.no'

  it('trusts the preview deployment and branch hostnames', () => {
    // The exact situation that broke admin saves: NEXT_PUBLIC_SERVER_URL is inherited from
    // Production, so serverURL is the live domain while the admin is served from *.vercel.app.
    const origins = buildCsrfOrigins(PROD, {
      isDev: false,
      isPreview: true,
      previewHosts: ['aboks-abc123-team.vercel.app', 'aboks-git-promo-preview-team.vercel.app'],
    })

    assert.ok(origins.includes(PROD), 'the configured serverURL is still trusted')
    assert.ok(origins.includes('https://aboks-abc123-team.vercel.app'))
    assert.ok(origins.includes('https://aboks-git-promo-preview-team.vercel.app'))
  })

  it('normalises whatever shape Vercel provides', () => {
    const origins = buildCsrfOrigins(PROD, {
      isDev: false,
      isPreview: true,
      // VERCEL_URL is bare; a manually set value may carry protocol and a trailing slash.
      previewHosts: ['aboks-a.vercel.app', 'https://aboks-b.vercel.app/', '  aboks-c.vercel.app  '],
    })
    assert.ok(origins.includes('https://aboks-a.vercel.app'))
    assert.ok(origins.includes('https://aboks-b.vercel.app'))
    assert.ok(origins.includes('https://aboks-c.vercel.app'))
    assert.ok(origins.every((o) => !o.endsWith('/')), 'no trailing slashes')
  })

  it('ignores empty, missing and malformed hostnames', () => {
    const origins = buildCsrfOrigins(PROD, {
      isDev: false,
      isPreview: true,
      previewHosts: [undefined, null, '', '   ', 'http://', '::::'],
    })
    assert.deepEqual(origins, [PROD], 'nothing junk reaches the allowlist')
  })

  it('adds nothing in production — the live allowlist is unchanged', () => {
    const origins = buildCsrfOrigins(PROD, {
      isDev: false,
      isPreview: false,
      previewHosts: ['aboks-abc123-team.vercel.app'],
    })
    assert.deepEqual(origins, [PROD])
  })

  it('never widens to a wildcard or a foreign origin', () => {
    const origins = buildCsrfOrigins(PROD, {
      isDev: false,
      isPreview: true,
      previewHosts: ['aboks-abc123-team.vercel.app'],
    })
    assert.ok(!origins.includes('*'))
    assert.ok(!origins.includes('https://evil.example'))
    assert.equal(origins.length, 2)
  })

  it('still adds the localhost dev origins when running locally', () => {
    const origins = buildCsrfOrigins('http://localhost:3000', { isDev: true, isPreview: false })
    assert.ok(origins.includes('http://localhost:3000'))
    assert.ok(origins.includes('http://127.0.0.1:3000'))
  })
})
