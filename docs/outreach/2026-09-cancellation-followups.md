# Cancellation follow-ups — September 2026

Five members canceled between 2026-08-10 and 2026-08-30. Each left a written
reason. This is the read on each one and a draft reply, ordered by how likely
the reply is to land.

These are **1:1 founder replies, sent from your own inbox** — not campaign
sends. Nothing here goes through `mailer.ts`. That is deliberate: four of the
five wrote a specific sentence about a specific thing, and a templated answer to
a specific complaint reads worse than no answer at all.

> **Before sending:** the per-person "verify first" notes are not boilerplate.
> Two drafts make claims about the recipient's billing state that this document
> cannot see. Run `make diagnose-user EMAIL=<addr>` and check them.

---

## Priority 1 — mglc18@hotmail.com

**Canceled** 2026-08-28 · reason: *"I want data for FUTURES, ES, MES, NASDAQ"*
**Still has access** (cancel is pending, not lapsed).

### The read

They canceled asking for the feature that had **already shipped**, and they
never saw it. The timeline is unambiguous:

| Date | What landed on `release` |
|---|---|
| 2026-08-22 | ES and NQ added to the symbol picker and the public gamma-levels pages (`bb7c16f`) |
| 2026-08-23 | ES / NQ support in the NinjaTrader indicator (`4181034`) |
| 2026-08-25 | Key Levels strip flips between underlyings (`8d59769`) |
| 2026-08-27 | **ES / NQ switched to real-time CME** (`55c9352`) — the day before they canceled |

And this is not "map SPX levels across yourself" — `core/symbols.ts` is explicit
that the backend carries the SPX / NDX option-derived levels **onto the futures
price axis**. That is precisely the thing the FAQ still calls "on the roadmap."

So every item in their sentence is now real: **ES** ✓, **NASDAQ** (NQ) ✓,
**MES** — same S&P 500 index, same price axis as ES, so the ES levels are the
MES levels; only the contract size differs.

### Should you reach out?

**Yes — this is the strongest save on the list, and it is time-boxed.** They
still have access, so they can check the claim in about ninety seconds without
paying anything, and the only thing standing between them and a renewal is that
nobody told them. Send it this week, while the access is live.

### ⚠ Verify first

- Confirm their period end (`make diagnose-user EMAIL=mglc18@hotmail.com`) so
  you can say honestly that the subscription is still on.
- `make users | grep mglc18@hotmail.com` returned an id in a different shape
  (`fd80df8f008b6a0b2c9e12dc`) from the `user_...` ids in the diagnose output.
  Worth a look before you assume the account is in the state you think.

### Draft

> **Subject:** ES and NQ went live the week you left
>
> Hi — I saw you canceled last week, and the reason you left was futures data:
> ES, MES, Nasdaq.
>
> I want to tell you what happened, because the timing here is genuinely
> unlucky. That work shipped while you were away from the app. ES and NQ went
> into the symbol picker on the 22nd, the NinjaTrader indicator picked them up on
> the 23rd, and on the 27th — the day before you canceled — they moved onto a
> real-time CME feed.
>
> The part I think matters most to you: these aren't SPX levels you have to
> convert yourself. The gamma levels are projected onto the ES and NQ price axis,
> so the flip, the call wall and the put wall come through at ES prices. If you
> trade MES, the levels are identical to ES — same index, same axis, just a
> smaller contract.
>
> Two things I should be straight about. There's no separate MES or MNQ symbol —
> you use ES and NQ and the levels carry. And three pages still can't serve
> futures at all (the strategy builder, option contracts, and smart-money flow),
> because those enumerate individual option contracts and there is no ES chain to
> enumerate. For those you'd switch the symbol to SPX or NDX.
>
> Your subscription hasn't lapsed yet, so you can go look right now without
> paying me anything. If it's what you were after, let me know and I'll take the
> cancellation off. If it still isn't, I'd genuinely like to hear what's missing —
> you asked for the right thing once already.
>
> Michael
> Founder, ZeroGEX

---

## Priority 2 — marcos.campos@richporttraders.com

**Canceled** 2026-08-28 · reason: *other* — *"Repeatedly failed to connect using my API"*
**Lapsed** 2026-08-31. Tier is now `public`; the API key was auto-revoked on the
tier drop.

### The read

You asked why they never reached out. The audit trail suggests they hit the wall
almost immediately and never came back:

- 03:21 register → 03:21 verify → 03:22 checkout → 03:24 welcome
- **03:24:47 generated API key `WLgiaEUY`** — 21 seconds after the welcome
- then nothing until the cancel on the 28th

They generated a key inside half a minute of arriving and, four days later,
canceled saying it never connected. There is no support request because there
is no support thread — they tried, it failed, they left. That is the cheapest
kind of churn to fix and the most expensive kind to keep having.

Note the trial never converted: the only invoice is $0.00, status `trialing`
throughout. So this is a **failed activation**, not a lost paying customer.

### Should you reach out?

**Yes.** They wanted to use the thing. A real bug report from them is worth more
than the subscription.

### ⚠ Verify first

- Their key was revoked when the tier dropped, so **any retry needs a fresh
  key** — and a fresh key needs Pro. Don't ask them to "try again" without
  restoring access first.
- Before offering "30 days," check what the reactivation path actually grants
  this account. `REACTIVATION_TRIAL_DAYS=30` is gated on the account still being
  trial-eligible, and this one has already consumed a trial. `make extend-trial`
  or a comp is the likelier mechanism. **Decide the mechanism before you promise
  the number** — that promise is the whole email.

### Draft

> **Subject:** the API connection failures — can you send me the error?
>
> Hi Marcos — you canceled last week and the reason you gave was that you
> repeatedly failed to connect with the API. I only just saw it, and I'm sorry:
> that should have reached me in August, not now. That's a gap on my end and I'm
> fixing it.
>
> I can see you generated a key about twenty seconds after signing up, which
> tells me you came in ready to build something and hit a wall straight away.
> I'd really like to know what the wall was.
>
> If you still have it, anything from this list would help:
>
> - the exact error or HTTP status you got back
> - roughly when you tried (a date and time is enough — I can pull the
>   server side)
> - how you were sending the key
>
> One thing that will trip you up if you retry today: when the subscription
> ended, your API key was automatically revoked, so the old key will fail no
> matter what — that failure won't be the original bug.
>
> Here's what I'd like to do. Tell me what you saw, and I'll reopen your access
> so you can test properly on a fresh key without paying while we sort it out.
> If it turns out to be my bug, I'd rather find it because of you than find it
> next month because of someone else.
>
> Michael
> Founder, ZeroGEX

---

## Priority 3 — nathan@thewebfactory.tech

**Canceled** 2026-08-28 · reason: `too_expensive` — *"I like the Ninjatrader
indicator - nice job on that and the web app. But it costs a little more than I
want to pay. For me options data is a 'nice to have' rather than a critical part
of my strategy."*

### The read

This is the healthiest cancellation on the list. Nothing is broken; they like
the product and told you so. It's a **price-to-value** mismatch at their usage
level, and they were precise about it: *a little* more, and *nice to have*.

The obvious move — offer Basic — is the wrong one. The NinjaTrader indicator
they specifically praised needs a **Pro** API key; Basic would take away the one
thing they named. So the lever is the price of Pro, not the tier.

The clean lever is cadence, not a coupon: Pro is **$59/mo** monthly and
**$299/yr**, which is about **$24.92/mo**. For a "nice to have," that difference
is the entire objection. A discount is the fallback, not the opener.

### Should you reach out?

**Yes**, and lead with annual. If they're already on annual, fall back to the
25%-off win-back coupon (`make honor-winback-discount`).

### ⚠ Verify first

- **Which cadence were they on?** The draft below assumes monthly. If they were
  already annual, the price line is wrong and the email falls apart — rewrite it
  around the coupon instead.
- Confirm the live Pro rates from Stripe rather than trusting the defaults in
  `core/pricing.ts` before quoting a number.

### Draft

> **Subject:** re: ZeroGEX costing a bit more than you want
>
> Hi Nathan — thank you for the kind words about the NinjaTrader indicator on
> your way out. That one was a lot of work and almost nobody mentions it, so it
> landed.
>
> Your reason was the useful kind: not that it's bad, just that it costs a bit
> more than options data is worth to you, because it isn't central to how you
> trade. That's completely fair, and it's a pricing problem rather than a product
> one.
>
> So before you go: you were on monthly. Pro annual works out to about $25 a
> month instead of $59. For something that's a nice-to-have rather than a core
> input, that's a different question entirely — and it keeps your indicator
> working, which Basic wouldn't, since the indicator needs a Pro key.
>
> If annual isn't the shape you want, say so and I'll do something on the monthly
> price instead. I'd rather keep you at a number that feels right than lose you
> over a gap this small.
>
> And if the answer is just "not right now" — genuinely no hard feelings. The
> indicator stays free and open source either way.
>
> Michael
> Founder, ZeroGEX

---

## Priority 4 — gp8772@pm.me

**Canceled** 2026-08-30 · reason: *other* — *"Interesting concept, still can't
see how this would make me money."*

### The read

Not price, not a missing feature, not a bug — they never reached the moment
where the data changed a decision. "Interesting concept" is the tell: they
understood what it *is* and never saw what it's *for*.

A discount is the wrong instrument here, and would read as an answer to a
question they didn't ask. The only useful reply is a concrete one: one trade,
one level, one decision.

Two things shipped on 2026-08-26 that speak directly to this and postdate most
of a short trial — the **Trade Bias widget** (`aadbcab`), which carries an
explicit horizon, and the **"0DTE Intraday" quick-start preset** (`89e7e36`).

### Should you reach out?

**Yes, but ask rather than pitch.** You don't know what they trade, and the
answer changes the entire reply. One question is more likely to get a response
than three paragraphs of features — and the answer tells you whether this is a
positioning problem across the whole funnel.

### Draft

> **Subject:** fair criticism — what do you trade?
>
> Hi — you canceled with "interesting concept, still can't see how this would
> make me money," and I'd rather take that seriously than let it go.
>
> It's fair. ZeroGEX shows you where dealer hedging is likely to push or pin
> price. That's only worth anything if it changes a decision you were already
> making — and if it never did, then for your trading it didn't earn the money.
>
> So rather than list features at you: what do you actually trade? Index options,
> futures, shares, something else, and roughly what timeframe?
>
> The reason I ask is that the honest answer is different for each. For a 0DTE
> SPX trader, the useful bit is the gamma flip and the call/put walls telling you
> whether to expect a grind or a break. For someone swinging QQQ over days, it's
> nearly the opposite read. If I know which one you are, I can either show you the
> specific thing — or tell you straight that it isn't built for how you trade,
> which is a perfectly good answer and saves you money.
>
> Either way I'll take the reply as useful. "I couldn't see the point" is the
> most valuable thing anyone's told me this month.
>
> Michael
> Founder, ZeroGEX

---

## Priority 5 — letskracktrading@gmail.com

**Canceled** 2026-08-10 · reason: *other* — *"If I find it useful and accurate,
I will sign up for paid service"*
**Lapsed** 2026-08-17.

### The read — this answers your "so they cancelled? I'm so confused here"

They did, but not in the way the word usually means. Read the clock on signup
day:

| Time (2026-08-10) | Event |
|---|---|
| 02:54:11 | login |
| 02:54:15 | checkout started — Pro monthly, 7-day trial |
| 02:54:41 | subscription created, status `trialing` |
| 02:56:48 | disclaimer acknowledged |
| 02:57:04 | Pro welcome modal acknowledged |
| **02:58:38** | **cancellation requested** |

**Four minutes** after the trial started, and *before* they had used the product
at all. That is not a rejection — it is someone switching off auto-renew so the
card never gets charged, which is exactly what their sentence says: *if* I find
it useful and accurate, I'll sign up. They then kept the trial for its full
seven days and it ended on the 17th.

So nothing is broken here and there's no complaint to answer. The system worked;
the label "canceled" is just doing a poor job of describing it.

Worth noting for the alerting change: **this is the shape of cancel that will
generate the most noise** in your new alerts — a trial opt-out that isn't churn.
The alert shows tenure, so a `same day` cancel is easy to recognize on sight.

### Should you reach out?

**Lowest priority of the five, and it's optional.** Engagement was thin: one
further login on the 10th, a logout on the 15th, and no sign they explored much.
They asked to be convinced and then didn't really look. It's a cheap, honest
note, but expect little.

### Draft

> **Subject:** did ZeroGEX turn out useful?
>
> Hi — you tried ZeroGEX back in August. When you started the trial you turned
> off the renewal straight away with a note saying you'd sign up if you found it
> useful and accurate, which I thought was a completely reasonable way to go
> about it.
>
> So I'm just following up on your own terms: did it? And if not, was it that the
> read didn't hold up, or that you never really got a chance to look?
>
> If it's the second one, say the word and I'll open your access back up for a
> stretch so you can judge it properly. A few things have landed since you were
> here — ES and NQ futures levels, a trade-bias read with an explicit time
> horizon, and a 0DTE intraday preset.
>
> And if you looked and it wasn't for you, telling me that is just as useful. I
> won't chase it further either way.
>
> Michael
> Founder, ZeroGEX

---

## Two things this surfaced

**1. The FAQ is out of date, and it is telling prospects futures aren't
supported.** `app/help/faqs/Client.tsx` still answers "What symbols are
currently supported?" with only SPY / SPX / QQQ / NDX, and the futures answer
still says translating levels into futures prices is "on the roadmap." Both
shipped in August. A futures trader who reads that page today concludes ZeroGEX
does not do what they want — which may be part of why the reason above got
written at all.

**2. Nobody was reading the cancellation reasons.** That is fixed by
`make cancellation-alerts` in this same change. To catch up on the backlog these
five came from:

```bash
# see what you missed, send nothing
make cancellation-alerts DRY_RUN=1 SINCE=2026-08-01

# then either mail them to yourself...
make cancellation-alerts SINCE=2026-08-01

# ...or, since you have now read them here, silence the backlog and
# let the timer take over from a clean slate
make cancellation-alerts SINCE=2026-01-01 MARK_ONLY=1
```
