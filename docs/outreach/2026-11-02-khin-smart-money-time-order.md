# Khin Htwe: Smart Money in time order (2026-11-02)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Khin Htwe wrote to support@zerogex.io on Mon Nov 2 at 10:24 AM:

> How are you doing? I like your platform a lot I would like to see smart money
> flow execution time in order if possible.
>
> Thanks
> Khin

## The read

- **The sort already exists.** On the Smart Money page, clicking the **Time**
  header of the Block detail table sorts it by time. The first click puts the
  newest blocks on top, and a second click puts the oldest on top. Checked in
  `frontend/app/smart-money/page.tsx` on `release`.
- **Most likely, Khin hasn't found it.** The table opens sorted by
  **Notional**, biggest first, and goes back to that every time the page is
  opened or reloaded. Nothing remembers the last sort. The only on-screen hint
  that the headers sort is the small ↓ next to Notional. "Click a header to
  sort" is only in the ⓘ tooltip next to the Block detail heading.
- **Two other readings, both less likely.** The draft asks instead of guessing.
  - *Open in time order, or remember the last choice.* A small front-end
    change.
  - *Every block as it prints, like a running tape.* The page asks the API for
    50 blocks, and the API sends the session's largest by notional (the help
    page says so, and the page's code comments agree; not checked in
    zerogex-oa). Sorted by time, those are the same 50 in time order, so a
    newer, smaller block can be missing. Changing that is API work, not a page
    tweak.
- **Exact seconds aren't available.** Each row is one contract's trading within
  one minute, so the Time column is to the minute. This only matters if Khin
  asks.

## Before sending (optional)

Open the Smart Money page and click **Time** once, so you see what Khin will
see: the newest blocks on top, with a ↓¹ next to Time.

## Draft

**Subject:** reply in Khin's thread

Hi Khin,

I'm doing well, thanks, and I'm glad you like the platform.

You can already sort the smart money table by time. On the Smart Money page, click the word "Time" at the top of the table under the chart (tap it on a phone). The first click puts the newest trades on top, and a second click puts the oldest on top.

The table always opens sorted by size, biggest first, so you'll need to click "Time" each time you open the page.

If you meant something different, just reply and tell me what you'd like to see.

Best,
Michael

## If Khin replies

- **"Found it, thanks."** Nothing to do.
- **"Can it open that way?" or "It keeps going back to size."** Ask Claude to
  make the table remember the last sort in that browser. Front-end only, and
  small.
- **"I want to see every trade as it happens."** That needs the API to send
  the latest blocks instead of the 50 largest. Backend work in zerogex-oa, so
  decide whether it's worth it before promising anything.
- **"Can it show the exact time?"** Not available. Each row covers one
  contract for one minute, so the time is to the minute.
