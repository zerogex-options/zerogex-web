# Quarterly Folds of Honor Receipt Workflow

Once each quarter (Jan, Apr, Jul, Oct) you make the donation and publish the
receipt. The whole publish loop is one command:

```bash
make quarterly-receipt
```

Interactive. Walks you through everything. Nothing to remember.

## What the one command does

1. Prompts you for the donation amount, quarter label (suggests the previous
   calendar quarter), and date (defaults to today).
2. Shows a summary of every action it's about to take.
3. Asks "Proceed? [y/N]".
4. On confirm:
   - Updates `frontend/content/giving/totals.json` with the new running total
   - `git add` + `git commit` (`chore(giving): record Q3 2026 donation ...`)
   - `git push origin release`
   - Asks "Rebuild the site now?" — on yes, runs `make rebuild` (build +
     PM2 restart), streaming the output
5. Prints the tweet draft for you to copy into X (with the FOH badge
   attached — that's the one manual publish step remaining).

Safety rails baked in:

- **Won't run on any branch other than `release`.** Prevents you from
  recording a donation on a feature branch by accident.
- **Won't run on a dirty working tree.** Prevents unrelated work from
  getting bundled into the donation commit.
- **Never posts to X.** X posts are public and unedit-able — the tweet is
  printed, you paste it into X yourself. No OAuth surface, no accidental
  autoposts.

## The trigger: calendar reminder, not cron

Because you can only run this **after** you've actually wired money to Folds
of Honor, the trigger has to be a human moment. Two options — pick one:

### Option A — Google/Apple calendar reminder (recommended)

Create a recurring event, one per quarter, at ~09:00 on:

- January 5
- April 5
- July 5
- October 5

Title: *"Send FOH donation + run `make quarterly-receipt`"*

The 5-day gap after quarter-end lets Stripe's revenue for the closing quarter
settle before you compute 3%. That's the moment the receipt is legitimate to
send.

### Option B — Server cron (email reminder only)

If you'd rather get a nudge in email than in your calendar, add this to
`crontab -e` on the EC2 box (adjust the email delivery to whatever notification
path you actually check):

```
# 09:00 ET (14:00 UTC) on Jan 5 / Apr 5 / Jul 5 / Oct 5 — nudge to send the FOH donation
0 14 5 1,4,7,10 * echo "Quarter closed. Send the FOH donation and run: cd ~/zerogex-web && make quarterly-receipt" | mail -s "[ZeroGEX] FOH quarterly donation due" you@example.com
```

We deliberately do NOT cron the `make quarterly-receipt` itself. A cron
that moves money or updates a public ledger without human confirmation is
one config bug away from being embarrassing — the reminder-plus-manual-run
loop keeps the wire step consciously human.

## The (roughly) four-step run-through

### Step 1 — Compute what to send

At the start of the new quarter, pull the closing quarter's gross
subscription revenue from Stripe:

```sql
-- Run in Stripe Sigma. Replace the dates with the closing quarter's window.
SELECT SUM(amount_paid) / 100.0 AS gross_usd_paid
FROM   invoices
WHERE  status = 'paid'
  AND  billing_reason IN ('subscription_cycle', 'subscription_create')
  AND  paid_at BETWEEN '<quarter-start>' AND '<quarter-end>';
```

Multiply by `0.03`. That's your donation.

### Step 2 — Send it

Wire (or donate via card at) **https://foldsofhonorpartners.donorsupport.co/page/ZeroGX**.
This is the ZeroGEX partner-tracked URL — donations through it are credited
to your ZeroGEX partner page inside FOH's donor system, which is what lets
them (and you) see the impact over time.

Save the FOH receipt PDF they email you.

### Step 3 — Run the script

From `~/zerogex-web`:

```bash
git checkout release && git pull    # be on the branch, clean
make quarterly-receipt
```

Answer the prompts. Confirm. It handles the rest.

Non-interactive shorthand if you already have the numbers on hand:

```bash
make quarterly-receipt \
  AMOUNT=1247.50 \
  QUARTER="Q3 2026" \
  DATE=2026-09-30 \
  YES=1
```

Optional flags:

| Flag | Effect |
|---|---|
| `EMAIL=you@example.com` | Also emails the tweet draft to you |
| `NO_PUSH=1` | Commit locally, don't push |
| `NO_REBUILD=1` | Skip `make rebuild` (commit + push only) |
| `YES=1` | Skip the "Proceed?" and "Rebuild?" confirmations |
| `DRY_RUN=1` | Preview only — no file/git/rebuild actions |

### Step 4 — Post the tweet

At the end, the script prints:

```
Copy this tweet into X and attach the Folds of Honor Proud Supporter badge:
──────────────────────────────────────────────────
Quarterly receipt: ZeroGEX just sent $1,248 to @FoldsOfHonor — the Q3 2026 donation
from your subscriptions.

Total donated to date: $1,248.

Full ledger and FAQ: https://zerogex.io/giving

Thank you.
──────────────────────────────────────────────────
```

Post it on X with the Proud Supporter badge attached. That's the ceremonial
publish moment.

## Why we didn't full-automate the tweet

We considered posting the tweet automatically via X's OAuth. Rejected because:

1. **Public statements need a review pass.** Every quarter's tweet might want
   a small tweak — a commemorative day near quarter-end, a subscriber-earned
   matching bonus, a milestone. The paste step is where that judgment happens.
2. **X posts can't be un-sent.** A misrendered dollar amount from a bug in the
   script would sit there forever. The manual paste is a natural sanity check.
3. **X API automation is a maintenance liability.** OAuth tokens rotate,
   rate limits change, endpoints deprecate. The value isn't worth the ongoing
   maintenance burden versus a 15-second paste.

## Troubleshooting

**"Refusing to run on branch 'foo'."** You're not on `release`. Switch:

```bash
git checkout release && git pull
```

**"Refusing to run: working tree has uncommitted changes."** You have work
in progress the script would sweep into the donation commit. Stash or
commit it first:

```bash
git stash        # or: git commit -am "..."
```

**Push failed.** The commit is still in place locally. Fix the push cause
(auth, network) and run `git push origin release`, then `make rebuild`.

**Rebuild failed.** The commit + push succeeded — only the local rebuild
didn't. Run `make rebuild` by hand to complete the deploy.

**Wrong amount, already published.** Editing history on `release` is a
rewrite risk. Instead: run the script again with the negative-adjustment
amount to correct the total, then commit a follow-up message explaining
the correction. The full history stays visible.
