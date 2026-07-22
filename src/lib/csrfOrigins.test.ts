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
