# ZeroGEX — X / Twitter Ad Campaign: "Stop Trading Blind → Zero In"

A complete, buildable paid-acquisition plan for X (Twitter) Ads. Everything below is
ready to execute in X Ads Manager: campaign structure, audiences, budget ramp,
tracking spec, a ready-to-paste ad-copy library, and on-brand creative direction.
Companion visual mockups: [`twitter-ad-campaign-creative.html`](./twitter-ad-campaign-creative.html).

> Sibling doc: organic launch posts live in
> [`launch-tweets-folds-of-honor.md`](./launch-tweets-folds-of-honor.md). This doc is
> the **paid** plan; the two share a voice.

---

## At a glance

| | |
|---|---|
| **Goal** | Full-funnel → **7-day free-trial starts** |
| **Structure** | 3 stages: COLD (free-levels traffic) → WARM (retarget) → CONVERT (trial) |
| **Voice** | Hybrid — disciplined ZeroGEX body copy + strategic `$SPX $SPY $QQQ` cashtags |
| **Budget** | Starter, **~$17–50/day** ($500–1,500/mo); validate cost-per-trial, then scale |
| **Handle** | **@ZeroGEXOptions** |
| **Primary CTA** | Start 7-Day Free Trial · No charge until day 7 · Cancel anytime |
| **Cold destination** | `zerogex.io/spx-gamma-levels` (free daily levels, no signup) |
| **Convert destination** | `zerogex.io/pricing` |
| **North-star metric** | **Cost per `TrialStart`** (secondary: trial→paid rate, blended CAC) |

---

## 1. The big idea

**"Stop trading blind → Zero in."**

The through-line ties ZeroGEX's strongest existing hook — *"Stop trading SPY blind."* —
to the brand's **scope-reticle logo** (zeroing a scope = the **zero-gamma flip**, the
product's namesake). The payoff is the existing line *"See what the market makers see."*

Every ad plays one of two beats:

- **Blind** — the pain: you're guessing at support/resistance and getting trapped on the wrong side.
- **Zeroed-in** — ZeroGEX snaps the dealer-positioning map onto the chart: gamma flip, call/put walls, dealer flow, live.

This concept is ownable (nobody else owns the crosshair/zero motif), on-brand (uses the
logo and real hero copy), and it scales across static, video, and carousel.

---

## 2. Campaign architecture

A three-stage funnel that mirrors ZeroGEX's real product funnel: **free tool → live desk → trial.**
Build in this order in X Ads Manager.

| Stage | X objective | Audience temp. | Destination | Job |
|---|---|---|---|---|
| **① COLD** | Website Traffic (clicks) | Cold (keyword + follower look-alike) | `/spx-gamma-levels` | Cheap clicks + seed retargeting pool & pixel |
| **② WARM** | Website Traffic / Engagements | Retargeting (visitors, engagers, video viewers) | `/pricing` or `/dashboard` | Turn free-levels interest into trial intent |
| **③ CONVERT** | Website Conversions (event: `TrialStart`) | Hot (recent visitors, engagers) + a small broad/keyword set | `/pricing` | Start 7-day free trials |

**Why full-funnel, not a single conversion campaign:** X's conversion audiences are small
and expensive cold. Cheap free-levels clicks warm the audience, feed the pixel, and build
a retargeting pool you convert at a fraction of the cost. A small CONVERT ad group still
runs from **day 1** so trials start immediately while the pools fill.

---

## 3. Audiences & targeting

### ① COLD — two ad groups (compare head-to-head)

**AG-Keyword** (timeline + search keyword targeting):

```
0DTE, SPX options, SPY options, QQQ options, gamma exposure, GEX,
options flow, call wall, put wall, gamma flip, dealer positioning,
dealer gamma, max pain, unusual options activity, 0DTE SPX, gamma squeeze
```

**AG-Lookalike** (follower look-alikes — target the *followers* of adjacent/competitor
accounts). Starter list to **confirm targetable** before launch:

```
@spotgamma, @unusual_whales, @tastytrade, @OptionAlpha, @menthorpitt
+ large fintwit / options-education handles you rate
```

- **Geo:** United States (add CA / UK / AU only if you want reach; keep tight at starter budget).
- **Language:** English · **Devices:** all · **Gender:** all.
- **Placements:** Home timeline + Search results + Profiles.

### ② WARM — retargeting custom audiences (turn on once pools ≥ ~500)

> **The ~500 floor is a hard gate, not a low-budget setting.** Under ~500 matched
> users X does **not** fail closed — it **silently broadens** the ad group to its
> interest / look-alike / geo targeting (observed: a ~87–98M "audience," not the
> ~380 real visitors). So a sub-500 pool must be **held entirely** — running it at
> a trickle budget just funds a broad campaign wearing a retargeting label.

- Website visitors — **all**, plus a **free-levels** segment (visited `/spx-gamma-levels`).
- **Video viewers** — 25%+ of any campaign video.
- **Account engagers** — engaged with @ZeroGEXOptions.
- **Exclude:** the converter/subscriber audience (below) and `/dashboard` visitors.

### ③ CONVERT — hottest + a broad seed

- 7–14-day site visitors, free-levels visitors, 50%+ video viewers, recent engagers.
- Plus one small **broad + keyword** ad group from day 1 (direct-response seed).
- **Exclude converters** everywhere (see below).

### Exclusion audience (build first, apply everywhere)

Create a **"Converters / Subscribers"** custom audience from either a **customer-list
upload** (subscriber emails) or a pixel rule (fired `TrialStart` / visited `/dashboard`
while authed). Exclude it from **all** ad groups so you never pay to re-sell existing users.

---

## 4. Budget & bidding

Starter budget, **~$17–50/day**. Example below uses **$30/day**; scale within the band.

| Phase | COLD | WARM | CONVERT | Notes |
|---|---|---|---|---|
| **Weeks 1–2** (fill funnel) | ~70% (~$21) | off | ~30% (~$9) | Retargeting off until pools ≥ ~500 users |
| **Week 3+** (pools live) | ~45% | ~25% | ~30% | Rebalance toward whatever hits target cost-per-trial |

- **Bidding:** start **Autobid** on COLD; on CONVERT, start Autobid, then switch to
  **target cost** once you know your cost-per-trial.
- **Optimization goal:** *Link clicks* (COLD/WARM), *Conversions → `TrialStart`* (CONVERT).
- **Scale rule:** an ad group beating target cost-per-trial for **3–4 days** → raise its
  budget **+20–30%**. Pause any ad under **~0.8% CTR** after **~1,000 impressions**.
- **At the low end ($17/day):** run **COLD + the broad CONVERT seed only**; switch WARM on
  when pools fill. Don't split $17 across five ad groups — it starves learning.

---

## 5. Tracking & measurement

> **Prerequisite:** the site uses PostHog for product analytics, which is **not** the X
> pixel. Install the **X Pixel (website tag)** on `zerogex.io` and define the conversion
> events below before the CONVERT stage can optimize or retargeting can build.

**Conversion events to define:**

| Event | Fires when | Use |
|---|---|---|
| `ViewFreeLevels` | Loads `/spx-gamma-levels` | COLD success signal + retargeting seed |
| `ViewPricing` | Loads `/pricing` | Mid-funnel intent |
| `TrialStart` | Free trial started (post-register / checkout) | **Primary optimization event** |
| `Purchase` | First paid charge clears (day 7) | True ROI / CAC |

**UTMs — apply to every destination URL:**

```
?utm_source=twitter&utm_medium=paid&utm_campaign=zerogex_zeroin_2026&utm_content={ad_id}&utm_term={audience}
```

Example: `https://zerogex.io/spx-gamma-levels?utm_source=twitter&utm_medium=paid&utm_campaign=zerogex_zeroin_2026&utm_content=cold_blind_zeroed&utm_term=ag_keyword`

**KPIs:** CTR · CPC · cost-per-`ViewFreeLevels` · **cost-per-`TrialStart` (north star)** ·
trial→paid rate · blended CAC.
**Rough X planning ranges** (variable, *not* guarantees): CTR ~0.5–1.5%, CPC ~$0.30–$2.00.
Treat these as planning inputs; your real numbers land after ~1 week.

---

## 6. Ad-copy library

Hybrid voice: disciplined ZeroGEX body copy, `$SPX $SPY $QQQ` cashtags on a subset for
X discovery. All tweet copy is ≤280 chars; link-card headlines ≤70. Pair each with the
creative noted (see §7).

> **Paid vs. organic linking:** for **promoted ads**, attach the link via the website
> card / destination URL — X doesn't down-rank a card the way it down-ranks a raw link in
> post text. The "link in the first reply" trick from the organic playbook is only needed
> if you **promote an existing organic post**.

### ① COLD → `/spx-gamma-levels` (free levels)

**COLD-1 · Blind→Zeroed (hero) · cashtags**
> Stop trading SPY blind.
>
> Live call walls, put walls, and the gamma flip for $SPX $SPY $QQQ — refreshed every second.
>
> Today's levels, free. No signup.

Card headline: `Free daily gamma levels — SPX, SPY, QQQ` · CTA: **See more** · Creative: C1

**COLD-2 · The regime · cashtag**
> Same dip. Opposite outcome — depending on the gamma regime.
>
> Above the flip, dealers cushion the move. Below it, they accelerate it.
>
> See today's flip level for $SPX, free.

Card headline: `Where does dealer hedging flip today?` · Creative: C2

**COLD-3 · Walls · disciplined (no cashtag)**
> Call walls and put walls aren't psychological levels. They're where dealer gamma actually concentrates.
>
> ZeroGEX maps them live for SPY, SPX and QQQ.
>
> Today's walls, free.

Card headline: `Live call & put walls — no signup` · Creative: C3

**COLD-4 · Market makers · cashtags**
> The dealer book decides where price reacts intraday. Most traders never see it.
>
> ZeroGEX shows the gamma flip, walls and dealer positioning live for $SPX $SPY $QQQ.
>
> Free levels ↓

Card headline: `See what the market makers see` · Creative: C4

**COLD-5 · 0DTE**
> 0DTE lives and dies on dealer positioning.
>
> Gamma flip, call/put walls, max pain and flow — live for SPX, SPY and QQQ, refreshed every second.
>
> Start with today's free levels.

Card headline: `Free gamma levels, built for 0DTE` · Creative: C1 / C5

### ② WARM → `/pricing` (retargeting)

**WARM-1 · You've seen the free levels · cashtags**
> You've seen the free levels. The live desk updates every second.
>
> Call walls, put walls, gamma flip, dealer flow and 13 signals for $SPX $SPY $QQQ.
>
> See it live — 7-day free trial.

Card headline: `See it live — 7-day free trial` · Creative: C4 (dashboard)

**WARM-2 · Institutional**
> Gamma exposure data used to live on six-figure Bloomberg terminals.
>
> ZeroGEX puts the same dealer-positioning map on your screen — real-time, for SPY / SPX / QQQ.
>
> Start free for 7 days.

Card headline: `Institutional gamma, minus the terminal` · Creative: C4

**WARM-3 · Eight modules**
> Eight modules. One screen. One second.
>
> GEX by strike, gamma flip, call/put walls, max pain, options flow, Vanna/Charm, signals and playbooks — for SPY, SPX, QQQ.
>
> See the live desk.

Card headline: `Eight modules. One live options desk.` · Creative: C4 / carousel

**WARM-4 · Methodology / honesty (differentiator)**
> Most "gamma flip" numbers are a naive cumulative sum.
>
> ZeroGEX reprices every option across a spot grid — and shows NULL when the chain can't support a real level, instead of faking one.
>
> See the methodology.

Card headline: `A gamma flip you can actually trust` · Creative: C2

### ③ CONVERT → `/pricing` (trial)

**CONVERT-1 · Payoff + offer · cashtags**
> See what the market makers see.
>
> Real-time gamma flip, call/put walls and dealer positioning for $SPX $SPY $QQQ.
>
> 7-day free trial. No charge until day 7. Cancel anytime. Basic from $19/mo.

Card headline: `Start your 7-day free trial` · CTA: **Get started** · Creative: C6 / C4

**CONVERT-2 · Not guesswork**
> Trade with dealer positioning — not guesswork.
>
> 8 modules, 13 live signals, 1-second refresh. Built for 0DTE on SPY, SPX and QQQ.
>
> Start your 7-day free trial. No charge today.

Card headline: `Trade positioning, not guesswork` · Creative: C6

**CONVERT-3 · Risk reversal**
> 7 days free. No charge until day 7. Cancel anytime — no email, no support ticket.
>
> Real-time gamma flip, walls and dealer flow for SPY / SPX / QQQ.
>
> See the live desk.

Card headline: `7 days free. No charge until day 7.` · Creative: C6

**CONVERT-4 · Folds of Honor (trust + differentiator) · cashtags**
> 3% of every ZeroGEX subscription funds Folds of Honor scholarships for the families of fallen and disabled service members.
>
> Real-time gamma intelligence for $SPX $SPY $QQQ, and a cause behind it.
>
> 7-day free trial.

Card headline: `Institutional gamma. A cause behind it.` · Creative: C6 (trust variant)

**CONVERT-5 · Pro value**
> Basic from $19/mo. Pro from $29/mo — advanced signals, backtesting and API access.
>
> Real-time dealer positioning for SPY, SPX and QQQ, refreshed every second.
>
> 7-day free trial, no charge today.

Card headline: `Pro from $29/mo — 7-day free trial` · Creative: C6

### Video scripts (≤15s, 16:9 / 1:1)

**V1 · "Every second"**
- `0:00–0:02` Teal field; coral reticle spins up, crosshair locks. **Text: "You're trading SPY blind."**
- `0:02–0:06` Bare candlestick chart. **Text: "This is what most traders see."**
- `0:06–0:11` ZeroGEX overlay snaps on — teal gamma-flip line, red call wall, green put wall, Net GEX ticking. **Text: "This is the dealer book. Live."**
- `0:11–0:14` Numbers tick (1-second refresh). **Text: "Gamma flip · walls · dealer flow — SPX SPY QQQ."**
- `0:14–0:15` Logo + **"See what the market makers see. Free levels → zerogex.io"**

Post copy: `Stop trading SPY blind. The dealer positioning that moves $SPX $SPY $QQQ — live, every second. Free levels ↓`

**V2 · "The line that flips the market"**
Single glowing gamma-flip line. Price crosses it; the regime flips green→red. **Text: "Above it, dealers calm the move. Below it, they accelerate it."** → free-levels CTA. Best for the WARM/education audience.

---

## 7. Creative direction & specs

**Visual system (canonical dark brand look — matches `og-image.png`):**

| Token | Value |
|---|---|
| Background | `#00202E` (deep teal-navy) |
| Surface / card | `#001A26` / `#003F5C` |
| Signature accent (reticle, wordmark) | `#FF6361` coral |
| Sunset ramp (energy accent) | `#FF8531 → #FFD380` |
| Text primary / secondary | `#FFF1E6` cream / `#D1B8A6` tan |
| **+GEX green / −GEX red** | `#1BC47D` / `#FF4D5A` |
| Numerics / labels | **JetBrains Mono**, tabular; ALL-CAPS tracked micro-labels |
| Texture | faint blueprint grid; warm-gold hairline card borders |

**Formats & sizes:** single image **1:1 (1080×1080)** and **1.91:1 (1200×628)**; **16:9
video (1280×720, ≤15s)**; optional **2–6 card carousel** ("the 4 levels that matter" ·
"5 mistakes ZeroGEX helps you avoid").

**Six creative territories (`C1–C6`):**

| # | Territory | On-image headline | Stage |
|---|---|---|---|
| C1 | **Blind → Zeroed** (split chart: bare vs. overlaid) | STOP TRADING SPY BLIND. | COLD (hero) |
| C2 | **The flip line** (one glowing teal line) | ABOVE: DEALERS CALM IT. BELOW: THEY ACCELERATE IT. | COLD / WARM |
| C3 | **Walls** (call/put walls on the ladder) | RESISTANCE & SUPPORT THAT AREN'T GUESSES. | COLD |
| C4 | **See what the MMs see** (dashboard + reticle) | INSTITUTIONAL GAMMA. NO SIX-FIGURE TERMINAL. | WARM |
| C5 | **Every second** (video, ticking numerics) | THE DEALER BOOK MOVES ALL DAY. SO DO WE. | COLD/WARM (video) |
| C6 | **The offer** (clean risk-reversal card) | 7 DAYS FREE. NO CHARGE UNTIL DAY 7. | CONVERT |

**Reuse, don't rebuild** — assets already in-repo:
- `assets/branding/og-image.png` (1200×630) — the master lockup, drop-in ready.
- `assets/blog/` screenshots — `zerogex-dashboard-overview`, `zerogex-strike-dte-heatmap`,
  `zerogex-walls-chart`, `zerogex-gamma-flip-card`, `zerogex-net-gex-flip-card`,
  `zerogex-max-pain-card`, `zerogex-strike-profile-flip`, … (feed C3/C4/carousel).
- `frontend/app/spx-gamma-levels/gammaOgImage.tsx` — the programmatic 1200×630 card
  generator; the fastest way to spin on-brand ad-card variants at the right size.
- See rendered frames in [`twitter-ad-campaign-creative.html`](./twitter-ad-campaign-creative.html).

---

## 8. Launch checklist (X Ads Manager)

1. **Account & funding** ready; agree to X Ads terms.
2. **Install the X Pixel** on `zerogex.io`; create the 4 conversion events (§5); verify
   with the X Pixel Helper that `ViewFreeLevels`, `ViewPricing`, `TrialStart` fire.
3. **Build custom audiences:** all-visitors (30/14/7-day), free-levels visitors, video
   viewers (25/50%), @ZeroGEXOptions engagers, and the **Converters/Subscribers exclusion**.
4. **Campaign ① COLD** (Website Traffic): AG-Keyword + AG-Lookalike; geo US; Autobid;
   attach COLD-1…5 + V1; destination `/spx-gamma-levels` with UTMs.
5. **Campaign ③ CONVERT** (Website Conversions → `TrialStart`) from day 1: one broad +
   keyword ad group; attach CONVERT-1…5; destination `/pricing` with UTMs; exclude converters.
6. **Campaign ② WARM** (Website Traffic / Engagements) — build now, **launch when pools ≥ ~500**;
   attach WARM-1…4; exclude converters.
7. **QA:** every URL carries UTMs and resolves; pricing copy matches the live promo; handle
   is `@ZeroGEXOptions`; disclaimers present on landing pages.
8. **Go live** a weekday **08:00–10:00 ET**. Watch delivery for the first 24h.

---

## 9. Optimization & scale-up

- **Days 3–4:** pause ads <0.8% CTR after ~1k impressions; note cheapest cost-per-`ViewFreeLevels`.
- **Days 7–10:** once CONVERT has ~15–20 `TrialStart`s, compute cost-per-trial; kill losers,
  shift budget to winners, switch CONVERT bid to **target cost**.
- **WARM is pool-gated, not calendar-gated:** turn it on only once **All-Visitors
  ≥ ~500** (see the operations log below), *not* on a fixed week. Until then, hold
  WARM and run its budget on the proven broad / COLD line. Once it's live, rebalance
  toward ~45 / 25 / 30 (COLD/WARM/CONVERT).
- **Ongoing:** scale winners **+20–30%** every few days; **refresh creative every ~2–3 weeks**
  to fight fatigue (rotate territories C1↔C4, new hooks from the copy bank in §11).
- **Then widen:** graduate to the **Growth** budget by adding audiences (interest, extra
  look-alikes), a second video, and a multi-tier retargeting split.

### Operations log

**2026-07-20 — WARM held; retargeting pools under X's floor.** Tools → Audiences
(Jul-19 refresh) measured: **All-Visitors 381**, **Free-Levels 352**,
**Subscribers/Converters "Audience too small."** All three sit below X's ~500
targetable floor, so WARM couldn't actually retarget — X silently broadened it to
a ~87–98M interest/look-alike blob (the trap documented in §3 ②). Actions taken:

- **Hold WARM** (pause, don't delete) and redirect its ~$50/day into the proven
  broad / COLD line that drove the ~July-9 signup lift. Broad performs *now* **and**
  fills the retargeting pools **forward** — the X pixel has only been live since the
  campaigns started (~July 9), so no longer lookback can backfill the pools; only
  traffic + time grow them (expect ~500 in ~2–4 weeks at current traffic).
- **Weekly check → switch WARM on when All-Visitors ≥ ~500:** start it at
  **$12–15/day** with the Subscribers/Converters audience excluded.
- **Measure lift honestly:** judge on **aggregate signups vs. the pre-July-9
  baseline**, ideally with a **3–5 day full-paid holdout** for a clean incremental
  read. Do **not** trust X's per-campaign last-click for the broad line — it
  under-credits top-of-funnel.

---

## 10. Compliance & guardrails

- **No performance or return promises.** **No win-rate / accuracy %** — the engine's
  current pattern hit-rates are unvalidated priors (`../zerogex-oa/docs/playbook_catalog.md`),
  so they are **off-limits** in public copy.
- Keep claims to **substantiated features**: real-time gamma flip / walls / dealer
  positioning / flow / signals / 1-second refresh, coverage **SPY · SPX · QQQ only**.
- **Disclaimer** ("not investment advice; past performance is not indicative of future
  results") lives on the landing pages (`components/Footer.tsx`) — keep destinations pointed
  at pages that carry it. Follow **X's financial-services ads policy** (some regions require
  advertiser certification).
- **Pricing must match the live promo.** If the $19 / $29 promo has ended at launch, swap to
  rack ($39 / $59) or the founding rate — don't advertise an expired price.
- **No internal metrics** (signup / subscriber counts) in public copy.
- **Folds of Honor:** state the pledge exactly as on `/giving` (the source of truth), and
  **verify the `@FoldsOfHonor` handle** before tagging.

---

## 11. Appendix — copy bank (for ongoing creative)

**Hooks:** Stop trading SPY blind. · See what the market makers see. · Trade with dealer
positioning — not guesswork. · Know the levels that matter — before SPY/SPX/QQQ get there. ·
Same dip, opposite outcome — depending on the regime. · The edge institutions keep secret.

**Proof points (safe):** 1-second refresh · 8+ analytics modules · gamma flip + call/put
walls + max pain + options flow · 13 named signals · Vanna & Charm · SPY · SPX · QQQ · free
daily levels, no signup · 40+ endpoint API (Pro).

**CTAs:** View free levels · See it live · Start 7-Day Free Trial · No charge until day 7 ·
Cancel anytime · Start free for 7 days.

**Trust:** 3% of every subscription funds Folds of Honor scholarships.

---

## 12. Open items to confirm before spend

- [ ] X Pixel + the 4 events installed and firing on `zerogex.io`.
- [ ] Follower-look-alike handles exist and are targetable in X Ads.
- [ ] `$19` / `$29` promo still live (else update pricing copy).
- [ ] `@FoldsOfHonor` handle verified.
- [ ] Creative produced: static C1–C4 + C6, video V1 (screen-capture of the live dashboard).
