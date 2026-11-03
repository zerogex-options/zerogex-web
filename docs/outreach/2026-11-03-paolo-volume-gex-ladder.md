# Volume-based GEX ladder: Paolo (2026-11-03)

Paolo Bianchi (p.bianchi248@gmail.com) wrote to support@zerogex.io at 11:43 AM,
subject "Info on Zerogex":

> Hi, I'm a new member. I wanted to ask if it might be possible, or if you've
> ever considered, adding a GEX ladder based on volume? If it's already there, I
> apologize for not being able to find it. Your app is very useful, but I find
> that volume analysis is missing and I think is essential. thank's for all

A 1:1 founder reply from your own inbox. American English, one line per
paragraph in the draft, so it pastes straight into a mail client.

## The read

- **He didn't miss it. It doesn't exist.** Every GEX figure is gamma × open
  interest at each strike (zerogex-oa `src/analytics/main_engine.py`, the
  per-strike loop around line 1685). The same loop adds up each strike's
  volume, but volume never goes into the gamma.
- **The volume tools he hasn't found are all in Basic**, under Metrics: the
  GEX Metrics Snapshot table on Dealer Positioning (sortable Call Vol and Put
  Vol columns), Flow Analysis (its per-strike lanes are on by default) and
  Hedging Flow.
- **Same handling as Val's Gexbot question on Oct 11**
  (`2026-10-11-val-nt8-history-backtest.md`): say no plainly, show what covers
  the ground without calling it equivalent, note the request, no promise, no
  date.
- **The trade-off paragraph matches what the site already says.** Open
  interest updating once a day is in the Gamma Terminal help ("What the Gamma
  Terminal can't tell you"). Volume not telling opening from closing trades is
  in the Flow Analysis help. The Best GEX Tools article calls the volume-based
  route "a real trade rather than a strict improvement", so the draft explains
  the trade-off without knocking tools that sell a volume ladder.
- **Left out on purpose: the research experiment.** zerogex-oa
  `research/mm_attributed_gex` has an arm that builds gamma from the day's
  classified trades. It has never been run and no result exists, so mentioning
  it would read as a promise.
- **The closing question tells you which build he means.** Volume next to the
  existing ladders is the smaller job: the ladder's feed
  (`/api/gex/strike-profile-timeseries`) has gamma and open interest per strike
  but not volume, so it needs that field plus a ladder column. A ladder
  calculated from volume is a backend change: new stored columns (schema
  applied before the restart), an API field and a toggle. Neither is on the
  critical path. Both can wait for his answer.
- **Plain English.** His email reads like English isn't his first language.
  Short sentences, no formulas.

## Verify first

- **His plan.** All three pages are Basic, so the links open on Basic, Pro or a
  trial. Check:

  ```bash
  sudo sqlite3 -readonly /var/lib/zerogex/auth.db "SELECT email, tier, subscription_status, created_at FROM users WHERE email = 'p.bianchi248@gmail.com';"
  ```

  `tier` should read `basic` or `pro`. If it reads `public`, or no row comes
  back (he may have signed up with another address; try
  `WHERE email LIKE '%bianchi%'`), he isn't on a paid plan, and the line before
  the three links needs a sentence saying they come with Basic.

## Draft

**Subject:** Re: Info on Zerogex

Hi Paolo,

Welcome to ZeroGEX, and thank you for the kind words. No need to apologize: you didn't miss it. There's no volume-based GEX ladder today. Every GEX number in the app, including the ladders, the walls and the gamma flip, is built from open interest.

You're right that volume matters, and here is the trade-off. Open interest is only updated once a day, so a position opened today doesn't reach the ladders until the next session, and a 0DTE trade opened today never does, because it expires first. Volume shows today's trading as it happens, but it can't tell a trade that opens a position from one that closes it, so a ladder built on volume would count closing trades as new positions.

So the levels are built on open interest, and volume has its own pages. They're easy to miss when you're new, so here are the three to start with, all in the Metrics menu:

- Dealer Positioning has a strike-by-strike table, GEX Metrics Snapshot, with each strike's call and put volume for the day next to its net GEX and open interest. Click Call Vol or Put Vol to sort the strikes by volume. https://zerogex.io/gamma-exposure
- Flow Analysis is the volume page. It splits today's call and put volume into contracts bought and contracts sold, and plots the net flow at each strike, bar by bar, behind the price chart. https://zerogex.io/flow-analysis
- Hedging Flow estimates how much stock dealers would need to buy or sell to stay hedged against today's trades, bar by bar and as a running total for the day. https://zerogex.io/hedging-flow

ZeroGEX is new and growing, and most of what gets built next comes from feedback members send me directly, so I've noted your request. I can't promise a volume-based ladder or a date for it yet.

It would help to know how you'd use it. Would you want the gamma ladder itself calculated from today's volume, or today's volume added next to the gamma on the existing ladders?

Best,
Michael
Founder, ZeroGEX

## If he replies

- **"Volume next to the gamma on the ladders."** Note it. Until then, the GEX
  Metrics Snapshot table on Dealer Positioning shows the same numbers side by
  side. No date.
- **"The ladder calculated from volume."** Note it as a vote. If he names a
  tool that has one, that's worth knowing, but don't promise to match it.
- **He wants volume on the Gamma Chart itself.** Point him to Layers →
  Centroids (off by default): lines for where today's call and put volume is
  centered, on the same chart as the ladders.
- **He asks whether Hedging Flow is real dealer flow.** It's an estimate. It
  assumes the passive side of every classified trade was a market maker, which
  public data can't confirm. The page says so under its chart; say the same.
