# Maxim Adamenko: free research export of SPY/QQQ wall history, Jun 29 to Nov 25 (2026-11-26)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Wed Nov 25, 5:30 PM, from adamax.you@gmail.com to support.
Subject: "Non-commercial research access: original SPY/QQQ summary history,
29Jun–25Nov2026".

He's running an independent, non-commercial study of price reactions at SPY
and QQQ call and put walls, over the 106 sessions from June 29 to November 25.
He wants the walls as originally recorded, not rebuilt: symbol, as-of
timestamp, `call_wall`, `put_wall`, expiry scope, any methodology changes, and
input-availability timestamps if we keep them. He doesn't want contract quotes
or live access. He asks for a free one-time export or a temporary research key,
and for the format, usage and attribution terms. He'll publish methodology and
aggregate results (negatives included) with attribution and a link, and won't
republish the data, sell signals or build a competing service.

> **Status:** sent Nov 27. Stripe code `ZGXRESEARCH` created. Owed: a
> follow-up email with the answers to points 3 and 5 (see "Owed after
> sending"). No deadline; his code works from Dec 2.

## The read

- **No custom export. What he wants is already in the Pro API.**
  `/api/gex/historical` gives the call wall, put wall, flip, net GEX and max
  pain in 1-minute rows, starting June 29, 2026 for SPY and QQQ
  (`data-coverage.md`, "Historical depth"). His count of 106 sessions is
  right. A hand-built export would mean running queries against production for
  a non-customer, with no end date on what he holds.
- **Recommended: one free month of Pro through a one-time Stripe code.** It
  costs one $59 month. When he cancels, his plan drops and the Stripe webhook
  switches his API key off by itself (`revokeApiKeysIfTierDropped`), so
  there's nothing to clean up.
- **The code only works from Wed Dec 2.** He has no account
  (`diagnose-user`, Nov 26), so he'll sign up as a first-time member. Until the
  sale closes at the end of Dec 1, checkout gives first-time members the sale
  discount and hides the promotion-code box
  (`app/api/billing/checkout/route.ts`).
- **The risk is the result, not the data.** He'll publish negative results
  with your name on them. That fits a site that publishes its own receipts.
  The draft asks for a copy beforehand, to catch data mistakes only.
- **The Terms need your written permission to publish** (Section 6, "redistribute
  content without our written permission"). The publishing paragraph is that
  permission, with his own limits written back to him.
- **"DEFAULT_CHAIN" isn't ours.** It's not in this repo or the public API
  schema. With no account, he's reading the free pages or the free MCP server.
  The draft doesn't repeat the term.

## What's verified, and what isn't

Checked against the public API schema (`api.zerogex.io/openapi.json`) and this
repo on Nov 26.

- **Verified: one timestamp per row.** The history row (`GEXSummary`) has a
  single `timestamp` field. Nothing else is a time. Historical endpoints stamp
  the bucket start, and `/api/gex/historical` returns "the last snapshot
  inside" each bucket. Parameters: `symbol`, `start_date`, `end_date`,
  `timeframe` (default `1min`), `window_units` (max 90), newest first.
- **Verified: the chain today is the ten nearest expirations** around the
  price (`content/methodology.md`; production env checked Nov 4 in the Paolo
  note: `INGEST_EXPIRATIONS=10`). The two extra monthlies are SPX and NDX only.
  So the first draft's "every listed expiration" was wrong.
- **Not verified: whether the depth was always ten.** Several zerogex-oa docs
  said production kept only the three nearest expirations (Ron note). If
  that was true at some point after June 29, the walls in his window were
  built from different chains. That's exactly the methodology change he asked
  about.
- **Not verified: whether recent rows are stored or rebuilt.** The endpoint's
  own description says "buckets older than [the per-strike window] carry the
  walls and `net_gex` stored with the snapshot". That implies newer rows
  (roughly the last 60 days, so about Sept 27 onward) are built from
  strike-level detail. If so, the first draft's "the summary history isn't
  recomputed" was wrong for a third of his window.
- **Your git log doesn't answer either question.** It ran in `zerogex-web`,
  the website. Wall and chain logic live in `zerogex-oa`, which this session
  couldn't open.

## Owed after sending

The draft promises him answers to points 3 and 5. To get them, open a Claude
session on zerogex-oa and paste:

> For /api/gex/historical (`src/api`), do rows inside the per-strike
> retention window return the call_wall and put_wall stored in gex_summary,
> or are they recomputed from gex_by_strike at request time? Then list every
> change between 2026-06-29 and 2026-11-25 that affects how gex_summary's
> call_wall and put_wall are computed for SPY and QQQ, with dates. Include any
> change to how many expirations are ingested (INGEST_EXPIRATIONS), and how
> strikes are aggregated across expirations.

Bring me the answer and I'll write the follow-up email.

## Steps

1. **Create the code in Stripe** (Live mode, not a sandbox). Product catalog,
   Coupons, **+ Create coupon**:

   | Field | Value |
   |---|---|
   | Name | `Pro research month` (he sees this at checkout) |
   | Type | Fixed amount discount, **$59.00 USD** |
   | Apply to specific products | On, **Pro** only |
   | Duration | **Once** |
   | Use customer-facing coupon codes | On, code **`ZGXRESEARCH`** |
   | Eligible for first-time order only | Off |
   | Limit to a specific customer | Off |
   | Limit the number of times this code can be redeemed | **1** |
   | Add an expiration date | **Thu Dec 31, 2026, 11:59 PM** ET |
   | Require minimum order value | Off |

   $59 off once is one free month of Pro monthly. On annual he'd pay $240,
   which is why the draft says monthly. A coupon's products can't be changed
   after it's made, so check "Pro only" before saving.

2. **Send the draft** in his thread.

3. **Later (optional):** once he's redeemed it,
   `make diagnose-user EMAIL=adamax.you@gmail.com` should show `pro`. If he
   forgets to cancel, month two bills $59, and the 7-day money-back guarantee
   runs from that first real charge.

## Draft

Hi Maxim,

Thanks for the careful note, and for asking before pulling anything.

You don't need a custom export: what you're describing is already in our Pro API. /api/gex/historical returns the call wall, put wall, gamma flip, net GEX and max pain for SPY and QQQ, one row per minute with timeframe=1min. That history starts on June 29, 2026, so all 106 of your sessions are there. It's JSON, newest first, up to 90 rows per request, and you page back with start_date and end_date. That's several hundred requests per symbol, which fits within the rate limit if you pace them. The reference is at api.zerogex.io/docs.

I'm glad to support the study, so a month of Pro is on me. Go to zerogex.io/pricing, choose Pro monthly, and enter ZGXRESEARCH under "Add promotion code". The total due today will show $0. The code works from Wednesday, December 2, once our holiday sale ends (the sale takes over checkout until then), through December 31. Stripe will still ask for a card. Generate your key under Account, then API Access, pull what you need, and cancel from the Account page before the month is up so you won't be charged. Canceling also switches the key off.

Some details that matter for your design:

1. Timestamps. Each row has one timestamp, the start of its minute, and carries the last snapshot taken during that minute. Treat it as known at the end of the minute, not the start. Lining rows up by their stamp with price from inside the same minute gives the test a small look-ahead. We don't store a separate input-availability time.

2. Expiry scope. The walls come from the chain we load for each symbol, which today is the ten nearest expirations, at the strikes around the price. That includes the day's 0DTE options until the close.

3. Recorded versus rebuilt. Rows older than about 60 days carry the walls exactly as they were stored with that minute's snapshot. For newer rows, I'm confirming whether the history returns those stored walls or rebuilds them from the strike-level detail we keep for 60 days. Either way, save your pull once and work from that file, so your record doesn't shift as rows age past that line.

4. Daily Replay. Use the history rather than Replay. Replay's strike detail only goes back about 60 days, and its per-strike gamma was restated for every past session in a fix this November, so it isn't a record of what was published at the time.

5. Methodology changes. I'm putting together the list of changes in your window that affect the walls, including whether the number of expirations in the chain changed. I'll send it along with the answer to point 3.

On publishing: you have my permission to publish your methodology, aggregate findings and limitations, including negative or inconclusive results, credited as "Data: ZeroGEX" with a link to zerogex.io. A few example sessions in a chart are fine. The full series isn't, and please keep the key and the data to yourself. I'd appreciate a copy a few days before it goes up, only so I can check that the data is described correctly. I won't ask you to change your conclusions.

You may also want to read our own wall study, which covers late June through early September and defines a test, a break and a hold precisely: zerogex.io/education/how-often-do-gamma-walls-break. I'd be interested to see how an independent design compares.

Best,
Michael

## If you'd rather not give it free

Replace the "I'm glad to support the study" paragraph with:

Access is through a Pro plan, which is $59 a month. Through Tuesday, December 1, our holiday sale makes your first month $29.50. Choose Pro monthly at zerogex.io/pricing, generate your key under Account, then API Access, pull what you need, and cancel from the Account page whenever you like.

Skip Step 1.

## If he replies

- **"Can you just send a CSV?"** No. The API is the export.
- **He wants per-strike history, or the call/put split, for the whole window.**
  Not available. Per-strike data is kept about 60 days, so most of his window
  is gone.
- **He wants contract quotes after all.** Not on any plan. Point him to his
  broker or a data vendor.
- **He needs more than a month.** Make a second one-use code the same way.
  Don't comp the account: a comp has no end date, so the key would stay live
  until you remembered to revoke it.
- **He sends the draft study.** Check that he used the history and not
  Replay, that he lined rows up at the end of the minute, and that the credit
  and link are there. Anything else is his call.
