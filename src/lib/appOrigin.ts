/**
 * The origin this deployment is actually served from.
 *
 * ── Why this exists ──
 *
 * `NEXT_PUBLIC_SERVER_URL` is a single value shared by every Vercel environment, so a Preview
 * deployment inherits Production's `https://aboks.no`. Anything that builds an absolute URL
 * from it therefore points a Preview visitor back at the live site. For most URLs that is
 * merely wrong; for Kustom's `merchant_urls` it is dangerous — a checkout started on Preview
 * would send its confirmation and its push webhook to **Production**, so a test payment would
 * confirm a real order on the live site.
 *
 * On Preview, Vercel injects the deployment's own hostnames, and those are what this resolves
 * to. `VERCEL_BRANCH_URL` is preferred because it is stable for the branch
 * (`aboks-git-promo-preview-team.vercel.app`); `VERCEL_URL` changes with every build and is
 * the fallback.
 *
 * Production and local development are untouched: `VERCEL_ENV` is `production` (or absent), so
 * the configured `NEXT_PUBLIC_SERVER_URL` is returned exactly as before.
 *
 * Server-only. `VERCEL_ENV` / `VERCEL_URL` / `VERCEL_BRANCH_URL` are not `NEXT_PUBLIC_*`, so
 * they do not exist in the browser bundle — never call this from a client component.
 */

/** The environment variables this decision reads. Injectable so it is testable. */
export interface AppOriginEnv {
  NEXT_PUBLIC_SERVER_URL?: string
  VERCEL_ENV?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_URL?: string
}

export interface ResolveApplicationOriginOptions {
  /** Used when nothing else resolves. Callers keep their own historical default. */
  fallback?: string
  env?: AppOriginEnv
}

/**
 * `aboks-x.vercel.app` / `https://aboks-x.vercel.app/` → `https://aboks-x.vercel.app`.
 *
 * Returns null for anything that is not a real hostname. Deliberately strict — this feeds
 * both callback URLs and an auth allowlist: the protocol is detected on the untouched value
 * (trimming slashes first would turn `http://` into the bogus host `http`), `URL` does the
 * parsing, and a hostname without a dot is rejected as degenerate.
 */
export function normalizeOriginHost(host: string | undefined | null): string | null {
  if (typeof host !== 'string') return null
  const trimmed = host.trim()
  if (!trimmed) return null

  const hasProtocol = /^https?:\/\//i.test(trimmed)
  try {
    const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`)
    if (!url.hostname) return null
    // A BARE value must look like a real hostname before we promote it to https://. Without
    // this, `::::` becomes `https://::::` and `http` becomes `https://http`. An explicit URL
    // is trusted as written, which is what keeps `http://localhost:3000` working locally.
    if (!hasProtocol && !url.hostname.includes('.')) return null
    return url.origin
  } catch {
    return null
  }
}

/** True when this build is a Vercel Preview deployment. */
export function isPreviewDeployment(
  env: AppOriginEnv = process.env as unknown as AppOriginEnv,
): boolean {
  return env.VERCEL_ENV === 'preview'
}

/**
 * The absolute origin to use for callbacks, canonical links and merchant URLs.
 *
 * Preview → its own branch hostname (falling back to the deployment hostname).
 * Everything else → `NEXT_PUBLIC_SERVER_URL`, then `VERCEL_URL`, then the caller's fallback.
 */
export function resolveApplicationOrigin(options: ResolveApplicationOriginOptions = {}): string {
  const env = options.env ?? (process.env as unknown as AppOriginEnv)
  const fallback = options.fallback ?? 'http://localhost:3000'

  if (isPreviewDeployment(env)) {
    // Branch alias first: it survives redeploys, so a Kustom order created by one Preview
    // build still resolves after the next push to the same branch.
    const previewOrigin =
      normalizeOriginHost(env.VERCEL_BRANCH_URL) ?? normalizeOriginHost(env.VERCEL_URL)
    if (previewOrigin) return previewOrigin
    // Neither variable is usable — fall through rather than invent a hostname.
  }

  const configured = normalizeOriginHost(env.NEXT_PUBLIC_SERVER_URL)
  if (configured) return configured

  const vercel = normalizeOriginHost(env.VERCEL_URL)
  if (vercel) return vercel

  return fallback
}
