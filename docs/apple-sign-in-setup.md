# Sign in with Apple (iCloud sign-in) — setup runbook

"Sign in with Apple" is what users mean by signing in with their iCloud/Apple
ID. The code path is complete and shipped; it is gated off behind
`NEXT_PUBLIC_APPLE_AUTH_ENABLED` until the Apple Developer portal side exists.
This document is the portal walkthrough plus the deploy checklist.

Cost note: Sign in with Apple requires a **paid** Apple Developer Program
membership (USD 99/year). There is no free tier for it.

---

## 1. Apple Developer portal

All of this happens at <https://developer.apple.com/account/resources>.

### 1.1 App ID

`Identifiers` → `+` → **App IDs** → **App**.

- Description: `ZeroGEX`
- Bundle ID (explicit): `com.zerogex.app`
- Under **Capabilities**, tick **Sign in with Apple**.
- Register.

An App ID is required even though there is no iOS app — it is the parent the
web Services ID is grouped under.

### 1.2 Services ID → this is your `APPLE_CLIENT_ID`

`Identifiers` → `+` → **Services IDs**.

- Description: `ZeroGEX Web`
- Identifier: `com.zerogex.web.signin` — **this exact string is
  `APPLE_CLIENT_ID`.** It is not the bundle ID above, and the two must differ.
- Register, then re-open it, tick **Sign in with Apple**, and press
  **Configure**:
  - Primary App ID: the App ID from 1.1.
  - **Domains and Subdomains**: `zerogex.com` (apex domain, no scheme, no path)
  - **Return URLs**: `https://zerogex.com/api/auth/oauth/apple/callback`

Return URLs are matched **byte for byte**. A trailing slash, `www.`, or `http`
produces `invalid_request` at the authorize step. Apple rejects `http://` and
bare `localhost` outright — see [Local testing](#5-local-testing).

### 1.3 Signing key → your `.p8`

`Keys` → `+`.

- Key Name: `ZeroGEX Sign in with Apple`
- Tick **Sign in with Apple**, **Configure**, choose the App ID from 1.1.
- Register → **Download**. You get `AuthKey_XXXXXXXXXX.p8`.

**Apple lets you download this file exactly once.** Put it in the password
manager immediately. If it is lost, revoke the key and make a new one.

Note the **Key ID** (10 chars, shown next to the key) and your **Team ID**
(10 chars, top right of the portal).

---

## 2. Environment variables

```bash
APPLE_CLIENT_ID=com.zerogex.web.signin
APPLE_REDIRECT_URI=https://zerogex.com/api/auth/oauth/apple/callback
APPLE_TEAM_ID=ABCDE12345          # Team ID
APPLE_KEY_ID=XYZ9876543           # Key ID from 1.3
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
NEXT_PUBLIC_APPLE_AUTH_ENABLED=1
```

`APPLE_PRIVATE_KEY` is the contents of the `.p8`. Both a real multi-line PEM
and a single line with literal `\n` escapes are accepted — pick whichever your
secret store round-trips cleanly. To produce the single-line form:

```bash
awk 'BEGIN{ORS="\\n"} {print}' AuthKey_XYZ9876543.p8
```

### Why there is no client secret to paste

Every other provider hands you a static `CLIENT_SECRET`. Apple does not. The
client secret is an **ES256 JWT you sign yourself** with the `.p8` key, and
Apple caps its lifetime at six months. A hand-generated one is a scheduled
outage.

`core/oauth.ts:getAppleClientSecret()` therefore mints the JWT from the three
values above, caches it in-process, and re-mints it a day before expiry. There
is nothing to rotate on a calendar; rotating the `.p8` key is the only manual
step, and only if it leaks.

`APPLE_CLIENT_SECRET` still exists as an escape hatch: set it and it overrides
the signing key, at the cost of owning the six-month rotation yourself. Leave
it empty.

### `ZEROGEX_END_USER_TOKEN_SECRET`

Already required elsewhere. Sign-in works without it, but **linking** an Apple
ID to an existing account from `/account` needs it (see
[section 4](#4-why-apple-needs-code-google-did-not)). Without it the Connect
button returns to `/account` with "Apple account linking is not available
right now."

---

## 3. Turning it on

1. Set the vars in the deploy environment (not `.env.example`).
2. `NEXT_PUBLIC_APPLE_AUTH_ENABLED` is inlined into the browser bundle at build
   time — it needs a **rebuild**, not just a restart, to take effect.
3. Deploy, then verify in a private window:
   - `/login` shows "Continue with Apple" as an enabled button.
   - Clicking it reaches `appleid.apple.com`, not an Apple error page.
   - Completing sign-in lands on `/pricing` (new/unpaid) or `/dashboard`.
   - `/account` → Sign-in methods shows Apple as **Connected**.
   - Disconnect works, and is refused if Apple is the only sign-in method left.
4. Sign in again with the same Apple ID and confirm you land on the *same*
   account rather than a duplicate.

To roll back, set `NEXT_PUBLIC_APPLE_AUTH_ENABLED=0` and rebuild. The button
reverts to the inert "coming soon" state; the routes stay reachable but refuse
with `apple_not_configured` once the credentials are also removed.

---

## 4. Why Apple needed code Google did not

Two Apple-specific behaviours break assumptions the Google flow relies on. Both
are handled; this section is here so nobody "simplifies" them back out.

**`response_mode=form_post`.** Google returns the user via a top-level GET
redirect. Apple POSTs the result cross-site to our callback. A `SameSite=Lax`
cookie is withheld on cross-site POSTs, so:

- The `state`/`nonce` cookies are set `SameSite=None; Secure` in
  `apple/start/route.ts`. With `Lax` they never arrive and *every* sign-in
  fails as `apple_state_mismatch`. This is the single most common way this
  integration is mis-shipped.
- The **session cookie is also withheld**, so the callback cannot identify a
  signed-in user for account linking. `apple/start` instead resolves the
  session while it still can and passes a short-lived signed ticket forward —
  `core/oauthLinkTicket.ts`. The ticket names an account; it is not a
  credential.

`SameSite=None` requires `Secure`, so the Apple flow is HTTPS-only. That costs
nothing, because Apple already requires an HTTPS return URL.

**Email is returned once.** Apple includes `email` in the `id_token` on the
first authorization only. Re-authorizations may omit it. We key accounts on the
stable `sub` claim, so returning users resolve correctly through
`user_identities`. Users who chose **Hide My Email** arrive with a
`@privaterelay.appleid.com` address; that is a real, deliverable relay address
as long as the sending domain is registered with Apple, but it is worth knowing
before debugging "why is this user's email weird".

Apple also sends the user's *name* only on first authorization, in a `user`
form field. The `users` table has no name column, so we discard it. If a name
is ever added, capture it in the callback's `POST` handler — it will not be
available on any later sign-in.

---

## 5. Local testing

Apple will not accept `http://localhost`. Options:

- Point `APPLE_REDIRECT_URI` at a staging domain and test there.
- Or tunnel: `cloudflared tunnel --url http://localhost:3000`, add the
  generated HTTPS hostname to the Services ID's Domains **and** Return URLs,
  and set `APPLE_REDIRECT_URI` / `NEXT_PUBLIC_APP_URL` to match. Tunnel
  hostnames change per run unless you use a named tunnel, and each new one
  needs re-registering in the portal.

A second Services ID (e.g. `com.zerogex.web.signin.dev`) pointed at staging
keeps production's return URLs untouched.

---

## 6. Failure codes

Callback failures redirect to `/login?error=<code>`; `app/login/page.tsx`
turns each into user-facing copy. When debugging, the code in the URL is the
fastest triage:

| Code | Meaning | Usual cause |
| --- | --- | --- |
| `apple_not_configured` | Credentials missing or `.p8` unreadable | Env var unset; malformed `APPLE_PRIVATE_KEY` |
| `apple_state_mismatch` | State/nonce cookie absent or mismatched | `SameSite` regression; user idle >10 min |
| `apple_token_exchange_failed` | Apple rejected the token call | Wrong Team/Key ID, wrong `.p8`, redirect URI mismatch. **Check the server log** — Apple's `invalid_client` body is logged there and never shown to the user |
| `apple_missing_id_token` | Response had no `id_token` | Apple-side; retry |
| `apple_profile_invalid` | `id_token` failed verification | Clock skew, nonce mismatch, `APPLE_CLIENT_ID` ≠ the Services ID |
| `apple_account_unavailable` | Account exists but cannot sign in | Soft-deleted account |
| `apple_rate_limited` | Signup rate limit hit | Many new signups from one IP |
| `apple_cancelled` | User pressed Cancel | Not an error |

`invalid_client` from Apple is almost always one of: `APPLE_CLIENT_ID` set to
the App ID instead of the Services ID, a Team/Key ID typo, or a mangled
`APPLE_PRIVATE_KEY` (check the `\n` escaping survived your secret store).

---

## 7. Apple's review requirement

Apple's App Store guidelines require apps that offer other third-party sign-in
options to also offer Sign in with Apple. That rule binds App Store
submissions, not websites — it does not apply to this deployment today, but it
does the moment ZeroGEX ships an iOS app alongside Google sign-in. Enabling it
here now means that box is already ticked.

---

## Files

| File | Role |
| --- | --- |
| `frontend/core/oauth.ts` | Apple config, client-secret JWT minting, `id_token` verification |
| `frontend/core/oauthLinkTicket.ts` | Signed link tickets for the cross-site POST callback |
| `frontend/core/authFlags.ts` | `isAppleAuthEnabled()` — the browser-side gate |
| `frontend/app/api/auth/oauth/apple/start/route.ts` | Authorize redirect, `SameSite=None` flow cookies |
| `frontend/app/api/auth/oauth/apple/callback/route.ts` | Token exchange, sign-in and linking |
| `frontend/app/login/page.tsx` | "Continue with Apple" button and error copy |
| `frontend/app/account/page.tsx` | Connect / Disconnect row |
| `frontend/tests/auth.test.ts` | Client-secret JWT and link-ticket coverage |
