# Miljøregistrering — isolating admin and Miljø account sessions

Status: **implemented in Stage 2.2b** (see «As built» at the end). Admin authentication is
unchanged. This note fixes how the two kinds of login are kept apart.

## How it works today (verified in Payload 3.85.1)

- Every Payload auth collection signs its users in with the **same cookie**:
  `${cookiePrefix}-token` → `payload-token`, `Path=/`, on `aboks.no`
  (`payload/dist/auth/cookies.js`, `generatePayloadCookie`). `cookiePrefix` is global.
- The JWT inside names its collection; Payload's JWT strategy loads the user from that collection
  on every request (`payload/dist/auth/strategies/jwt.js`).
- The token is read from `Authorization: JWT …`, `Authorization: Bearer …` or the cookie
  (`payload/dist/auth/extractJWT.js`). A cookie with an `Origin` header is accepted only from the
  CSRF allowlist (`src/lib/csrfOrigins.ts`).

## The problem

One browser has one Payload session, whatever the collection:

1. Signing in as a Miljø account through Payload's own `POST /api/miljo-accounts/login` replaces
   an administrator's `payload-token` in the same browser — and the reverse. Logging out of one
   logs out of the other.
2. While a Miljø token sits in `payload-token`, admin routes see a Miljø account. That is safe —
   Stage 0 makes every internal rule require the `users` collection, and `miljo-accounts` has
   `access.admin: () => false` — but it is confusing and makes a mistake in one place costly.
3. Both sessions share expiry, CSRF and cookie settings, so tightening one changes the other.

## Options

| | Option | Verdict |
|---|---|---|
| A | Change the global `cookiePrefix` | **Rejected.** Changes admin authentication for everyone, still one shared cookie. |
| B | **Dedicated Miljø session cookie** + a Payload auth strategy that reads only that cookie | **Chosen.** No admin change, no new infrastructure, keeps Payload's password hashing, lockout and hooks. |
| C | Separate host, e.g. `miljo.aboks.no` (host-only cookies are separate by construction) | Possible later on top of B; needs DNS, a Vercel domain, `serverURL`/CSRF changes. Not needed for isolation. |

## Decision (option B)

1. **Own cookie.** Miljø sessions use a separate cookie, e.g. `aboks-miljo-session`:
   `HttpOnly; Secure; SameSite=Lax; Path=/` (or narrowed to the dashboard and its API paths),
   short lifetime matching `miljo-accounts.auth.tokenExpiration`. `payload-token` is used by
   administrators only, exactly as today.
2. **Own login / refresh / logout routes** (Next route handlers under the Miljø API). They call
   `payload.login({ collection: 'miljo-accounts', … })` so the password check, lockout
   (`maxLoginAttempts`, `lockTime`) and the `beforeLogin` rule (account active + verified +
   business customer active) stay Payload's — but they set **only** the Miljø cookie, never
   `payload-token`. POSTs check `Origin` against the same allowlist as Payload.
3. **Payload's built-in endpoints for `miljo-accounts` stop issuing cookies.** `login`,
   `refresh-token` and `logout` on `/api/miljo-accounts/*` are refused unless called by the routes
   above (a `req.context` flag, set server-side only — the same pattern as
   `MILJO_TRUSTED_ACCOUNT_CREATE`).
4. **Miljø auth strategy.** `miljo-accounts.auth.strategies` gets one strategy that reads only the
   Miljø cookie, verifies the JWT and its session id, and loads the account. It ignores
   `payload-token`; the admin's `users` collection never reads the Miljø cookie. Authorisation
   stays per request through `resolveAuthorizedBusinessCustomerId`
   (`src/lib/miljo/businessAccess.ts`), so suspending a business customer or deactivating an
   account still takes effect on the next request.
5. **Admin authentication is not touched** — no change to `users`, `cookiePrefix`, `csrf` or the
   admin panel.

## Until then (Stages 1–2)

There is no Miljø login page and no verification flow, so no Miljø account can sign in
(`emailVerifiedAt` is system-only and nothing sets it yet). Payload's `/api/miljo-accounts/login`
exists but refuses every account in practice. No session collision can happen in normal use.

## Tests the implementation must add

- Signing in as a Miljø account leaves an administrator's `payload-token` (and admin session) intact,
  and the reverse; logging out of one keeps the other.
- A Miljø cookie is not accepted by admin routes or the admin REST API; `payload-token` is not
  accepted by the Miljø strategy.
- Payload's own `/api/miljo-accounts/login|refresh-token|logout` set no cookie.
- Cross-site POSTs to the Miljø routes are refused; lockout and the `beforeLogin` rule still apply.
- Suspended business customer / deactivated account: next request refused with the Miljø cookie.

## As built (Stage 2.2b)

- Cookie `aboks-miljo-session`: `HttpOnly; SameSite=Lax; Path=/; Max-Age=7200`, `Secure` in
  production (`src/lib/miljo/account/session.ts`). The token never appears in a response body.
- Routes `/api/miljo/konto/{logg-inn,logg-ut,glemt-passord,nytt-passord,endre-passord,pin,qr}`.
  Every POST requires an `Origin` from the CSRF allowlist (absent is refused) and a JSON body.
- `payload.login` runs with `req.context.miljoAccountAuthRoute = true`
  (`MILJO_AUTH_CONTEXT`); `guardMiljoAccountOperations` refuses `login` and `refresh` on
  `miljo-accounts` without it, so `/api/miljo-accounts/login|refresh-token` answer 403 and set
  no cookie. Payload's `forgot-password` / `reset-password` stay closed.
- **Deviation from point 4:** no extra Payload auth strategy. Payload never reads the Miljø
  cookie at all; our routes and pages verify it themselves with Payload's own
  `JWTAuthentication` (signature, expiry, session id against the account row) and then the
  per-request access rule. The effect is the same — the REST API and admin panel never see a
  Miljø session — with no change to Payload's auth configuration.
- Sign-out revokes that session id; a password change or reset revokes every session.
- Password reset uses its own one-time token (32 random bytes), stored only as SHA-256 in the
  account's `reset_password_token` column, valid one hour, consumed by one conditional UPDATE.
