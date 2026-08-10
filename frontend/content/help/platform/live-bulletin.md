# Using the Live Bulletin

*A live, share-ready snapshot of dealer gamma positioning for the symbol you're watching.*

---

## What the Live Bulletin is

The Live Bulletin is a **live dealer-gamma report card** for one underlying at a time. Pick a symbol and it pulls the current positioning snapshot straight from the backend and lays it out on a single card: the gamma regime, the key levels (gamma flip, call wall, put wall, max pain), net GEX, the put/call ratio, an expected-range band, and a positioning map that places spot against those levels.

It's built to be read at a glance — and to be shared. You can tweak the headline and summary copy, then download or copy a clean PNG of the card for your notes, a trading chat, or social.

## What's on the card

- **Gamma Regime badge** — positive (dealers long gamma; pinned, lower vol), negative (dealers short gamma; trending, higher vol), at-the-flip (transition), or unresolved when the chain is too thin to resolve a flip cleanly.
- **Headline + summary** — a plain-English read auto-generated from the live numbers: dealer posture, where spot sits relative to the flip, the wall corridor, and what the regime implies for the tape. Editable — see below.
- **Spot** — the underlying's price and change on the day. When a cash index is outside its session (e.g. SPX overnight), spot is **futures-implied** from ES/NQ and clearly flagged as such — never shown as a live cash print.
- **Metric grid** — Gamma Flip, Net GEX, Put/Call ratio, Call Wall, Put Wall, and Max Pain.
- **Expected Range** — a 1σ (~68%) implied-move band for the chosen horizon, derived from VIX (SPX/SPY) or VXN (QQQ/NDX), plus a note on where the dealer walls sit relative to that band.
- **Positioning Map** — put wall, gamma flip, spot, and call wall laid on one price axis, with the expected-range band shaded, so you can see at a glance where price sits among the magnets.

## Controls

- **Underlying** — SPX, SPY, QQQ, or NDX.
- **Expected-range horizon** — Daily, Weekly, or Monthly. "Daily" is one trading session of implied vol (the Expected Daily Range), not a calendar day; Weekly is 5 sessions, Monthly ~21. If the implied-vol index is unavailable, the band is hidden rather than guessed.
- **Headline / Summary** — the auto-generated copy is a starting point; edit either field and the card updates live. "Reset to auto" restores the generated text.
- **Download PNG / Copy to clipboard** — export the card as a share-ready image (the card carries a zerogex.io watermark).

## How it updates

The card is **live**. It polls the backend throughout the session — spot every few seconds, the gamma summary and profile every ~10 seconds, the volatility gauge every ~30 seconds — so the levels, the regime, the expected-range band, and the auto-generated read all refresh as conditions change. The dealer-gamma levels themselves are recomputed by the analytics engine on roughly a one-minute cycle during the regular session, so the walls, flip, and max pain can move intraday as spot and positioning evolve. An "as of" timestamp (ET) on the card tells you how fresh the snapshot is.

## When it's most useful

- **Pre-open** — a fast read of where the walls, flip, and expected range sit going into the session, with the futures-implied spot while the cash index is still closed.
- **Around major levels** — glance at the positioning map when price approaches the flip, the call wall, or the put wall.
- **Sharing a read** — export the card when you want to hand someone the day's dealer-gamma picture without screenshotting the whole app.

## What it isn't

The Live Bulletin is **not a trade-signal feed**. It's a positioning/context snapshot — it shows you *where* dealer gamma sits and what regime that implies, not *when* to act. For firing signals and triggers, use the Basic and Advanced Signal dashboards and [Signal Alerts](/help/platform/alerts); for a directional read, see Trade Bias and the [Composite Score](/help/platform/composite-score).

## Visibility by tier

The Live Bulletin is a **Basic** feature — included in Basic and Pro. The Advanced signals it points you toward are gated separately to Pro.

## The admin mirror

There's a watermark-free admin version of the same card, used for screenshots and demos. That's an internal-only path.

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
