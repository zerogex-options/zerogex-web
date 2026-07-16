# Quarterly Folds of Honor Receipt Workflow

This is the once-per-quarter loop for publishing the ZeroGEX → Folds of Honor
donation receipt. It is **review-first by design** — nothing is posted to X or
committed to `content/giving/totals.json` without human approval. The script
generates drafts; you (Michael) approve and publish.

## The four steps

### 1. End of quarter — you make the donation

At the end of each calendar quarter (or in the first few days of the next
quarter), you review the Stripe subscription revenue for the quarter, compute
3%, and wire that amount to Folds of Honor. This step is manual — not because
it needs to be, but because we deliberately keep a human in the money loop.

**Suggested Stripe query** (paste into Sigma or run against your billing
dashboard):

```sql
SELECT SUM(amount_paid) / 100.0 AS gross_usd_paid
FROM   invoices
WHERE  status = 'paid'
  AND  billing_reason IN ('subscription_cycle', 'subscription_create')
  AND  paid_at BETWEEN '<quarter-start>' AND '<quarter-end>';
```

Multiply the result by `0.03`. That's the quarter's donation.

Then send that amount to Folds of Honor via the tracked partner donation
URL: **https://foldsofhonorpartners.donorsupport.co/page/ZeroGX**

Save the receipt PDF Folds of Honor emails you.

### 2. Run the draft script

From `~/zerogex-web`:

```bash
make quarterly-receipt-draft \
  AMOUNT=1247.50 \
  QUARTER="Q3 2026" \
  DATE=2026-09-30 \
  EMAIL=founder@zerogex.io \
  WRITE_TOTALS=1
```

Arguments:

| Name | Meaning |
|---|---|
| `AMOUNT` | Dollar amount you actually sent to FOH (`1247.50`, not `$1,247.50`). |
| `QUARTER` | Human label — `"Q3 2026"`, `"Q4 2026"`, etc. |
| `DATE` | Donation date in `YYYY-MM-DD`. |
| `EMAIL` | (Optional) Address to send the review email to. Uses your Resend config. |
| `WRITE_TOTALS` | (Optional) Write the updated JSON to `content/giving/totals.next.json` for review. |
| `DRY_RUN` | (Optional) Print only; skip email and file write. |

The script:

- Reads the current `content/giving/totals.json`
- Appends the new donation to `history`, updates `totalDonatedUsd` and
  `donationsCount`, computes the next quarter-end date, and prints the new
  totals object
- Generates the tweet text using the quarterly-receipt template we drafted
  in `docs/launch-tweets-folds-of-honor.md`
- Prints everything to stdout
- If `EMAIL=` is set, sends a formatted HTML+text summary to that address
- If `WRITE_TOTALS=1`, writes the updated JSON to `totals.next.json`

**Nothing gets posted, and nothing gets committed automatically.** You review.

### 3. Review the drafts

Open the email (or read stdout) and check:

- Is the amount right? (Match against the receipt from FOH.)
- Does the running total look right? (`before + amount = after`.)
- Does the tweet copy feel appropriate for this quarter — anything to
  personalize (Veterans Day period, a milestone, a subscriber-anniversary
  moment)?

Edit the tweet in the email if you want to tweak the copy before posting.

### 4. Publish

**Post the tweet on X** manually. Attach the FOH Proud Supporter badge
image before posting.

**Update the site's running total:**

```bash
# If you used WRITE_TOTALS=1:
mv frontend/content/giving/totals.next.json frontend/content/giving/totals.json

# Or edit frontend/content/giving/totals.json by hand from the printed JSON.

git add frontend/content/giving/totals.json
git commit -m "chore(giving): record Q3 2026 donation to Folds of Honor"
git push origin release   # or the branch you deploy from
```

On the server:

```bash
make rebuild
```

The `/giving` page and `/api/giving/total` endpoint reflect the new totals
after the rebuild.

**(Optional)** post a short `/articles` entry linking to the giving page with
the receipt screenshot — good for repeat-quarter engagement.

## Recommended cron for the reminder (not the post)

If you want a nudge, add this to `crontab -e` on the EC2 box:

```
# 09:00 ET on Oct 1 / Jan 1 / Apr 1 / Jul 1 — reminder to send the FOH donation
0 14 1 1,4,7,10 * echo "Quarter ended. Send FOH donation and run: make quarterly-receipt-draft ..." | mail -s "[ZeroGEX] FOH quarterly donation due" you@example.com
```

Adjust the mail delivery to whatever notification path you actually monitor —
the point is a reminder to run the workflow, not automation of the workflow.

## Why the review-first split

We considered a fully-automated pipeline (cron script queries Stripe, computes
3%, sends the wire via a partner API, drafts and auto-posts the tweet), but
rejected it for three reasons:

1. **The money loop needs a human.** A silent, autonomous system that moves
   dollars is one wire-transfer bug away from being embarrassing. The wire
   is the one step you should always do consciously.
2. **The tweet is a public statement.** X posts can't be un-sent cleanly.
   Every quarter's copy might want a small adjustment for context (a
   commemorative day, a milestone, a subscriber-earned matching bonus). A
   review pass is the natural moment for that.
3. **The JSON change touches a public ledger.** Getting `totalDonatedUsd`
   wrong on `/giving` is worse than being a day late — it undermines the
   credibility of the whole page. The draft-then-merge flow makes the
   value-check impossible to skip.

The script does the mechanical parts (reading the JSON, computing the new
totals, formatting the tweet, sending the email). You do the judgment parts.
