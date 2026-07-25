/**
 * Optional Cloudflare Turnstile verification for the review form.
 *
 * The form is already gated behind a secret one-time link, so a visible challenge is not
 * required by default. This module is the architectural hook:
 *
 *  • If TURNSTILE_SECRET_KEY is set, the server verifies the token from the client widget.
 *  • If it is not set, verification is skipped in development, and in production we log a
 *    single clear warning that Turnstile is not configured (never the secret, never the
 *    user token).
 *
 * Client side reads NEXT_PUBLIC_TURNSTILE_SITE_KEY; when empty the widget is not rendered.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY)
}

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
}

let warnedMissing = false

/**
 * Returns true when the request may proceed. When Turnstile is not configured this is
 * always true (with a one-time production warning). Never throws; a verification error
 * fails closed only when Turnstile IS configured.
 */
export async function verifyTurnstile(token: string | undefined, remoteIp?: string): Promise<boolean> {
  if (!turnstileConfigured()) {
    if (process.env.NODE_ENV === 'production' && !warnedMissing) {
      warnedMissing = true
      console.warn(
        JSON.stringify({
          scope: 'reviews-turnstile',
          level: 'warn',
          message:
            'Turnstile is not configured (TURNSTILE_SECRET_KEY missing). The review form ' +
            'is protected only by the one-time link, honeypot and rate limiting.',
        }),
      )
    }
    return true
  }

  if (!token) return false

  try {
    const body = new URLSearchParams()
    body.set('secret', process.env.TURNSTILE_SECRET_KEY!)
    body.set('response', token)
    if (remoteIp) body.set('remoteip', remoteIp)

    const res = await fetch(VERIFY_URL, { method: 'POST', body })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error(
      JSON.stringify({
        scope: 'reviews-turnstile',
        level: 'error',
        message: 'Turnstile verification request failed',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    // Configured but unreachable → fail closed.
    return false
  }
}
