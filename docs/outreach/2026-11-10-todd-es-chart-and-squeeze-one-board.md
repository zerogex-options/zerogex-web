# Todd: the ES chart and the Squeeze Setup on one page (2026-11-10)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Todd Williams (see `2026-10-25-todd-ninjatrader-tradingview-updates.md`) wrote
again in the same thread on Mon Nov 9 at 6:18 PM ET. He used ZeroGEX on his
iPad last week while out of the office, has since set it up on his laptop and
"imported into my charts," and says it's "just what I was looking for." He
signs "TW".

> **Status:** sent Mon Nov 9 at 8:31 PM ET, with a shorter first line. Todd's
> next email is in `2026-11-11-todd-flip-time-tradingview-trace.md`.

His question:

> how can I get the ES chart and squeeze setup on the same page / view? Or do
> I just need to open 2 browser windows side by side?

He attached two iPad photos: an ES Gamma Chart (5m, Layers 11, Expiry All, the
gamma rail on the right, a SHORT Γ badge) and his My Dashboard with four signal
tiles (Squeeze Setup, Trap Detection, Dealer Delta Pressure, Range Break
Imminence). He says he needs to spend more time learning the dashboard.

## The read

- **Yes, one board, no second window.** My Dashboard's **Gamma Chart** widget
  (`gamma-chart` in `frontend/app/my-dashboard/registry.tsx`) mounts the same
  `GammaTerminalChart` as the chart in his photo. The rail, Layers, Expiry,
  Rewind and the gamma badge all come with it. A tile only drops full screen
  (`canFullscreen` in `frontend/components/GammaTerminalChart.tsx`). It opens on
  the board's symbol, ES.
- **Gamma Chart, not Gamma Terminal.** His photo has the gamma rail inside the
  chart, which is the Gamma Chart's default. The Gamma Terminal widget swaps the
  rail for ribbons and ladders and needs more width. It's also listed first
  under Overview, so the draft has him search by name instead of browsing.
- **L + S fill one row on a laptop.** On the desktop grid (1024px and wider)
  S, M, L and XL are a quarter, half, three-quarters and all of the row, so the
  chart at L and the Squeeze Setup at S share a row. Below 1024px, L takes the
  whole row and S drops under it at half width (`.zg-mydash-grid` in
  `frontend/app/globals.css`). His iPad window was narrow: the photo shows no
  Split view button (hidden under 768px) and two signal tiles per row (640px
  and up). So on the iPad they'll stack, and the draft says so.
- **New widgets land at the bottom** (`addWidget` in
  `frontend/core/myDashboardLayout.ts`), so the draft has him drag it up. In
  Customize the tile's contents ignore the pointer, so dragging the chart moves
  the tile rather than panning the chart (`WidgetFrame.tsx`). The Add widgets
  panel stays open after Add, hence "close the list."
- **The board lives on his account** (`useAccountBoard.ts`). Set it up on the
  laptop and the iPad opens the same board.
- **The catch: his board is pinned to 0DTE.** The bar above his tiles reads
  "Expiration 0DTE · none". That's a rolling 0DTE pin on the board; "· none"
  only because he took the photo after the close. Charts on the board follow
  that pin (`useSharedExpirations` reads the pane's `ExpirationScopeContext`),
  and with any expiry filter the chart draws the flip, walls and max pain from
  the filtered book (`levelBucket` in `GammaTerminalChart.tsx`). ES is served
  from the SPX book, which has a same-day expiry every weekday. So during the
  session a Gamma Chart on his board would show same-day levels, not the
  all-expiry levels in his photo. The signal tiles take no expiry
  (`SignalSnapshotBody` calls `useSqueezeSetupSignal(symbol)`), so switching
  doesn't change them. He may have picked 0DTE on purpose, so the draft
  explains it and leaves the choice to him.
- **One learning link.** The Signal link on each tile opens that signal's page
  (score, inputs, how it's built, recent events).
  `/help/platform/signals-overview` covers all of them and how to read the
  cards.
- **No account check needed.** The steps are the same on any plan, and his
  photo shows the Pro tiles live.

## Draft

**Subject:** Re: Quick note from Michael at ZeroGEX

Hi Todd,

Great to hear it's just what you were looking for, and thanks for the pictures. They made your question easy to answer.

You don't need two windows. The chart in your first picture is also a widget you can add to My Dashboard, so it can sit right next to your Squeeze Setup:

1. On My Dashboard, click Add widgets, type "Gamma Chart" in the search box, click Add, and close the list. It's the same chart with the same Layers, Expiry and Rewind buttons, and it opens on ES like the rest of your board. New widgets go at the bottom of the board.
2. Click Customize, then drag the chart up to the top of the board, ahead of the Squeeze Setup.
3. Each tile now has size buttons in its top-right corner. Set the chart to L (three-quarters wide) and the Squeeze Setup to S (a quarter wide), so the two fit in one row.
4. Click Done.

On your laptop, the chart and the Squeeze Setup will sit side by side, with your other signals below. If the browser window is narrower, as it was on your iPad, the Squeeze Setup moves just under the chart instead. Your board is saved to your account, so you only need to set it up once, and your iPad will show the same board.

One setting to check: in the bar at the top of your board, Expiration is set to 0DTE. Charts on the board follow that setting, so this one would draw its levels from same-day options only, and they won't match your first picture, which uses all expirations. If you want the same levels as that chart, click Expiration and choose All expirations. Your signal tiles read the same either way.

When you have time to dig into the signals, the Signal link at the top right of each tile opens that signal's full page. This page explains how they all work and how to read the cards: https://zerogex.io/help/platform/signals-overview

Happy to help if anything doesn't look right. Just reply here.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **"Can I have all four signals beside the chart?"** Split view, on a window
  at least 1280px wide: Customize, then Split view, then each signal tile's
  "Move to side B" button, with the chart at XL on side A. Each half is its own
  grid, so the chart takes the left half and the signals sit two by two on the
  right. Below 1280px the halves stack.
- **"The levels on the dashboard chart don't match my chart."** First the 0DTE
  pin above. Otherwise the chart tile may have been switched to another symbol:
  in Customize, a tile on its own symbol shows a chip in its top-right corner,
  and clicking the chip puts it back on the board's symbol.
- **"Can the squeeze show on the chart, or alert me when it fires?"** Not
  today. The chart has no signal layer, and triggers show in the app only, as
  the tile switching to "Triggered" (`/help/platform/alerts`). Say it's noted.
  No promise.
- **"Can I get the squeeze in NinjaTrader?"** No. The indicator draws the
  levels only (`frontend/public/ninjatrader/ZeroGexGammaLevels.cs`). Same
  answer: noted, no promise.
