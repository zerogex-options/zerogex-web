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

---

## Addendum — 2026-09-06: two end-of-trial opt-outs from the alert stream

Two more came in through `make cancellation-alerts` on 2026-09-06. On paper they
are twins: both signed up on Sunday 2026-08-30, both took a **Pro** trial, both
canceled through the in-app modal, and both ended on Sunday 2026-09-06 as
`public` without a single paid invoice. So neither is a lost paying customer —
both are **trial non-conversions**, and the alert's "Subscription ended" badge
is the lapse, not the click. `make diagnose-user` on each (run 2026-09-06) says
the clicks were two days apart and the two people could hardly be more
different.

### What they share, and what it rules out

- **There is nothing left to "save."** The subscription is gone. Both
  `make honor-winback-discount` and the one-click save link refuse a sub that
  isn't `trialing` or `active`, so anything you offer here is fulfilled by hand.
- **Checkout will not give either of them a second trial.** `diagnose-user`
  prints `hasPriorPaidSubscription: yes` for both (the trial welcome stamped
  `paid_welcome_email_sent_at`, and the lapse set `subscription_lapsed=1`), and
  `app/api/billing/checkout/route.ts` treats that as "has held a paid sub" — a
  returning account gets **no trial at all** and is charged on the spot. Do not
  write "start another trial." Decide the mechanism first (see each
  Verify-first).
- **They have both already said no to 25% off, twice.** Both cancels are
  `billing_cancel_flow_submitted` — the in-app modal, which leads with the
  25%-off save before it asks for a reason — and both then received the ack
  email carrying the same one-click offer (`cancellation_ack_email_sent`).
  Neither took it. Re-offering 25% in the reply repeats something they have
  already declined.
- **Both generated a Pro API key.** The `api_key_auto_revoked` row at lapse
  proves one existed on each account. For one of them it was seventeen seconds
  after the welcome, straight out of the onboarding modal; for the other the
  generation row is off the end of the 20-event window. Neither fact says the
  key was ever *used* — and whether it was changes the second draft (see its
  Verify-first).

---

## Priority 1 — rjpa1974@gmail.com

**Signed up** Sun 2026-08-30 08:40 EDT · Pro trial · **canceled in-app** Fri
2026-09-04 23:06 EDT · **lapsed** Sun 2026-09-06 08:50 EDT · reason: *other* —
*"I need to learn more. Thanks."*
Tier is now `public`; the only invoice is $0.00.

### The read

This is the warmest of the two by a distance, and the audit trail makes it
warmer. The last twenty rows only reach back to Thursday and still show **five
sign-ins in two days, plus the tail of a sixth**, from a home connection and a
phone:

| EDT | What |
|---|---|
| Thu 09-03 11:29 | sign-out — the end of a session that began before the window |
| Thu 09-03 13:11 – 13:17 | phone (Verizon), a six-minute look |
| Thu 09-03 23:57 – Fri 00:27 | late-night session at home |
| Fri 09-04 06:16 | 48h trial reminder sent (the engaged variant) |
| Fri 09-04 09:11 – 11:22 | **two hours during the session** |
| Fri 09-04 21:37 – 21:47 | ten minutes in the evening |
| Fri 09-04 23:04 → 23:06 | sign in, cancel via the modal, sign out — 82 seconds, a trip made to cancel |

Whatever came before Thursday is off the end of the window, but this is not
someone who never got round to it. They were in the app across the week,
watched a live session on the last trading day, read the reminder, and came
back that night specifically to switch the charge off — politely, with a note.

The note itself: the survey put *"Too complex / hard to use"* right in front of
them and they chose *Other*, then described themselves rather than the product.
*I* need to learn more. With this much time in the tool, "more" almost
certainly means the concepts and what to do with them, not the UI — they had
the UI for a week. It is the `components/ProWelcomeModal.tsx` failure mode in
the flesh: enough hours in front of the levels to see that they do not behave
like triggers, not enough grounding to know that is the point.

Two things follow. A discount is the wrong instrument, for the same reason it
was wrong for gp8772: price is not what they said. And "I'll reopen your
access" is a weaker offer than it looked before the audit trail — they had a
full week of Pro and used it. What they are missing is a way to keep learning
that does not cost $59 a month while they do, and that exists: the free delayed
levels pages and the education hub for the concepts, and — if they want the
live app while they learn — **Basic**, which carries every level and metric
they would be learning from and leaves out the advanced signals, composite,
backtesting and API they are not ready for. That is the right tier for a
learner. It is not a discount; it is the honest recommendation.

### Should you reach out?

**Yes, and first.** They opened the conversation and put real hours in; a reply
is likely. Send it early in the week — Tuesday is the first session after Labor
Day, the first day the free levels pages move again.

### ⚠ Verify first

- **Which cadence the Pro trial was on, and whether a promo coupon was
  attached.** The `billing_checkout_started` row is outside the 20-event
  window. Stripe still shows the canceled sub `sub_1UA8Bh4AOiqteMYYe8bzCNtb`
  with its price and discounts. If the public promo was live, Basic is $19 for
  six months, not $39, and the draft should say so.
- Confirm the live Basic rate from Stripe before quoting a number.
- Whether the API key was used (`make api-keys-list
  USER=user_a1526c1e57b25fa883326cf3` from the zerogex-oa checkout; leave
  `ACTIVE` off so the revoked key shows, and read its `last_used_at`). If it
  was, they were wiring up NinjaTrader or Sierra, and the Basic paragraph needs
  a caveat: Basic revokes the key.
- The draft offers the app "back on for a stretch" only *if they say it would
  help*, and gives no day count — there is no `make` target for this. If they
  take it, the clean path is a subscription created from the Stripe Dashboard
  on `cus_VAT0oPmht4Cr9z` with a `trial_end` a couple of weeks out; the webhook
  handles `customer.subscription.created` and grants the tier. The other path
  is `make reset-user-for-testing EMAIL=... KEEP_CUSTOMER=1 APPLY=1`, which
  clears the trial latches so /pricing hands out a fresh 7-day trial — it is
  labeled a testing tool and wipes the local subscription history, so that is
  your call.

### Draft

> **Subject:** "I need to learn more" — which part?
>
> Hi — your ZeroGEX trial ended over the weekend, and the note you left was "I
> need to learn more. Thanks." Most people leave nothing, so thank you.
>
> You put real time in — you were in and out of the app through the back half
> of last week, including a couple of hours during Friday's session — so this
> wasn't a case of not getting round to it. So I'd like to ask: which part didn't click? The levels
> themselves (the flip, the walls), the signals built on top of them, or how to
> turn either into a decision? One word back is enough; each answer points me at
> something different to send you.
>
> Meanwhile, you don't need a subscription to keep learning. The SPX gamma
> levels page is free with no account, delayed about fifteen minutes, with SPY,
> QQQ and NDX alongside. Keep it open next to a chart for a couple of weeks and
> watch how price behaves around the flip and the walls:
> https://zerogex.io/spx-gamma-levels — and the write-up of what those levels
> mean is here: https://zerogex.io/education/gamma-exposure-explained
>
> The one thing I'd read first, because it's the most common way a first week
> goes wrong: the levels are context, not triggers. Dealer positioning is
> modeled, not observed, so the flip and the walls tell you where price is more
> likely to grind or to break, not when to enter. What's derived, what's assumed
> and where the model is weakest is all at https://zerogex.io/methodology. Five
> minutes.
>
> When you want back in, you probably don't need Pro yet. Basic is $39 a month
> and carries every level and metric you'd be learning from; what it leaves out
> is the advanced signals, the composite score, backtesting and the API. And if
> having the app open while you work through this would help, say so and I'll
> switch it back on for a stretch, no card and no charge.
>
> Michael
> Founder, ZeroGEX

---

## Priority 2 — count.slinks-1h@icloud.com

**Signed up** Sun 2026-08-30 16:47 BST · Pro **monthly** trial · **canceled
in-app** Wed 2026-09-02 15:07 BST (10:07 ET) · **lapsed** Sun 2026-09-06 16:51
BST · reason: `too_expensive` — typed nothing.
Tier is now `public`; the only invoice is $0.00.

### The read

The twenty rows here reach all the way back to `register`, so this is the whole
history, and it is short:

| BST | What |
|---|---|
| Sun 08-30 16:47 – 16:50 | register, verify, Pro monthly checkout, welcome — three minutes, from an address that never appears again |
| Sun 08-30 16:50 | disclaimer, then **an API key seventeen seconds after the welcome** |
| Sun 08-30 23:30 | Pro welcome modal acknowledged, from a UK home connection |
| Tue 09-01 17:49 | mid-trial value nudge sent |
| Wed 09-02 10:36 | sign in from the same home connection, before the US open |
| Wed 09-02 15:07 | cancel via the modal from a different network, 37 minutes into the US session — then nothing, ever |

Three things stand out. They are in the UK: every later address is a UK
residential IPv6 range and the clock fits — a Sunday-afternoon signup, a
late-evening modal, a cancel just after the US open. The visible engagement is
one return visit, on day three, and it ended in the cancel; sessions don't emit
events, so Monday and Tuesday page views would be invisible, but nothing says
they were there, and `last_seen_at` is the cancel itself. And the API key:
generated straight out of the onboarding flow, so it may be nothing more than
clicking the button the modal pointed at — or it may mean they wired up
NinjaTrader or Sierra, and *that* is what they were pricing. The two readings
want different replies (see Verify-first).

Then the reason. "Too expensive" from someone who never paid, who declined 25%
off in the modal and ignored it again in the ack email, and who had four more
free days and did not use one of them, is not a "$59 versus $44" problem. It is
*not worth it to me at any price I was shown*, decided during a live session on
day three. The useful part is missing: expensive **against what**? Account
size, how many days a month they trade, another tool doing it for less — or,
for a UK trader, a US-index intraday tool whose live hours run 14:30–21:00
local. Each points somewhere different and only they can say which. So the
reply asks that once, in two lines, and does not lead with a bigger discount:
the 25% already did not move them and there is no live sub to attach one to.
Annual is not the lever either — someone who would not pay $59 a month is not
putting $299 down up front.

What does honestly exist below the price they saw:

- **Basic**, $39/mo at rack. Keeps the dashboard, Live Bulletin, every metrics
  page and the basic signals; drops the advanced signals, composite,
  backtesting and the API. The right lever if the key was never used; the
  wrong one if the API was the point — Nathan's case exactly.
- **The $0 layer**: the free delayed levels pages plus the free TradingView and
  thinkorswim scripts that draw the flip, walls and max pain on their own chart
  (manual entry from the free page — Pine can't make HTTP calls). For someone
  for whom options data is a nice-to-have, that is the honest answer, and it is
  the same close the August churn newsletter uses. It keeps them in orbit.

The address is the last fact. `count.slinks-1h@icloud.com` looks like an
iCloud+ Hide My Email alias (the two-random-words-plus-suffix pattern): they
arrived privacy-first and never expected a conversation. That sets
expectations for the reply; it is not a reason to skip one.

### Should you reach out?

**Yes, but keep it short and expect little.** Second priority. A few lines and
one question is the whole email; anything longer is a pitch to someone who
already said the price was the problem and has not been back in four days.

### ⚠ Verify first

- **Was the API key used?** `make api-keys-list USER=user_8f236436779fd69309850d0f`
  from the zerogex-oa checkout, `ACTIVE` off so the revoked key (prefix
  `wZIfqBTK`) shows, and read `last_used_at`. That decides the draft: never
  used, send it as written — Basic is the lever. Used, cut the Basic paragraph
  (Basic revokes the key, so it takes away the one thing they set up) and the
  honest offer is the price of Pro, which is Nathan's draft, not this one.
- Whether the promo coupon was on the sub (`sub_1UAB0B4AOiqteMYYPuIyIsBs` in
  Stripe). If the public promo was live, the "$59" they were pricing was really
  $29 for six months, and Basic's line becomes "$19 for six months" — say that.
- Confirm the live Basic rate from Stripe before quoting $39.
- Check in Resend that the ack email of 2026-09-02 actually delivered to the
  alias. If it bounced, they have never seen the 25% offer and the reply could
  carry it after all.
- Alias mail forwards while the alias is active. If they deactivated it after
  canceling, the reply will not arrive and you may not see a bounce — so
  silence here is not a "no."

### Draft

> **Subject:** too expensive — compared to what?
>
> Hi — you canceled your ZeroGEX trial on Wednesday with "too expensive" and no
> note, and the trial ran out over the weekend. Fair enough, and I'm not going
> to argue with it.
>
> I do want to ask one thing, because "too expensive" hides the useful part:
> expensive against what? The size of the account you trade, how many days a
> month you're actually in the market, or another tool that does the job for
> less? Any of those is a real answer, and each one points me somewhere
> different.
>
> Two things exist below the price you saw, and three days may not have made
> them obvious. Basic is $39 a month: the dashboard, the Live Bulletin, every
> metrics page and the basic signals. What it drops is the advanced signals,
> the composite score, backtesting and the API. And under that there's a free
> layer that doesn't need an account: the SPX, SPY, QQQ and NDX levels pages,
> delayed fifteen minutes, plus free TradingView and thinkorswim scripts that
> draw the flip, the walls and max pain on your own chart (you type the levels
> in from the free page). If options data is a nice-to-have for how you trade
> rather than the core of it, that free layer might be the honest fit, and I'd
> rather you use it than pay for something you don't need.
>
> If there was a number or a shape that would have made it a yes, tell me. I
> read every reply myself.
>
> Michael
> Founder, ZeroGEX

---

## Three things these two surfaced

**1. "I'll open your access back up" has no tooling behind it.** Three drafts
in this document promise some form of it — Marcos, letskracktrading, and now
rjpa1974 (conditionally) — and every one has to be fulfilled by hand in the
Stripe Dashboard, because the once-per-account trial gate in checkout is doing
its job and `make extend-trial` only touches a sub that is still `trialing`.
The nearest existing target is `make reset-user-for-testing`, which is named
for what it is. If reopening a lapsed trialer for a stretch is going to be a
standing reply (and "need to learn more" and "didn't get to use it" are two of
the reasons that most often ask for it), it deserves a real target that creates
the trialing sub on the existing customer with an explicit `trial_end`, re-arms
the 48h reminder like `extend-trial` does, and audits the grant. Until then,
promise the outcome and not the number.

**2. `diagnose-user` stops at twenty rows, and for an engaged member that is
the wrong twenty.** rjpa1974's tail begins Thursday. The checkout row (cadence,
promo) and the API-key generation — the two facts that most change the reply —
are both off the end, and had to be sent to Stripe and `api-keys-list` instead.
The `LIMIT 20` is a literal in `scripts/diagnose-user.mts`; a `LIMIT=<n>` knob
on the target is a small change and would have answered both questions in the
same run.

**3. Read the pending alert, not the lapsed one.** Both "Subscription ended"
alerts landed on Sunday only because both trials *started* on Sunday — the
lapse timestamp is signup day plus seven, so a cluster of lapsed alerts on one
day reflects a signup cluster a week earlier, not a decision pattern. The
pending alerts went out while access was still live — Wednesday night and
Friday night — with days left to act in. That is the one to reply from; the
lapsed alert is the receipt.
