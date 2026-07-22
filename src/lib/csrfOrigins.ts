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
