# Terms-of-Service acceptance — the gap, and what closed it

*Why 898 of 1,116 accounts carried no record of agreeing to the Terms of
Service or Privacy Policy, what was done about it, and the one thing that still
has to be set by hand in the Stripe Dashboard.*

> **Status: fixed forward, and the backlog is being asked.** The acceptance
> columns are now written on every path that can create an account, Stripe
> collects its own acceptance at checkout, and members whose account carries no
> current acceptance are asked for one at their next authenticated page load.
> Nothing was written into the database by hand and no member was emailed.
>
> **The column was NOT backfilled, deliberately.** See §5 — for accounts that
> predate the signup checkbox there was no checkbox to tick, so a written-in
> timestamp would assert an act that did not happen. That is worse than the
> honest blank in the one situation the column exists for.
>
> **One manual step remains:** set a Terms of service URL in the Stripe
> Dashboard (§4b), or the checkout consent box stays off.

## 1. Where the record lives

Two columns on `users`, added by `ensureColumn` in `frontend/core/db.ts`:

| Column | Meaning |
| --- | --- |
| `terms_accepted_at` | ISO instant the member affirmatively accepted |
| `terms_version_accepted` | Effective date of the text they accepted, e.g. `2026-04-25` |

The version is the terms' effective date (`frontend/core/legalTerms.ts`,
`TERMS_VERSION`) rather than an opaque counter, so a row says *which* text was
agreed to. `make diagnose-user EMAIL=...` prints both on one line, and prints
`—` when there is no record — which must be read as "no recorded acceptance",
never as an implied one.

## 2. How the gap opened

Two separate causes, which is why it was not a clean date cutover.

**A date gap.** Acceptance at signup shipped in `91638b2` (2026-08-21), merged
to `release` in `f0ef90d` (2026-08-24). Before it, per that commit's own
message, the register page "had no checkbox, no acceptance copy, and no link to
either document — /terms was reachable only through the global footer." Every
account created before then is NULL because no acceptance was ever collected.

**A path gap, still open until this change.** `registerUser` stamps the columns
and refuses a signup without a current version. But it is not the only way an
account comes into being: `createOrLoginOAuthUser` mints one from a Google or
Apple callback, and that insert never touched the columns. Google OAuth has
been live since 2026-08-19 and Apple since 2026-09-07, so *100% of OAuth
signups had no record* — including accounts created the day this was measured.
The enforcement comment in `serverAuth.ts` claiming "no path creates an account
without a recorded acceptance" was simply not true of that path.

Neither did anything re-ask. Before this change the only reader of either
column anywhere in the tree was `scripts/diagnose-user.mts`; the session
payload did not even carry them, so a NULL gated nothing and persisted forever.

## 3. The measurement (2026-09-12, read-only)

Live accounts (`deleted_at IS NULL`), from `/var/lib/zerogex/auth.db`:

| | Accounts | No record |
| --- | --- | --- |
| **All live accounts** | 1,116 | **898 (80%)** |

Of those 898: **110 had a cleared charge**, 10 held a subscription with no
cleared charge yet, and 778 had never paid. Of the 110 payers, 101 were active
at the time of measurement; 86 signed up by email/password and 24 through
Google.

By signup month — the date gap, closing on 2026-08-21:

| Month | Accounts | No record |
| --- | --- | --- |
| 2026-04 | 27 | 27 |
| 2026-05 | 95 | 95 |
| 2026-06 | 229 | 229 |
| 2026-07 | 277 | 277 |
| 2026-08 | 350 | 240 |
| 2026-09 | 138 | 30 |

By signup method — the path gap, which the month table hides:

| Method | Accounts | No record |
| --- | --- | --- |
| Email/password | 747 | 541 |
| **Google OAuth signup** | **301** | **301 (100%)** |
| Email/password, later linked Google | 68 | 56 |

53 accounts created on or after 2026-08-21 had no record: 52 Google signups
plus one email/password account created on the cutover day itself. That was a
live leak of roughly 2–3 accounts per day, not a historical backlog. Apple had
no signups yet, so its identical defect was latent rather than realised.

## 4. What shipped

### 4a. The acceptance gate (covers the backlog *and* OAuth signups)

`components/TermsAcceptanceModal.tsx`, wired in `ClientLayout` ahead of every
other modal, with `needsTermsAcceptance` in `core/legalTerms.ts` as the gate and
`POST /api/auth/terms-accept` recording the result via
`acceptTermsForRequest`. It presents the same checkbox and the same two links
as `/register`, stores the same version, and writes a `terms_accept` audit event
naming what the acceptance replaced ("no prior acceptance was recorded for this
account").

The gate compares the recorded *version* against `TERMS_VERSION` rather than
merely asking whether something is recorded. That covers three cases with one
rule: a NULL is asked, a superseded acceptance is asked again, and a current one
is left alone — which also gives a future terms revision a working answer for
the first time. Suppressed on the auth and legal routes, `/terms` and `/privacy`
most of all: those are the documents being accepted.

This is also what records the acceptance for a fresh Google or Apple signup,
which is why no version is plumbed through the OAuth round trip. `/login` now
carries a disclosure line under the provider buttons
(`login.oauthTermsIntro`) so a member knows what they are agreeing to before
handing over a provider identity, and the affirmative, version-stamped record is
taken on the other side of the redirect. A checkbox on `/login` itself was
rejected: that page is the sign-in surface for 1,116 existing members, and
gating it would demand a fresh agreement from everyone just to log in.

### 4b. Stripe collects its own acceptance at checkout

`consent_collection: { terms_of_service: 'required' }` on the Checkout session
(`app/api/billing/checkout/route.ts`). Stripe renders the checkbox and records
the acceptance on the session itself — a record held by the processor, which is
the form an issuer weighs. It applies at the moment money is authorized, so from
now on nobody is charged without an acceptance recorded somewhere.

> **Manual step.** Stripe requires a **Terms of service URL** under Dashboard →
> Settings → Public business information before it accepts this parameter, and
> rejects the entire session-create call when it is missing. Checkout must never
> break over this, so the first such rejection latches the parameter off for the
> life of the process, logs `[checkout] Stripe rejected
> consent_collection[terms_of_service]`, and retries without it. **Until that
> URL is set, the consent box does not appear.** Setting it makes the parameter
> apply on the next deploy or restart, with no code change.

### 4c. Coverage

`tests/termsGate.test.ts` (`npm run test:terms-gate`) pins the gate matrix:
absent, current, superseded, empty-string, signed-out, and non-string values
that must not be coerced into consent.

## 5. Why the column was not backfilled

Writing `terms_accepted_at` for the 898 would have cleared the number in one
statement. It was not done, and should not be.

For everything before 2026-08-21 there was no checkbox on the page. The members
did not accept and decline to be recorded; they were never asked. A timestamp
written for them would be a manufactured record of an event that did not happen
— and it would be *worse than the blank* in the exact situation the column
exists for. A blank is an honest "no recorded acceptance". A fabricated row that
a member challenges ("I never ticked anything") converts a weak evidence
position into a credibility problem.

What the pre-cutover accounts do still have is an `audit_events` row of type
`register` carrying the timestamp and IP of the signup act. That evidences the
signup, not an acceptance, and should be cited as exactly that. It must not be
moved into the terms columns.

The consequence of asking instead of backfilling is that the backlog drains as
members return, and accounts that never come back stay NULL. That is the correct
outcome: it is what actually happened.

## 6. Context

A $29 Visa 13.2 dispute (`docs/disputes/du_1U6cn34AOiqteMYYYCr2OaKn.md`, lost)
had to rest its terms argument on "our published Terms of Service, linked in the
footer of every page." That cardholder signed up 2026-08-06 and paid 2026-08-21
— before the stamping — and appears on the no-record list. The loss is not
attributable to the missing acceptance (the issuer cited subscription
cancellation and filed its own documentation), but it is the concrete shape of
the exposure: the evidence package had to be written around a hole that a
recorded acceptance would have filled.

## 7. Re-measuring

The read-only query set used for §3 is in the session notes; the short version,
run on the host holding the auth DB:

```sh
sqlite3 -readonly /var/lib/zerogex/auth.db "
SELECT COUNT(*) AS accounts,
       SUM(terms_accepted_at IS NULL) AS no_record,
       SUM(terms_accepted_at IS NULL AND first_payment_at IS NOT NULL) AS paying_no_record
  FROM users WHERE deleted_at IS NULL;"
```

`paying_no_record` is the number that matters, and it should now fall as members
sign in rather than grow. If it grows, a path is creating accounts without going
through either gate — check `INSERT INTO users` sites in `core/serverAuth.ts`
first.
