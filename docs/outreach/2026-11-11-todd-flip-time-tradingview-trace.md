# Todd: is the 10:25 flip Eastern, and is this like SpotGamma's TRACE? (2026-11-11)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Todd Williams wrote again in the same thread on Wed Nov 11 at 11:00 AM ET,
answering the reply sent Mon Nov 9 at 8:31 PM ET
(`2026-11-10-todd-es-chart-and-squeeze-one-board.md`). He signs "TW".

> **Status:** draft, unsent. Reply in the same thread.

His message, trimmed:

> Side by side charts on iPad. Have fuselune open on zerogex. TradingView in
> the right. Both 5 min charts. Have curser vertical line at 10:25 am. Right in
> big green engulfing candle. Bounce off of a green box support zone.
>
> iPad shows est. my question the signal says flipped to buying at 10:25 - is
> that est / same as iPad time ?
>
> If so I just got the confluence I was looking for. Matches movement of ES
> chart !
>
> To me this seems similar to the Spotgamma Trace chart ...??
>
> Yesterday I used the squeeze widget as additional confirmation to capture
> several small moves - (2-4 pts) I like to test live and in ranges to gain
> confidence.

His photo is an iPad in split screen. Left: Fuseline Radar on ES, scrolled to
the Hedging Flow section, on 5-minute bars, Pressure rate, Significant flips
only ticked. The badge reads "Flipped to buying pressure at 10:25" and the Last
flip card "To buying, 10:25". Right: TradingView, ES1! on 5-minute candles,
with his cursor on a big green candle bouncing off a green box. The time label
under the cursor reads **"Wed Nov 11, 2026 09:25"**.

## The read

- **Yes, Eastern.** The flip time is formatted with
  `timeZone: 'America/New_York'` whatever the device's zone (`safeTimeLabel` in
  `frontend/core/flowSeriesCharts.ts`), and the Radar's chart pins the same
  zone (`GammaTerminalChart.tsx`). The Hedging Flow article already says it:
  "All times on the page are Eastern, on a 24-hour clock." He's in Eastern
  anyway.
- **His TradingView is on Chicago time, so its 09:25 candle is the 10:25 ET
  candle.** It can't be 9:25 Eastern. The Radar beside it already shows a
  10:25 flip, the newest TradingView candle is about six bars past the cursor
  (9:55 on that clock), both screens show ES near 7,632, and he sent the email
  at 11:00 ET. TradingView is showing CME's own clock, Central, an hour behind.
  So the flip and his engulfing candle are the same five-minute bar. His
  "confluence" rests on exactly that, so the draft says it plainly.
- **10:25 is the bar's start, and a flip on a bar still filling can come and
  go.** Both sides label five-minute bars by their start (`bar_start` on ours).
  The live series includes the bar that's still filling
  (`get_hedging_flow_series` in zerogex-oa `src/api/database.py`), and flips
  are recomputed on every read (`sign_flip_events` in
  `src/analytics/hedging_flow.py`). So a flip on the 10:25 bar could show up
  before 10:30 and vanish again. Finished bars don't change: both thresholds
  use only bars before the flip. The article says the same ("a flip on it can
  appear and disappear before that bar closes"). He trades 2-4 point moves
  live, so this gets one sentence.
- **TRACE vs HIRO.** Our comparison article calls TRACE "an S&P 500 heatmap"
  and HIRO "its real-time hedging indicator"
  (`frontend/content/articles/zerogex-vs-spotgamma.md`). Hedging Flow, an
  estimate of hedging pressure from the day's option trades, is the HIRO-like
  one. Our closest thing to TRACE is the GEX Heatmap, which the code calls the
  "SpotGamma-style candle-overlay surface" (`frontend/app/gamma-exposure/page.tsx`).
  It's Basic tier and serves ES (`/api/gex/` is projected in zerogex-oa
  `src/api/futures_middleware.py`). The draft describes SpotGamma's tools only
  in the words our article already uses. The one difference it adds is ours to
  state: the heatmap's positions are open interest, which updates once a day
  (the page's own tooltip says so).
- **The Squeeze Setup note: thank him, don't grade the trades.** No comment on
  the moves themselves (Terms section 5).
- **No "it's an estimate" line.** The chart prints "Not observed dealer flow"
  right under it, and he's using it as one input among several. Repeating it
  would read as a lecture.

## Draft

**Subject:** Re: Quick note from Michael at ZeroGEX

Hi Todd,

Yes, the 10:25 is Eastern time, the same as your iPad. Every time on that ZeroGEX page is Eastern, on a 24-hour clock.

It's your TradingView chart that's on a different clock. It's showing Chicago time, the exchange's clock for ES, which runs an hour behind Eastern. That's why the label under your cursor reads 09:25. That candle is the 10:25 Eastern candle, so the flip and your green engulfing candle are on the same five-minute bar. If you'd rather TradingView show Eastern too, you can change its time zone to New York in the chart settings.

One detail for trading it live: 10:25 is when that five-minute bar started. A flip on a bar that's still filling can come and go, so this one was only final when the bar closed at 10:30.

On SpotGamma: what you're looking at is closer to their HIRO than to TRACE. Hedging Flow is a live estimate of the hedging pressure created by the day's option trades, and HIRO is their real-time hedging indicator. TRACE is their heatmap, and the closest thing we have to it is the GEX Heatmap, which lays dealer gamma out by strike through the day: https://zerogex.io/gex-heatmap. The positions behind it update once a day, after the close, so a band that brightens during the session mostly means price is moving toward that strike.

Thanks for telling me how you used the Squeeze Setup yesterday. Hearing how members actually use these tools helps me decide what to build next. And if you'd like to dig into how the flips are picked out, this covers it: https://zerogex.io/education/hedging-flow-explained

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **"Can I see flips sooner?"** The 1 min button above the chart. It keeps
  the same 15-minute average but updates it every minute, so a turn is flagged
  up to four minutes sooner (`DEFAULT_SMOOTHING_BARS_1MIN` in zerogex-oa
  `src/analytics/hedging_flow.py`). Flip times then land on one-minute bars, so
  a 10:27 flip sits inside his 10:25 five-minute candle.
- **"Why do the Last flip card and the badge show different times?"** The card
  counts light flips too; the chart marks significant ones only, unless he
  unticks Significant flips only.
- **"Can I put Hedging Flow on My Dashboard?"** Yes (Add widgets, search
  "Hedging Flow"), but the tile is a compact copy: the chart without the flip
  badge or the 5 min / 1 min buttons (`compact` in
  `frontend/components/HedgingFlowChart.tsx`). For flips, keep Fuseline Radar
  or the Hedging Flow page open.
- **"Is this actual dealer trading?"** No. It's inferred from
  aggressor-classified option trades, assuming the passive side of each print
  was a market maker, and that assumption is unvalidated (the note under the
  chart). The article above covers it.
- **"Does the heatmap update positions during the day, like TRACE?"** Say what
  ours does (open interest is fixed through the session; a band brightens as
  price nears its strike) and don't describe how TRACE works.
