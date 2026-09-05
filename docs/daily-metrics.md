# Daily metrics — one row per day, and the four relationships it answers

Admin → Monitoring → **Daily Signals**.

## Why it exists

The rest of the admin dashboard measures things over rolling windows: trailing
24 hours, trailing 7 days, a live headcount. Rolling windows are the right shape
for "how are we doing right now", and the wrong shape for "does X cause Y" — a
rolling 24-hour number moves whenever a single event enters or leaves the
window, which makes ordinary Poisson noise look like a trend and makes a
genuine weekly cycle invisible.

This table fixes the measurement to a calendar day so those questions become
answerable:

| Column | Meaning |
| --- | --- |
| `date` | The America/New_York calendar day. Same day boundary as every other chart on the admin page. |
| `trial_starts` | Free trials that began. |
| `paid_starts` | Subscriptions that started paying immediately (no trial). |
| `cancels` | Members who clicked cancel. |
| `payment_failures` | Invoices whose first charge attempt was declined. |
| `registrations` | Accounts created. |
| `unique_users` | Distinct logged-in users who viewed a page. |
| `pageviews` | Page views, logged-in and anonymous. |
| `x_impressions` | X (Twitter) impressions. |
| `x_profile_visits` | X profile visits. |
| `google_clicks` | Google Search clicks. |
| `google_impressions` | Google Search impressions (carried in the same export as clicks; makes the click count interpretable). |

## Where each number comes from

Everything except the X and Google columns is **derived** from tables this app
already keeps forever, which is what makes a full historical backfill possible
rather than a fresh collection starting from today:

- **`trial_starts` / `paid_starts`** — a subscription's *first* observed
  paid-tier `stripe_subscription_sync` audit row. `trialing` at that moment is a
  trial start; anything else is a direct paid start. Keyed by subscription id, so
  a webhook redelivery counts once and a member's second trial counts twice.
  Together they are the same "signups" line the growth-rate card already counts,
  split by whether money moved on day one.
- **`cancels`** — `stripe_cancellation_requested` / `cancellation_ack_email_sent`,
  deduped per member per day. This is the day the member *clicked cancel*, not
  the later day their access lapsed, because the decision is what a weekday
  effect would live in.
- **`payment_failures`** — `stripe_payment_failed … (attempt 1)`, deduped per
  invoice. Stripe's Smart Retries emit a row per attempt; only the first counts.
- **`registrations`** — rows in `users`, by `created_at`. One row per account, so
  it cannot double-count the way an audit stream can.
- **`pageviews` / `unique_users`** — `page_view_events`, bucketed by UTC hour in
  SQL and folded onto ET days in JS (grouping straight to a day would need a
  fixed UTC offset, which is wrong for half the year).

The X and Google columns cannot be derived: neither console has credentials
configured in this app. They are imported from the per-day CSV each console
exports — see **Importing** below.

### NULL is not zero

A blank cell means *not measured*; `0` means *measured, and it was zero*. Days
before the analytics beacon shipped have NULL pageviews, not 0, and a day with
no X import has NULL impressions, not 0. Every correlation drops pairs where
either side is NULL rather than coercing them, because treating "not measured"
as "measured zero" is the fastest way to manufacture a relationship out of
missing data.

## Storage

Three objects, created by the lazy migration in `frontend/core/db.ts` (so
`make migrate` is all a deploy needs):

- **`daily_metrics`** — the derived columns. A cache: `make backfill-daily-metrics`
  rebuilds it from scratch, and re-running is idempotent.
- **`daily_external_metrics`** — the imported X / Google columns. Kept in a
  *separate* table specifically so a rollup rebuild can never clobber
  hand-imported history.
- **`daily_metrics_view`** — the joined one-row-per-day shape, for ad-hoc
  `sqlite3` querying outside the app:

  ```sh
  sqlite3 /var/lib/zerogex/auth.db \
    "SELECT * FROM daily_metrics_view WHERE day >= date('now','-30 days');"
  ```

### The one thing that is not a cache

`page_view_events` rows are pruned after 180 days (`RETENTION_DAYS` in
`core/pageAnalytics.ts`). Once a day ages past that horizon its raw rows are
gone and `pageviews` can never be recomputed — this table is where those daily
totals survive. The upsert therefore refuses to overwrite a captured count with
the `0` a post-prune recompute would produce.

The practical consequence: the rollup has to see a day **at some point within
180 days of it happening**. Opening the Daily Signals panel refreshes it (the
route rebuilds on load, throttled to once every five minutes per process), and
so does `make backfill-daily-metrics`. A six-month margin is generous, but if
the admin page genuinely goes untouched for longer, that window's page-view
history is lost.

## Backfilling

```sh
make backfill-daily-metrics
```

Reconstructs the entire history and prints the relationship tests. Options:

| Variable | Effect |
| --- | --- |
| `DAYS=<n>` | Limit how far back to rebuild (default: all history). |
| `X_CSV=<path>` | Import an X analytics daily export first. |
| `GOOGLE_CSV=<path>` | Import a Search Console "Dates" export first. |
| `COMBINED_CSV=<path>` | Import the CSV the admin page itself downloads. |
| `REPORT=0` | Rebuild only; skip the readout. |

```sh
make backfill-daily-metrics X_CSV=~/x-analytics.csv GOOGLE_CSV=~/search-console.csv
```

## Google Search Console (automatic)

Once credentials are configured, this column keeps itself current: a daily timer
runs `make sync-search-console`, which pulls per-day clicks and impressions
straight from the Search Console API. The panel also has a **Sync Google now**
button for an on-demand pull.

### Setup, once

1. **Google Cloud console** → create a service account → create a **JSON key**.
   It needs no IAM roles; the account is authorized on the Search Console
   property, not on the project.
2. Enable the **Google Search Console API** on that project.
3. **Search Console → Settings → Users and permissions → Add user** → paste the
   service account's `client_email` → Full or Restricted. *This step is the one
   people forget; skipping it produces a 403, and the sync says so in those
   words.*
4. Put the key file somewhere the app user can read (`chmod 600`), then in
   `frontend/.env.local`:

   ```sh
   GSC_SITE_URL=sc-domain:zerogex.io          # exactly as Search Console names it
   GSC_SERVICE_ACCOUNT_KEY_FILE=/var/lib/zerogex/gsc-service-account.json
   ```

   `GSC_SITE_URL` must match the property exactly: a Domain property is
   `sc-domain:example.com`, a URL-prefix property is `https://example.com/`
   *including* the trailing slash. A mismatch produces a 404, and again the sync
   names the fix.

   Alternatives: `GSC_SERVICE_ACCOUNT_JSON` holds the key inline instead of by
   path; `GSC_DATA_STATE=final` restricts the pull to Google's finalized
   numbers (the default `all` includes fresh days, which later runs correct).

5. Deploy step `099.search-console` installs the timer and runs a `DRY_RUN`
   smoke test, so a credential or permission mistake surfaces at deploy time
   rather than at 04:40 the next morning.

### Backfill

Search Console retains ~16 months. Load all of it once:

```sh
make sync-search-console DAYS=480
```

Then the timer keeps up. `DRY_RUN=1` fetches and prints without writing;
`END=<YYYY-MM-DD>` moves the window's end.

### Two behaviours worth knowing

- **Google runs ~2 days behind and revises what it already reported.** Each run
  therefore re-fetches a trailing window (`GSC_SYNC_DAYS`, default 14) rather
  than just yesterday, so revisions land and a missed run heals on the next tick
  instead of leaving a hole.
- **A day Google omits is not automatically a zero.** It omits a day both when
  the site truly had no impressions and when the day is too new to have been
  processed. The sync bounds "real zero" by the newest day Google actually
  returned: missing days at or before it are written as `0`, anything after it
  is left `NULL` for a later run. Writing `0` for a day Google simply has not
  counted would assert an absence of traffic that nobody measured.

## Importing X (manual)

X has no equivalent automation, and not for want of trying: the public API
exposes impressions only per-tweet under OAuth user context, and **account-level
profile visits is not in the API at all** — it exists only in the Analytics UI.
So this one stays a paste.

Analytics → Account overview → export the daily view. The importer reads
`Impressions` and `Profile visits` and ignores the rest.

**Batching.** X only exports a bounded date range, so a year of history arrives
as a stack of monthly CSVs. The file picker takes **several files at once** and
imports them in filename order; overlapping exports are harmless, because an
import overwrites only the days and columns it actually contains. From the
command line, `X_CSV=<path>` takes one file per run — loop it, or concatenate
into the combined shape below.

The import card shows how current each feed is ("X: current through 2026-08-28 —
7 days behind") and turns amber past three days, so a lapsed import is visible
rather than silent.

### Both feeds, from the panel or the command line

- **Google:** Search Console → Performance → Export → the **Dates** sheet. Only
  needed for a one-off or before the API is wired up.

Both exports carry a bare `Impressions` column meaning different things, so the
source is an explicit choice in the UI (and an explicit variable on the command
line) rather than something sniffed from the file.

The importer is tolerant of what the consoles actually emit — a UTF-8 BOM, a
title line above the header, quoted thousands separators, tab-delimited files,
`M/D/YYYY` dates from a spreadsheet round-trip — and it reports the lines it
could not read instead of silently dropping them. Re-importing a corrected
export overwrites only the days and columns that export contains, so importing
Google numbers can never blank the X numbers for the same days.

## Reading the four relationships

Each card states its hypothesis, reports the lags named **in advance**, and
draws the whole 0–14 day lag profile underneath.

1. **X impressions → trial starts** (same day, next day)
2. **X profile visits → trial starts** (same day, next day) — profile visits are
   closer to intent than impressions, so they should track at least as well
3. **Google clicks → trial starts** (same day, next day)
4. **Trial starts → payment failures at exactly +7 days** — the 7-day trial means
   a cohort's first charge lands a week after it signed up

Plus **day of week** for registrations, trial starts, cancels and payment
failures, tested with a one-way ANOVA across the seven weekdays. The default
**Combined** view stacks all four on one axis — acquisition above the line,
churn below — with each metric's own verdict listed underneath; the per-metric
views carry the error bars and are where a churn weekday effect is actually
legible, since acquisition dwarfs it on any healthy week.

### What the numbers mean

- **r** — Pearson correlation. Squared, it is roughly the share of the outcome's
  day-to-day variation the driver accounts for.
- **rank r** — Spearman. Reported alongside r because daily counts here are
  bursty: one viral post can carry a Pearson r on its own. When the two disagree
  sharply, a couple of outlier days are doing the work — trust the rank figure.
- **n** — paired days actually used. Days where either side is NULL are dropped,
  and a lag of *k* costs *k* days off the front.
- **p** — two-sided, under the null that the true correlation is zero.

A relationship is only labeled weak / moderate / strong when it clears both
`n ≥ 10` and `p < 0.05`. An r of 0.5 over 12 days is not a moderate
relationship; it is a coin flip that landed heads.

### The lag profile, and why the highlighted bars are different

The profile shows all fifteen lags. The highlighted ones are the hypothesis
stated up front; the rest are exploratory, and the card labels them that way.
This matters: with fifteen lags on a chart, the largest one is *expected* to
look notable even when nothing is there. "Strongest across 0–14d" is the maximum
of fifteen tries and is reported as such — and it only considers lags that still
have ten paired days, because otherwise the winner is reliably the longest lag,
where the shift has eaten the series down to three pairs and |r| approaches 1
for free.

### The volatility table

Coefficient of variation for each series, raw against its 7-day trailing mean.
This is the direct test of "is the swing real or is it a rolling measurement
bouncing around": a raw series far noisier than its smoothed version is telling
you that a single day's number carries very little information on its own.

## Code map

| File | Role |
| --- | --- |
| `frontend/core/dailyMetricsMath.ts` | Pure: correlation, Spearman, t and F tails, lag alignment, weekday ANOVA, rolling means, ET day bucketing. |
| `frontend/core/dailyMetricsCsv.ts` | Pure: the tolerant CSV reader for both console exports. |
| `frontend/core/dailyMetrics.ts` | Rebuild, import, read, and the panel's snapshot. Deliberately not `server-only` and using relative imports, so the backfill script can load it under bare Node. |
| `frontend/app/api/admin/monitoring/daily/route.ts` | Admin-gated `GET` (snapshot) and `POST` (CSV import, CSRF-protected). |
| `frontend/app/admin/monitoring/DailySignals.tsx` | The panel. |
| `frontend/core/searchConsole.ts` | Search Console client: service-account JWT → access token → `searchAnalytics.query`, and the zero-vs-NULL rule for days Google omits. |
| `frontend/scripts/backfill-daily-metrics.mts` | `make backfill-daily-metrics`. |
| `frontend/scripts/sync-search-console.mts` | `make sync-search-console`, run daily by `deploy/steps/099.search-console`. |
| `frontend/tests/dailyMetricsMath.test.ts` | Pure-function suite — `npm run test:daily-metrics`. |
| `frontend/tests/searchConsole.test.ts` | Search Console suite (config, day ranges, response mapping, a real signed assertion) — `npm run test:search-console`. |
| `frontend/tests/dailyMetrics.test.ts` | DB suite against a throwaway SQLite file (column definitions, the retention guard, importer merge semantics, the view) — `npm run test:daily-metrics-db`. |
