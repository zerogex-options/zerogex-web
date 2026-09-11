# September 11, 2026 — 25th Anniversary Folds of Honor Drive

The operator runbook for the four-day anniversary drive: what the offer is,
how to turn it on, what to post, what to run as paid, and how to pay Folds of
Honor afterwards.

> **Sibling docs:** the standing 3% program lives in
> [`x-twitter-foh-playbook.md`](./x-twitter-foh-playbook.md) and
> [`launch-tweets-folds-of-honor.md`](./launch-tweets-folds-of-honor.md). The
> evergreen paid plan is [`twitter-ad-campaign.md`](./twitter-ad-campaign.md).
> This doc is the one-time drive and supersedes those for its four days only.

---

## At a glance

| | |
|---|---|
| **Window** | Fri **Sept 11, 00:00 ET** → Mon **Sept 14, 23:59 ET** |
| **Offer** | **25% off for 12 months**, every tier and cadence |
| **Pledge** | **100%** of the first month we collect goes to Folds of Honor |
| **Annual equivalent** | **One twelfth** of the annual payment |
| **Attribution code** | `HONOR25` → `zerogex.io/register?ref=HONOR25` |
| **Framing** | Fundraiser first. The discount is the mechanism, never the headline. |
| **Source of truth** | `frontend/core/patriotPledge.ts` |
| **Tally** | `make patriot-pledge-tally` (run **Sept 22 or later**) |

### The numbers, per subscriber

| Plan | List | They pay | They save | **FOH receives** |
|---|---|---|---|---|
| Basic monthly | $39.00 | $29.25/mo | $9.75/mo | **$29.25** |
| Pro monthly | $59.00 | $44.25/mo | $14.75/mo | **$44.25** |
| Basic annual | $199.00 | $149.25 | $49.75 | **$12.44** |
| Pro annual | $299.00 | $224.25 | $74.75 | **$18.69** |

The discount rides 12 months; the donation is the first month only. From month
two these subscriptions fall back to the standing 3% pledge — the 100% replaces
it for that first invoice, it never stacks on top of it.

### What this costs you

Month one nets **negative**. You collect $44.25 from a Pro monthly subscriber,
send all $44.25 to Folds of Honor, and still owe Stripe roughly $1.58 in
processing. That is deliberate and it is what `/giving` promises — the charity
receives the full gross receipt and the fee comes out of our side. Budget the
card fees plus the ad spend as the real cost of the drive.

The payback is months 2–12 at $44.25 and month 13 onward at $59.

---

## ⚠ Three things to settle before you advertise anything

**1. Confirm the pledge with your Folds of Honor contact.** You already have a
partner relationship (the tracked donation page at
`foldsofhonorpartners.donorsupport.co/page/ZeroGEX`), but that was set up for the
standing 3%. A four-day "100% of first-month revenue" drive that uses their name
in paid advertising is a different thing. Get it acknowledged in writing, and
confirm you are cleared to use the name and the Proud Supporter badge in **paid**
placements specifically — badge permissions often cover organic only.

**2. This is a commercial co-venture in the eyes of about half the states.**
Advertising that a portion of a purchase price goes to a named charity is a
regulated "charitable sales promotion." Requirements vary, but the common ones
are a written agreement with the charity *before* the advertising runs, and a
clear disclosure of the exact amount per purchase and the campaign's duration.
New York and California are the strictest; several states also require
registration or bonding. The `/giving` banner this repo ships carries the
disclosure language (amount, duration, what happens after month one). Whether you
need to register is a question for a lawyer, not for this doc — but do ask it
before spending, because the exposure scales with the ad budget.

**3. X may reject ads that reference September 11.** X's policy restricts ads
that trade on sensitive events. Ad copy that leads with the charity and "Patriot
Day" clears far more reliably than copy that leads with the anniversary. The copy
library below is written that way, and §5 has fallback variants with no date
reference at all.

Because this is going up the same day, **submit A1 and A4 together in the first
batch** rather than waiting to see whether A1 clears. Review can take a few
hours; if A1 is rejected you want A4 already in the queue, not starting its
review at noon. If both are rejected, go straight to A5 — it carries no date
reference at all — and do not appeal. An appeal takes longer than the drive.

---

## Launch day running order

The drive is live the moment `PROMO_END_AT` ships, so sequence matters: nothing
should advertise a rate that checkout is not yet honoring.

| # | Do | Time | Blocking? |
|---|---|---|---|
| 1 | §2 — confirm the pledge with your FOH contact | 5 min | **Yes** — before any public claim |
| 2 | §1 — create the two Stripe coupons | 10 min | Yes |
| 3 | §2 — set env, back up the old promo values | 5 min | Yes |
| 4 | §3 — `make rebuild`, walk the verify checklist | 10 min | **Yes** — before posting or advertising |
| 5 | §4 — post the lead + two replies, pin it | 5 min | No |
| 6 | §5 — submit ads (A1 **and** A4 together) | 20 min | No |
| 7 | §5 — confirm ads approved and delivering | check back | No |

Steps 1–4 are ~30 minutes and must happen in order. If you are short on time
today, **do 1–5 and skip the ads until tomorrow** — the organic post costs
nothing and the drive still runs three more days. An ad pointing at a checkout
that charges list price is the one genuinely bad outcome.

---

## 1. Stripe setup (~10 min, do this first)

You need **two** coupons, not eight. A percent-off coupon is tier-agnostic, so
one coupon serves both Basic and Pro; only the cadence differs, because the
monthly one has to repeat and the annual one must not.

In the Stripe Dashboard → **Products → Coupons → New**:

**Coupon A — monthly**
```
Name:                 9/11 Anniversary 25% (monthly)
Type:                 Percentage discount
Percent off:          25
Duration:             Repeating
Duration in months:   12
Redemption limits:    none (leave uncapped — the window is the limit)
```

**Coupon B — annual**
```
Name:                 9/11 Anniversary 25% (annual)
Type:                 Percentage discount
Percent off:          25
Duration:             Once
Redemption limits:    none
```

Copy both coupon IDs (`promo_...`). Do **not** create Stripe *promotion codes* —
this app attaches coupons server-side at checkout; a customer-typed code is a
second, unnecessary path.

---

## 2. Environment (~5 min)

**Back up the current values first.** `PROMO_END_AT` and the four
`STRIPE_COUPON_PROMO_*` vars may already hold a live promo; you are going to
overwrite them and will want them back on Tuesday.

```bash
cd frontend
grep -E '^(PROMO_END_AT|STRIPE_COUPON_PROMO_)' .env.local > /tmp/promo-backup-pre-911.txt
cat /tmp/promo-backup-pre-911.txt
```

Then set, in `frontend/.env.local`:

```bash
# Site-wide window — auto-applies to everyone, no code needed.
# 2026-09-15T03:59:59Z is 23:59:59 ET on Monday Sept 14 (September is EDT, UTC-4).
# The drive runs Fri 11th through Mon 14th: the weekend plus two trading days.
PROMO_END_AT=2026-09-15T03:59:59Z

# Coupon A (repeating, 12 months) on both monthly SKUs.
STRIPE_COUPON_PROMO_BASIC_MONTHLY=promo_XXXXXXXXA
STRIPE_COUPON_PROMO_PRO_MONTHLY=promo_XXXXXXXXA

# Coupon B (once) on both annual SKUs.
STRIPE_COUPON_PROMO_BASIC_ANNUAL=promo_XXXXXXXXB
STRIPE_COUPON_PROMO_PRO_ANNUAL=promo_XXXXXXXXB

# Attribution path for paid traffic: ?ref=HONOR25 resolves to the same rate,
# but stamps referred_by_code so you can tell ad-driven signups from organic.
STRIPE_CAMPAIGN_HONOR25_MONTHLY=promo_XXXXXXXXA
STRIPE_CAMPAIGN_HONOR25_ANNUAL=promo_XXXXXXXXB
```

**Why both paths.** `PROMO_END_AT` makes the rate automatic for every visitor —
that is the promotion. `HONOR25` exists only so paid clicks are attributable;
`resolveDiscount` in `app/api/billing/checkout/route.ts` checks the campaign code
*before* the site-wide promo, and both resolve to the same coupon, so nobody gets
a different price depending on which link they clicked.

---

## 3. Deploy and verify (~10 min)

```bash
make rebuild
```

Then walk the list. Do not skip this — a promo that silently fails to attach is
worse than no promo, because the ads still spend.

- [ ] `/pricing` shows the limited-time banner and the deadline reads
      **September 14, 2026**
- [ ] `/giving` shows the anniversary banner above the hero
- [ ] `/giving` in a non-English locale still renders the banner (it is
      translated into all five)
- [ ] Start a real checkout on **Pro monthly** → Stripe shows **$44.25**
- [ ] Start a real checkout on **Pro annual** → Stripe shows **$224.25**
- [ ] Same two through `?ref=HONOR25` → identical prices
- [ ] Cancel both test subscriptions in Stripe afterwards

If the banner is missing on `/giving`, the page is cached: it revalidates every
five minutes (`export const revalidate = 300`), so wait or redeploy.

---

## 4. Organic posts

Post the lead **as early on Sept 11 as you can**. The ideal slot is 08:00 ET —
ahead of the open and ahead of the commemorative flood — but this is a four-day
drive, not a one-hour one: if the morning is gone, post it now rather than
holding for a "better" slot tomorrow. The second-best window on launch day is
~11:00 ET, after the opening-range noise settles.

The link goes in the **first reply**, not the lead post; X down-ranks outbound
links in the primary tweet.

### Lead post (235 chars)

```
Twenty-five years.

Today through Monday, 100% of the first month from every new ZeroGEX
subscription goes to @FoldsOfHonor — scholarships for the families of
fallen and disabled service members.

Not 3%, which is our usual. All of it.
```

### First reply — the mechanics (252 chars, with the link)

```
How it works:

• 100% of month one, gross — we eat the processing fee
• Annual subscribers fund the equivalent month
• 25% off for 12 months so more people can take part
• Ends Monday 11:59pm ET
• Receipt published, as always

https://zerogex.io/giving
```

### Second reply — the ask

```
If you've been sitting on the fence about ZeroGEX, this is the weekend.

Your first month doesn't fund us. It funds a scholarship.
```

### Weekend reminder (Sat Sept 12 or Sun Sept 13, ~10:00 ET) — 224 chars + `[N]`

```
Still running through Monday night.

Every dollar of a new subscriber's first month goes to @FoldsOfHonor.
Yesterday that was [N] scholarship dollars from people who were going
to subscribe anyway.

https://zerogex.io/giving
```

### Final-day close (Mon Sept 14, ~18:00 ET)

```
Last few hours.

100% of month one to @FoldsOfHonor, 25% off for a year, ends at midnight ET.

https://zerogex.io/giving
```

### Result post (Tue Sept 15) — 240 chars + placeholders. Post it even if the number is small

```
That's a wrap on the 25th-anniversary drive.

[N] people subscribed during the drive. Every dollar of their first month —
$[AMOUNT] — goes to @FoldsOfHonor.

Receipt will be published at https://zerogex.io/giving when it clears.

Thank you.
```

> Every draft above is under 280 characters as written. The two that carry
> `[N]` / `$[AMOUNT]` placeholders have ~40 characters of headroom — plenty for a
> count and a dollar figure, but re-check if you add anything else to them.
>
> The result-post number is **provisional**: trials started over the weekend do not
> convert until ~7 days later. Say "will be" rather than "has been" until
> `make patriot-pledge-tally` reports zero pending rows. Post the final,
> settled figure with the receipt (§7).

**Attach the Proud Supporter badge to every one of these** —
`https://zerogex.io/folds-of-honor-proud-supporter.png`. Confirm per §2 that you
are cleared to use it, and **pin the lead post** for the four days.

---

## 5. The X ad campaign

### Reality check on a four-day flight

X's optimizer needs roughly 50 conversions to leave the learning phase. A
four-day campaign will not get there on cold traffic, so **do not build a cold
prospecting layer for this**. Point the budget at audiences that already exist
from the evergreen campaign — site visitors, video viewers, account engagers —
where intent is already established and a four-day window is enough.

If those retargeting pools are under ~500 matched users, **hold them entirely**
and run only the keyword ad group. Under that floor X does not fail closed, it
silently broadens to a ~90M "audience" wearing a retargeting label, and your
anniversary budget funds untargeted reach. This is covered at length in
[`twitter-ad-campaign.md` §3](./twitter-ad-campaign.md).

### Structure — two ad groups, one campaign

| | AG-1 · Warm | AG-2 · Keyword |
|---|---|---|
| **Objective** | Website Conversions (`TrialStart`) | Website Conversions (`TrialStart`) |
| **Audience** | Site visitors 90d + video viewers 25%+ + account engagers | The `twitter-ad-campaign.md` keyword set + a `patriot day`, `folds of honor`, `veterans charity` overlay |
| **Budget split** | 65% | 35% |
| **Destination** | `zerogex.io/giving?ref=HONOR25` | `zerogex.io/giving?ref=HONOR25` |
| **Exclusions** | Converters/subscribers audience | Converters/subscribers audience |

**Send paid traffic to `/giving`, not `/pricing`.** The ad makes a claim about a
charity; the landing page has to substantiate it in the first screen or the click
is wasted. `/giving` opens with the anniversary banner, the mechanics, the
charity's credentials and a CTA straight to pricing. `/pricing` opens with a
price grid and buries the reason they clicked.

### Flight and budget

```
Start:  Fri Sept 11, 00:00 ET     End: Mon Sept 14, 23:59 ET
Pacing: Standard (not accelerated — accelerated will spend Friday morning)
Bid:    Autobid for the first 24h, then cap at 1.3x observed CPA if it runs hot
Budget: $75–125/day × 4 days = $300–500 total
```

That is above the evergreen $17–50/day band, deliberately: the offer only exists
for four days, and a drive that nobody sees donates nothing. Set a **total
campaign budget cap** as well as the daily, so a runaway Friday cannot eat the
whole thing.

### Creative direction

Reuse `convert-6-folds-of-honor.png` from `docs/ad-assets/` as the base — it is
already on-brand and already about this partnership. Overlay only if you have
time; an existing good asset beats a rushed new one.

If you do make something new, `docs/ad-assets/creative-generator.html` is the
tool. Keep it sober: the ZeroGEX dark palette, no flag-waving stock photography,
no explosions or skyline imagery — for both taste and ad-policy reasons. A single
line of white type on the dark brand ground over the Proud Supporter badge is the
right register.

### Ad copy library

All variants lead with the donation. None of them say "sale," none use a
countdown, and none reference the attacks themselves.

**A1 — the plain statement** *(recommended lead)*
```
100% of your first month goes to Folds of Honor.

Not a percentage. The whole first month — funding scholarships for the
families of fallen and disabled service members.

Through Monday. 25% off for a year on top.
```

**A2 — the trader frame**
```
You were going to pay for options data this month anyway.

Through Monday, every dollar of a new ZeroGEX subscriber's first month
goes to Folds of Honor instead of to us.

Dealer gamma, call/put walls, 0DTE flow. $SPX $SPY $QQQ
```

**A3 — the numbers frame**
```
Subscribe to ZeroGEX Pro before Monday night: $44.25 for your first month.

All $44.25 goes to Folds of Honor.

We cover the processing fee. You get 25% off for twelve months.
```

**A4 — Patriot Day, no anniversary reference** *(use if A1–A3 are rejected)*
```
Through Patriot Day weekend, 100% of every new subscriber's first month
goes to Folds of Honor — scholarships for military families.

Real-time dealer positioning on $SPX $SPY $QQQ. 25% off for a year.
```

**A5 — evergreen fallback, zero date reference** *(if X rejects everything above)*
```
Every dollar of your first month funds a scholarship.

ZeroGEX gives 100% of new subscribers' first month to Folds of Honor
through Monday. See what the market makers see — 25% off for 12 months.
```

**CTA on all variants:** `Start 7-Day Free Trial · Cancel anytime`

> **The trial is worth naming in the ad.** A seven-day trial means the card is
> not charged until ~Sept 18, which is fine for the pledge (qualification keys on
> the signup date, not the invoice date — see `core/patriotPledge.ts`) but *does*
> mean a viewer reading "100% of your first month" may expect an immediate
> donation. "Free trial, then 100% of your first month goes to Folds of Honor" is
> the honest phrasing where you have the characters for it.

### Tracking

- Pixel event: the existing `TrialStart`.
- Everything lands on `?ref=HONOR25`, so `referred_by_code` separates
  ad-driven signups from organic in the tally CSV.
- **North-star for this campaign is not CPA.** It is scholarship dollars raised
  per ad dollar spent. At $300 spend and 12 Pro monthly signups you raised $531
  for Folds of Honor and acquired 12 subscribers whose months 2–12 are worth
  ~$487 each. Judge it on both, not on Friday's cost-per-trial.

---

## 6. Tuesday Sept 15: close the window

```bash
cd frontend
# Restore whatever promo was running before, or clear it entirely:
#   PROMO_END_AT=<old value, or delete the line>
#   STRIPE_COUPON_PROMO_* = <old values from /tmp/promo-backup-pre-911.txt>
make rebuild
```

Leave `STRIPE_CAMPAIGN_HONOR25_*` set for a week or two. The window gate is
`PROMO_END_AT`; the campaign code has no expiry of its own, so a straggler who
clicks a cached ad midweek still gets honored rather than hitting a dead code.
Delete those two vars once traffic dries up.

Verify `/pricing` shows list prices again and `/giving` has dropped the banner.

---

## 7. Pay Folds of Honor

**Wait until September 22 at the earliest.** Every signup carries a 7-day trial,
so a Monday Sept 14 signup is not charged until ~Sept 21. Running the tally
before then reports a fraction of the real number.

```bash
make patriot-pledge-tally ALL=1 VERBOSE=1
```

It prints a per-invoice ledger and the total owed, flags any trial that has not
converted, and ends with the exact command to publish the result. Re-run until
the pending count is zero.

```bash
# Keep the ledger for your records / the receipt page:
make patriot-pledge-tally CSV=foh-911-ledger.csv JSON=foh-911-tally.json

# Then donate, and publish:
make quarterly-receipt AMOUNT=<the figure it printed> QUARTER="9/11 Drive 2026" DATE=<donation date>
```

Donate through the partner-tracked page so it is attributed to ZeroGEX:
`https://foldsofhonorpartners.donorsupport.co/page/ZeroGEX`

Then post the settled number and the receipt, per §4's result draft but in the
past tense — and keep the standing quarterly cadence unchanged. The Q3 donation
is separate and still owed on its normal schedule; this drive is on top of it.

---

## What is where

| Thing | Where |
|---|---|
| Window, prices, donation math | `frontend/core/patriotPledge.ts` |
| Tests for all of the above | `frontend/tests/patriotPledge.test.ts` (`npm run test:patriot-pledge`) |
| Tally script | `frontend/scripts/patriot-pledge-tally.mts` |
| Make target | `make patriot-pledge-tally` |
| Public banner | `frontend/app/giving/Client.tsx` (+ `Client.i18n.ts`, 5 locales) |
| Coupon precedence at checkout | `frontend/app/api/billing/checkout/route.ts` → `resolveDiscount` |
| Campaign-code resolution | `frontend/core/campaigns.ts` |
