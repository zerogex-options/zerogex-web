# michasbausrl@hotmail.de: "Where can I find the call vs put liquidity?" (2026-11-10)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Tue Nov 10, 10:11 AM: "Hey, where can I find the call vs put
liquidity?" Same member as `2026-11-09-michasbausrl-yellow-button-annual.md`:
Pro annual, paid through Oct 20, 2027, so every page is open to them.

> **Status:** draft, unsent.

## The read

- **"Liquidity" means one of two things here, and there's a page for each.**
  The reply names both and asks for a screenshot if neither is it.
- **How easy each side is to trade: the Spread Monitor** (`/spread-monitor`,
  Metrics → Market Context). The header cards "Put spread" and "Call spread"
  are the median quoted width on each side. "Put / call width" divides them,
  and above 1 means puts are the expensive side. "Through the session" plots
  puts and calls apart. SPX, NDX, SPY and QQQ only: ES and NQ have no option
  chain of their own (`content/help/platform/spread-monitor.md`).
- **Where the open interest sits: Dealer Positioning** (`/gamma-exposure`,
  Metrics → Positioning). Its "Open Interest by Strike" chart puts calls above
  the axis and puts below, strike by strike, with an OI / Notional toggle
  (`components/GexWallsChart.tsx`).
- **In the German UI the Metrics menu reads "Kennzahlen".** The page names
  stay in English.

## Draft reply

Reply in the same thread.

Hi Micha,

Good question. "Liquidity" can mean two things, and there's a page for each.

If you mean how easy calls vs puts are to trade (the bid/ask spread), it's on the Spread Monitor: https://zerogex.io/spread-monitor

At the top, "Put spread" and "Call spread" show how wide each side is quoted, and "Put / call width" compares the two. Above 1 means puts are the more expensive side to trade. The "Through the session" chart shows puts and calls separately through the day. It covers SPX, NDX, SPY and QQQ.

If you mean where the open interest sits, calls vs puts at each strike, it's on Dealer Positioning: https://zerogex.io/gamma-exposure

The "Open Interest by Strike" chart shows the calls above the line and the puts below it, strike by strike.

Both pages are also in the Metrics menu (called "Kennzahlen" if your site is in German).

If you meant something else, just send me a screenshot and I'll point you to it.

Best,
Michael
Founder, ZeroGEX
