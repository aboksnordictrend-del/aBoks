import { normalizeOriginHost } from './appOrigin'

// Builds the CSRF allowlist for Payload cookie auth on state-changing (non-GET) requests.
//
// Payload only reads the auth cookie when the request `Origin` is in `config.csrf`. The
// admin panel always sends an `Origin` on POST/PATCH/DELETE, so the origin it is actually
// served from must be listed or those requests arrive unauthenticated (req.user = null →
// 401), while same-origin GETs (no Origin header) still work.
//
// The dev port is not fixed: `next dev` uses port 3000 by default but falls back to 3001,
// 3002 … when it is taken, and it honours the `PORT` env var. So instead of hard-coding a
// port we derive localhost/127.0.0.1 origins from the actual configured port (serverURL or
// PORT). This is still a strict allowlist — never a wildcard, and never arbitrary LAN/IP
// origins. In production only the real serverURL is trusted.

export interface BuildCsrfOriginsOptions {
  /** Explicit dev port (defaults to process.env.PORT). */
  port?: string
  /** Whether to include localhost dev origins (defaults to NODE_ENV !== 'production'). */
  isDev?: boolean
  /**
   * Whether this build is a Vercel Preview deployment
   * (defaults to `process.env.VERCEL_ENV === 'preview'`).
   */
  isPreview?: boolean
  /**
   * Hostnames of the current Preview deployment. Defaults to the URLs Vercel injects:
   * VERCEL_URL (this exact deployment) and VERCEL_BRANCH_URL (the stable branch alias).
   */
  previewHosts?: (string | undefined | null)[]
}


/** Local hostnames that resolve to the same machine the admin panel runs on. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1'] as const
const DEFAULT_DEV_PORT = '3000'

/**
 * Returns the trusted origins for CSRF: always the serverURL, plus (in development) the
 * localhost/127.0.0.1 origins for the configured dev port(s). Deterministic and free of
 * side effects apart from reading env via the defaults.
 */
export function buildCsrfOrigins(serverURL: string, options: BuildCsrfOriginsOptions = {}): string[] {
  const origins = new Set<string>()
  if (serverURL) origins.add(serverURL)

  // Vercel Preview deployments are served from their own hostname, but they build with
  // NODE_ENV=production and usually inherit NEXT_PUBLIC_SERVER_URL from Production — so
  // serverURL points at the live domain and the preview's own origin is trusted by nobody.
  //
  // Payload only honours the auth cookie when the request Origin is on this list
  // (auth/extractJWT.js). Browsers send Origin on every POST/PATCH/DELETE but generally omit
  // it on same-origin GETs, so the result is a confusing half-broken admin: reading works,
  // every save fails with "You are not allowed to perform this action" — but only in the
  // collections whose access actually checks `req.user`.
  //
  // Trusting our own preview hostnames fixes that. Production is unchanged: VERCEL_ENV is
  // 'production' there, so nothing extra is ever added to the live allowlist.
  const isPreview = options.isPreview ?? process.env.VERCEL_ENV === 'preview'
  if (isPreview) {
    const hosts = options.previewHosts ?? [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    for (const host of hosts) {
      const origin = normalizeOriginHost(host)
      if (origin) origins.add(origin)
    }
  }

  const isDev = options.isDev ?? process.env.NODE_ENV !== 'production'
  if (!isDev) return [...origins]

  const ports = new Set<string>()
  // Port the serverURL points at (e.g. http://localhost:3001 → 3001).
  try {
    const parsed = new URL(serverURL)
    if (parsed.port) ports.add(parsed.port)
  } catch {
    // serverURL is not a valid absolute URL — fall through to PORT/default.
  }
  // Port the dev server actually binds, when pinned via PORT (next dev honours it).
  const envPort = options.port ?? process.env.PORT
  if (envPort) ports.add(envPort)
  // Nothing resolved (e.g. serverURL had no port) — assume the Next.js default.
  if (ports.size === 0) ports.add(DEFAULT_DEV_PORT)

  for (const port of ports) {
    for (const host of LOCAL_HOSTS) origins.add(`http://${host}:${port}`)
  }

  return [...origins]
}
