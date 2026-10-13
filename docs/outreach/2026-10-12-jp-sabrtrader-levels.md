# JP: which levels ZeroGEX sends to SabrTrader (2026-10-12)

A subscriber at jpmcginley@gmail.com replied to the October product-update
email on Mon Oct 12, with a SabrTrader screenshot of NQZ6 on a 15-minute chart:

> Good morning….when I attach your feed to Sabr Trader, what levels do you
> supply? Are all the levels on the attached coming from you?

The name "JP" is a guess from the address. Use their first name instead if you
have it.

## The read

- **SabrTrader doesn't compute gamma levels itself.** Its Gamma Levels page
  says so ("SabrTrader draws the chart; the levels themselves come from the
  provider you already pay for") and lists ZeroGEX as one of four providers,
  connected under Connections → Levels with a ZeroGEX API key. Per that page,
  it draws our call wall, put wall and gamma flip, plus Max Pain, Charm Flip,
  Vanna Flip, Zero Flow, and our strike profile as the histogram on the right.
  Source: https://www.sabrtrader.com/pages/gamma-levels
- **The screenshot shows more of ours than that page lists.** The labeled tags
  on the right edge map one-to-one onto fields in `/api/gex/summary` and
  `/api/forced-flow` (zerogex-oa `src/api/models.py`,
  `src/api/routers/forced_flow.py`):

  | On the chart | ZeroGEX field | Value |
  |---|---|---|
  | Call Wall | `call_wall` (= `call_walls[0]`) | 31,221.75 |
  | Call Wall 2 | `call_walls[1]` | 31,546.75 |
  | Call Wall 3, "Pin" | `call_walls[2]`, and `pin_strike` on the same strike | 31,121.75 |
  | Put Wall / 2 / 3 | `put_walls[0..2]` | 30,921.75 / 30,821.75 / 30,721.75 |
  | Max Pain | `max_pain` | 31,101.75 |
  | Max Gamma | `max_gamma_strike` (GEX King on our site) | 30,646.75 |
  | Zero Flow | `zero_flow_level` | 31,035 |
  | Charm Flip | `charm_flip` | 30,775 |
  | Vanna Flip | `vanna_flip` | 31,393.25 |
  | Histogram on the right | strike profile | |
  | Gamma flip | `gamma_flip` | not on the screenshot |

- **The wide bars with percentages are not ours.** "98.9% / CALL Resistance",
  "-100% / PUT Support", "-73.94% / 2nd PUT Wall" and "-64.23% / 3rd PUT Wall"
  use names and percentages we don't publish. They read as each strike's size
  as a share of the biggest bar in our histogram, so they're most likely
  SabrTrader's own markup of our profile. SabrTrader also lists MenthorQ as a
  levels source, and "Call Resistance" / "Put Support" are MenthorQ's names, so
  a second connected provider is the other possibility. The draft says "most
  likely" and points them to Connections → Levels rather than claiming either.
- **Why the bars and our walls disagree, which they'll notice next.** Our Call
  Wall is the biggest *call* strike above price and our Put Wall the biggest
  *put* strike below it (zerogex-oa `src/analytics/walls.py`). The bars rank
  every strike by net size, on either side of price. So their "PUT Support"
  sits at 31,021, above where NQ was trading (about 30,963), while our Put
  Wall is 30,921, which their bars call the "2nd PUT Wall".
- **Max Gamma vs. the -100% bar.** Max Gamma counts the whole chain. The
  histogram only shows strikes near price, and 30,646.75 is below it. Worth one
  clause in the draft so it doesn't read as a contradiction.
- **The missing gamma flip.** It's either off the visible range or we
  published none at that moment (we leave it blank when it's too far from
  price to place, with a reason code). Can't tell which from the screenshot, so
  the draft gives both.

## Draft

**Subject:** Re: What's new at ZeroGEX, and our first Folds of Honor donation

Hi JP,

Good morning, and good question. Nearly every labeled level on your chart comes from us. With the ZeroGEX feed connected, SabrTrader draws:

- **Call Wall, Call Wall 2, Call Wall 3:** the three strikes above price with the most call gamma, ranked by size.
- **Put Wall, Put Wall 2, Put Wall 3:** the same for puts below price.
- **Gamma Flip:** where dealer hedging switches from damping moves to adding to them.
- **Pin:** our Pin Strike, the strike today's expiring options are most likely to pull price toward into the close. On your screenshot it shares a tag with Call Wall 3.
- **Max Pain**, and **Max Gamma:** the strike with the most gamma across every expiration. It can sit outside the strikes the histogram shows, as it does on your chart.
- **Zero Flow, Charm Flip, Vanna Flip:** from our Forced Flow model. Zero Flow is the price where the hedging the option book forces into the close nets out to zero. The Charm and Vanna Flips are where time decay and a rise in volatility switch from forcing buying to forcing selling.
- **The gamma histogram** along the right edge, strike by strike.

On NQ, all of these come from the NDX options book, moved onto the NQ price.

The only levels on your screenshot that aren't ours are the wide bars with percentages ("CALL Resistance", "PUT Support", "2nd/3rd PUT Wall"). We don't publish those names or percentages. They're most likely SabrTrader's own markup of our histogram, unless you have a second provider connected under Connections → Levels. They also rank strikes differently: our walls look only at calls above price and puts below it, while the bars rank every strike by net size. That's why their "PUT Support" sits at 31,021, above where NQ was trading, while our Put Wall is 30,921.

The only one of ours missing from the screenshot is the gamma flip. Either it was off the visible range, or we didn't publish one at that moment. When we can't place the flip reliably, usually because it's too far from price, we leave it blank rather than draw a misleading line.

If anything on that chart ever doesn't match what you see on zerogex.io, send me a screenshot and I'll check it.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If they reply

- **"Where's the gamma flip?"** Check `/api/v1/levels/NQ` for that time:
  `gamma_flip_reason` and `gamma_flip_label` (e.g. `Flip >8%↓`) say why it was
  blank. If it was published, it was off their visible range.
- **"Your numbers are a few points off your NQ page."** SabrTrader's page says
  its auto-convert (on by default) maps NQ to NDX and does the futures
  conversion itself, so its offset may not match ours exactly. Each level
  still sits on the same NDX strike. A different contract month on their chart
  would also do it (`data_contract` names ours, NQZ26 now).
- **"The levels don't move overnight."** NQ levels come from NDX, which only
  trades 9:30 to 4:00 ET, so overnight they hold at the 4 PM close.
- **"Are the % bars right?"** That's a SabrTrader question. If they want
  certainty, SabrTrader support can say which source draws them.

## Follow-up: two API keys (Oct 12, 7:50 PM)

The subscriber is Jim (James McGinley). Their reply:

> Hello again...is it possible to have two API keys at the same time so I can
> keep using your data on SabrTrader and also use it on Ninja Trader so that I
> can see what it looks like on that platform?

### The read

- **Same key in both places. Don't issue a second one.** A member holds at
  most one live key: Generate API Key on the Account page revokes the old one
  first (`frontend/app/api/account/api-keys/route.ts`, and
  `/help/platform/api-access`). If Jim regenerates for NinjaTrader, SabrTrader
  stops updating. That's the trap behind the question, so the draft names it.
- **Nothing limits one key to one place.** The API has no per-key or per-IP
  cap. The rate limiter counts per account, not per key, so a second key
  wouldn't add capacity anyway. It ships log-only (`.env.example`: enforce
  off) at 600 requests a minute, and NinjaTrader polls once a minute.
- **The terms are fine with it.** They prohibit sharing credentials with
  other people (`/terms`, section 6), not using your own key on two of your
  own platforms.
- **NinjaTrader draws a different set than SabrTrader,** so say so before they
  compare them side by side (`frontend/public/ninjatrader/ZeroGexGammaLevels.cs`).
  It has the flip, call wall, put wall, max pain, pin strike, the top gamma
  strikes (GEX 1 to 10, their choice), VWAP and the same strike histogram. It
  doesn't draw Call/Put Wall 2 and 3, Max Gamma, or the Charm Flip, Vanna
  Flip and Zero Flow.
- **They're on Pro already.** Keys are Pro-only and they have one, so the
  NinjaTrader download on `/ninjatrader-indicator` is open to them.

### Draft

**Subject:** Re: What's new at ZeroGEX, and our first Folds of Honor donation

Hi Jim,

You don't need a second key. Use the same one in both. Your key works on as many of your own platforms as you like at the same time, so SabrTrader keeps running while you try NinjaTrader.

One thing to avoid: don't click Generate API Key again on your Account page. You can only have one active key, so generating a new one switches off the old one, and SabrTrader would stop updating until you pasted the new key in.

The NinjaTrader indicator and install steps are here: https://zerogex.io/ninjatrader-indicator. Paste the same key into its settings.

A heads-up for comparing the two: NinjaTrader shows a slightly different set. It has the gamma flip, call and put walls, max pain, pin strike, the top gamma strikes (GEX 1, 2, 3 and so on) and the same histogram. It doesn't show the second and third walls, Max Gamma, or the Charm Flip, Vanna Flip and Zero Flow.

I'd love to hear which one you end up preferring.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
