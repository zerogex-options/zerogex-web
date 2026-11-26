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

> **Status:** draft, unsent. Two lines to fill in (below). No deadline: the
> data isn't going anywhere.

## The read

- **No custom export. What he wants is already in the Pro API.**
  `/api/gex/historical` serves the whole-chain call wall, put wall, flip, net
  GEX and max pain in 1-minute bars, kept forever, starting June 29, 2026 for
  SPY and QQQ (`data-coverage.md`, "Historical depth"). His window starts on
  the first day we have. His count of 106 sessions is right. A hand-built
  export would mean running queries against production for a non-customer,
  with no end date on what he holds. The API gives him exactly what a $59
  customer gets, and nothing more.
- **Recommended: give him one free month of Pro through a one-time Stripe
  code.** It costs you one $59 month and about five minutes in Stripe. When he
  cancels, his plan drops and the webhook switches his API key off by itself
  (`revokeApiKeysIfTierDropped`, Stripe webhook), so there's nothing to
  remember to clean up. In return you get an independent study with a link to
  you.
- **The code only works from Wed Dec 2,** if he's never had a plan. Until the
  Black Friday sale closes (end of Dec 1), checkout applies the sale discount
  to first-time members and hides the promotion-code box
  (`app/api/billing/checkout/route.ts`). The draft says so. Research isn't
  urgent, so a six-day wait costs nothing.
- **If you'd rather he pay,** swap the free-month paragraph for the one under
  "If you'd rather not give it free". It's $29.50 for his first month on the
  sale through Dec 1.
- **The real risk is the result, not the data.** He says he'll publish
  negative results, and the study will carry your name. That fits the brand:
  the site already publishes its own receipts, and your own wall study found
  that nothing measured predicted which walls break. The draft asks for a copy
  before it goes up so you can catch a data mistake (look-ahead, the wrong
  history). It promises you won't ask him to change his conclusions. Asking
  for that would cost you more than a bad result.
- **The Terms require your written permission to publish.** Section 6 bars
  redistributing content "without our written permission", and the license is
  personal or internal use. The publishing paragraph in the draft is that
  permission, with his own limits written back to him: aggregate results,
  attribution and a link, no full data series, and the key stays with him.
- **Point him away from Replay.** He says he checked a sample from the public
  Replay against saved responses. Replay's strike detail only goes back about
  60 days, and its per-strike gamma was restated for every past session in the
  November fix (`data-coverage.md`). For "original recorded levels", the
  summary history is the right source: "the walls and net GEX are the values
  recorded with each summary snapshot."
- **The bar-stamp trap matters for his design.** History rows are stamped at
  the start of the minute and carry that minute's last snapshot (API guide, per
  the Sanjay and Val notes). A closed-bar study that lines rows up by their
  stamp gets a small look-ahead and won't notice it.
- **"DEFAULT_CHAIN" isn't a term anywhere in this repo.** It may be a backend
  label, or his own name for the whole chain. The draft doesn't repeat it. It
  just says "whole chain".
- **Point him to your wall study.** It answers his question over late June to
  early September and states its definitions exactly. That's useful for him,
  and it's a fair benchmark for his results.

## Fill in before sending

1. **Methodology changes (point 5 in the draft).** He asked for them
   directly. Did the way the call and put walls are picked in the summary change
   at any point between June 29 and November 25? Did the November per-strike
   fix touch the summary walls, or only Replay and the Heatmap? I couldn't
   check this from here because the backend repo isn't in this session. In your
   zerogex-oa checkout:

   ```bash
   git log --since=2026-06-29 --until=2026-11-26 --oneline -i --grep=wall --grep=summary
   ```

   - **If nothing changed:** use the default line in the draft.
   - **If something changed:** replace it with one line per change, with the
     date and what moved, e.g. "From October 14, the walls are picked from the
     total across expirations rather than the average."

2. **Per-row timestamps (end of point 3).** Open
   [api.zerogex.io/docs](https://api.zerogex.io/docs), find
   `/api/gex/historical`, and try SPY, 1-minute bars, for one day. If each row
   has only the one timestamp, keep the sentence as written. If there's a second
   time field (observed-at, computed-at, anything like that), change the
   sentence to name it.

## Steps

### 1. Check his account (on the server, in `~/zerogex-web`)

```bash
make diagnose-user EMAIL=adamax.you@gmail.com
```

- **No account found:** fine. He'll sign up at checkout. Send as written.
- **Tier is already `pro`:** drop the free-month paragraph and the code. Write
  instead: "Your Pro key already reaches all of it."
- **Has held a plan before:** the sale doesn't apply to him, so the code box
  shows now. Change "It works from Wednesday, December 2" to "It works now".
- **`Referred by code` shows a code:** checkout applies that discount and
  hides the code box for good. Stop and bring me the output.

### 2. Create the code in Stripe (Live mode, not a sandbox)

Product catalog, Coupons, **+ Create coupon**:

| Field | Value |
|---|---|
| Name | `Pro research month` (he sees this at checkout) |
| Type | Fixed amount discount, **$59.00 USD** |
| Apply to specific products | On, **Pro** only |
| Duration | **Once** |
| Use customer-facing coupon codes | On, code **`ZGXRESEARCH`** |
| Eligible for first-time order only | Off (would block him if he's had a plan before) |
| Limit to a specific customer | Off |
| Limit the number of times this code can be redeemed | **1** |
| Add an expiration date | **Thu Dec 31, 2026, 11:59 PM** ET |
| Require minimum order value | Off |

$59 off once is one free month of Pro monthly. If he picks annual instead, he
pays $240, which is why the draft says monthly. A coupon's products can't be
changed after it's made, so check "Pro only" before saving.

### 3. Fill in the two lines above, then send the reply in his thread

### 4. Later (optional)

After he redeems it, `make diagnose-user EMAIL=adamax.you@gmail.com` should
show `pro`. If he forgets to cancel, month two bills $59, and the 7-day
money-back guarantee runs from that first real charge.

## Draft

Reply in his thread. Your Gmail signature goes under the sign-off.

Hi Maxim,

Thanks for the careful note, and for asking before pulling anything.

You don't need a custom export: what you're describing is already in the Pro API. /api/gex/historical returns the whole-chain call wall, put wall, gamma flip, net GEX and max pain for SPY and QQQ in 1-minute bars. That history is kept permanently and starts on June 29, 2026, so all 106 of your sessions are there. It's JSON, up to 90 rows per request, and you page through it with start_date and end_date. That's several hundred requests per symbol, which fits within the rate limit if you pace them. The reference is at api.zerogex.io/docs.

I'm glad to support the study, so a month of Pro is on me. Go to zerogex.io/pricing, choose Pro monthly, and enter ZGXRESEARCH under "Add promotion code". The total due today will show $0. It works from Wednesday, December 2, once our holiday sale ends (the sale takes over checkout until then), through December 31. Stripe will still ask for a card. Generate your key under Account, then API Access, pull what you need, and cancel from the Account page before the month is up so you won't be charged. Canceling also switches the key off.

A few points about the data that matter for your design:

1. These are the levels as recorded at the time. The summary history isn't recomputed, so each minute shows the walls we published then.

2. The expiry scope is the whole chain: every expiration listed and trading at that minute, including that day's 0DTE options until the close.

3. Each row is stamped at the start of its minute and carries the last value computed during that minute, so treat it as known at the end of that minute, not the start. If you line rows up by their stamp with price from inside the same minute, the test gets a small look-ahead. There's one timestamp per row; we don't keep a separate input-availability time in this history.

4. Use this history rather than Daily Replay. Replay's strike detail only goes back about 60 days, and its per-strike gamma was restated for every past session in a fix this November, so it isn't a record of what was published at the time.

5. The way the call and put walls are picked didn't change during your window.

On publishing: you have my permission to publish your methodology, aggregate findings and limitations, including negative or inconclusive results, credited as "Data: ZeroGEX" with a link to zerogex.io. A few example sessions in a chart are fine. The full series isn't, and please keep the key and the data to yourself. I'd appreciate a copy a few days before it goes up, only so I can check that the data is described correctly. I won't ask you to change your conclusions.

You may also want to read our own wall study, which covers late June through early September and defines a test, a break and a hold precisely: zerogex.io/education/how-often-do-gamma-walls-break. I'd be interested to see how an independent design compares.

Best,
Michael

## If you'd rather not give it free

Replace the "I'm glad to support the study" paragraph with:

Access is through a Pro plan, which is $59 a month. Through Tuesday, December 1, our holiday sale makes your first month $29.50. Choose Pro monthly at zerogex.io/pricing, generate your key under Account, then API Access, pull what you need, and cancel from the Account page whenever you like.

(The sale is half off for the first year and only for people who've never had a
plan. If `diagnose-user` shows he's had one, drop the sale sentence.)

Skip Step 2.

## If he replies

- **"Can you just send a CSV?"** No. The API is the export. It's the same
  data, and you don't have to run anything on production.
- **He wants per-strike history, or the call/put split, for the whole window.**
  Not available. Per-strike data is kept about 60 days, so most of his window
  is gone. The summary walls are what's left, which is what he asked for.
- **He wants contract quotes after all.** Not on any plan. Point him to his
  broker or a data vendor, as the API help page does.
- **He needs more than a month.** Reasonable for a study. Make a second
  one-use code the same way rather than comping the account. A comp has no end
  date, so the key would stay live until you remembered to revoke it.
- **He sends the draft study.** Check three things: that he used the
  summary history and not Replay, that he lined rows up at the end of the
  minute, and that the credit and link are there. Anything else is his call.
