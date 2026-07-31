# Pinterest Ads — OAuth 2.0 setup

How the Pinterest Ads expense import authenticates, what has to be registered on the Pinterest
app, and which environment variables are required.

Before this change the import used a manually generated `PINTEREST_ACCESS_TOKEN`. Those tokens
expire, and renewing one meant pasting a new value into Vercel. The integration now runs a real
OAuth 2.0 authorization-code flow with **continuous refresh**: the admin clicks “Koble til” once,
and the server keeps the credential alive on its own.

---

## 1. What the integration asks for

### Scopes

| Scope      | Why |
|------------|-----|
| `ads:read` | The only scope requested. |

The import makes exactly two Pinterest calls, and both need `ads:read`:

- `GET /v5/ad_accounts/{ad_account_id}` — currency and account creation date
- `GET /v5/ad_accounts/{ad_account_id}/analytics` — daily spend

`user_accounts:read` is deliberately **not** requested. Nothing calls `/v5/user_account`, and the
ad account id comes from `PINTEREST_AD_ACCOUNT_ID` rather than being discovered, so it would be a
permission the integration never exercises.

The scope list lives in one place — `PINTEREST_OAUTH_SCOPES` in
`src/lib/pinterest/oauth/config.ts`. Widening it means changing that constant and re-running
“Koble til”.

### Redirect URIs

Both must be registered on the Pinterest app, byte for byte:

```
https://aboks.no/api/pinterest/oauth/callback          ← production
http://localhost:3000/api/pinterest/oauth/callback     ← local development
```

Which one this process uses is decided by `resolveRedirectUri()`:

1. `PINTEREST_REDIRECT_URI`, if set — the escape hatch;
2. otherwise a `localhost` / `127.0.0.1` application origin → the local URI;
3. otherwise the production URI.

The same value is used on the authorization request **and** on the token exchange, because
Pinterest compares them.

> **If your dev server does not run on port 3000** — this repo's `.env.local` sets `PORT=3001` —
> register `http://localhost:3001/api/pinterest/oauth/callback` on the Pinterest app as well and
> set `PINTEREST_REDIRECT_URI` to it in `.env.local`. A Vercel **Preview** deployment deliberately
> falls back to the production URI rather than inventing a `*.vercel.app` value Pinterest has
> never been told about; to authorize from a Preview, set `PINTEREST_REDIRECT_URI` explicitly and
> register that URI too.

---

## 2. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `PINTEREST_APP_ID` | yes | developers.pinterest.com → your app. |
| `PINTEREST_APP_SECRET` | yes | **Secret.** Only ever used to build the HTTP Basic header for the token endpoint. |
| `PINTEREST_AD_ACCOUNT_ID` | yes | Digits only, e.g. `549770607375`. |
| `PINTEREST_TOKEN_ENCRYPTION_KEY` | **in production** | 32-byte key for encrypting stored tokens. Falls back to `PAYLOAD_SECRET` in local development and tests only. |
| `PINTEREST_REDIRECT_URI` | no | Overrides the resolved redirect URI (see above). |
| `PINTEREST_API_VERSION` | no | Defaults to `v5`. |
| `PINTEREST_HISTORY_START` | no | Defaults to `2019-01-01`. |
| `PINTEREST_ACCESS_TOKEN` | no | **Deprecated.** Migration fallback only — see §5. |

None of these may be prefixed with `NEXT_PUBLIC_`. All are server-only.

### Generating `PINTEREST_TOKEN_ENCRYPTION_KEY`

```bash
openssl rand -base64 32
```

Base64, base64url or 64-character hex are all accepted; the decoded value must be **exactly 32
bytes**. A shorter or malformed value is rejected — it is never silently padded or truncated.

**In production this variable is mandatory.** When `NODE_ENV=production` and it is unset, the
Pinterest OAuth paths refuse to run and say so — there is no silent fallback. The check is applied
in three places: `getPinterestOAuthConfig` (so a flow cannot start), the token store (so nothing is
encrypted or decrypted under the wrong key), and `onInit` (so it appears in the boot log). The
Pinterest card shows the same message, and “Koble til” is withheld until it is fixed.

The `PAYLOAD_SECRET` fallback remains for **local development and tests only**. Two reasons it is
not good enough for real traffic: rotating `PAYLOAD_SECRET` would silently destroy every stored
Pinterest token, and it widens the blast radius of a single secret across two unrelated concerns.

`onInit` logs rather than throws: the key is required for Pinterest, but taking down checkout, orders
and the storefront because one marketing integration is misconfigured would be disproportionate. In
production it logs at **error** level so it cannot be mistaken for noise.

**Never commit the key.** `.env`, `.env.local` and `.env*` are already in `.gitignore`. In
production it belongs in Vercel environment variables only.

Rotating the key invalidates the stored tokens by design — reconnect afterwards.

---

## 3. Steps in the Pinterest developer portal

1. Go to <https://developers.pinterest.com/apps/> and open the app.
2. Under **Redirect URIs**, add both URIs from §1. Save.
3. Confirm the app is approved for **Ads** access (`ads:read`) and that the account authorizing
   has access to ad account `PINTEREST_AD_ACCOUNT_ID`.
4. Copy the **App ID** and **App secret** into the environment variables above.

No token is generated by hand. That is the point of this change.

---

## 4. Connecting

1. Admin → **Markedsføringskostnader** → **Pinterest Ads**.
2. Press **Koble til**. The browser goes to Pinterest's consent screen.
3. Approve. Pinterest redirects back to `/api/pinterest/oauth/callback`, which stores the grant
   and returns to the Pinterest card with a success banner.
4. The card shows **Tilkoblet**, with the granted scope, the connection time and when the access
   token will next be renewed.

If something goes wrong the card shows a Norwegian message derived from a short reason code. The
technical detail is in the server log, tagged `[pinterest-oauth] op=…` — Pinterest's raw response
is never shown in the browser.

### Token lifecycle after connecting

- Before every sync the stored access token is checked. More than **24 hours** left → used as-is.
  Otherwise it is refreshed first.
- Because the app was created after **2025-09-25**, Pinterest issues **continuous refresh tokens**:
  every refresh returns a *new* refresh token and retires the old one. Both new values are stored
  together, atomically. `continuous_refresh` is not sent — that flag is the opt-in for older apps.
- A `401` from the Pinterest API triggers **one** forced refresh and **one** retry. A second `401`
  fails the request; there is no retry loop.
- Two concurrent syncs cannot rotate with the same refresh token: a row lock serialises the
  refresh, and a `token_version` compare-and-swap means a loser discards its own grant and adopts
  the winner's rather than overwriting a newer refresh token with an older one.
- If Pinterest rejects the refresh token (revoked, expired), the connection is marked
  **reauthorization_required**, the stored tokens are cleared, and the card offers
  **Koble til på nytt**. **Imported marketing-expense records are never touched** — spend history
  is business data and outlives any authorization.

---

## 5. Removing the legacy `PINTEREST_ACCESS_TOKEN`

The old env token is still honoured, but **only while no OAuth grant is stored**. It exists solely
so a deployment mid-migration keeps importing. It cannot be refreshed.

Once “Koble til” has succeeded:

1. Delete `PINTEREST_ACCESS_TOKEN` from Vercel (all environments) and from `.env` / `.env.local`.
2. Redeploy.

The Pinterest card shows a reminder while the variable is still set. After the OAuth grant exists
the value is never read again, so removing it changes nothing operationally.

`PINTEREST_ACCESS_TOKEN` is no longer part of the “is this channel configured?” check — a
connected integration with no env token is fully configured.

---

## 6. Where the credentials live

`pinterest-connection`, an admin-only, navigation-hidden Payload global backed by the
`pinterest_connection` table (migration `20260731_160000`).

Protections:

1. The global is admin-only at the access-control level.
2. `accessTokenEncrypted`, `refreshTokenEncrypted`, `pendingStateHash` and `pendingStateUserId`
   declare `read: () => false`, so Payload strips them from **every** REST/GraphQL response and
   from the admin panel. Only `src/lib/pinterest/oauth/store.ts` reads them, via
   `overrideAccess: true`.
3. Both tokens are encrypted at rest with **AES-256-GCM** (an AEAD — a tampered ciphertext fails
   authentication and is treated as “no credential”), under a key that is domain-separated per
   integration.
4. Tokens are never returned to the browser, never written to `localStorage`, never logged, and
   never included in an error message. Logs carry only short codes such as `invalid_grant`.

The OAuth `state` is stored **as a SHA-256 hash**, with a ten-minute expiry, bound to the admin who
started the flow, and cleared the moment the callback reads it — which is what makes it one-time.
A database dump yields no replayable state value.

---

## 7. Troubleshooting

| Card / banner says | Cause | Fix |
|---|---|---|
| Ikke konfigurert | Missing `PINTEREST_APP_ID` / `PINTEREST_APP_SECRET` / `PINTEREST_AD_ACCOUNT_ID` | Set them and redeploy. |
| Sikkerhetskontrollen … feilet | State expired (>10 min), was already used, or the flow was restarted | Press “Koble til” again. |
| Pinterest avviste autorisasjonskoden | Code reused or expired; or the redirect URI does not match what is registered | Check §1, then reconnect. |
| Autoriseringen ga ikke lesetilgang til annonsedata | The consent did not grant `ads:read` | Check the app's approved permissions, reconnect. |
| Tilgangen ble gitt, men kunne ikke lagres sikkert | `PINTEREST_TOKEN_ENCRYPTION_KEY` malformed, or neither it nor `PAYLOAD_SECRET` is set | Fix the key (§2), reconnect. |
| Må kobles til på nytt | Pinterest revoked or expired the refresh token | Press “Koble til på nytt”. Imported costs are unaffected. |
| En annen synkronisering fornyer … | Another sync holds the refresh lock | Wait a few seconds and retry. |

Server log tags: `op=start`, `op=callback`, `op=code-exchange`, `op=refresh`, `op=sync-refresh`.
