# Aaron B: 1-minute hedging flow is live (2026-11-02)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Aaron signs "Aaron" and shows as *Aaron B*. He's on Pro and works through the
API from his own system (see `2026-10-26-aaron-wall-alerts-api.md`). Reply in
his thread from Sat Oct 31.

> **Status:** the first reply (below, under "Thread so far") was drafted
> 2026-11-01 and promised an email when this went live. The "It's live" draft
> is unsent: send it after both branches are deployed and "Confirm before
> sending" passes.

## Thread so far

1. **Sat Oct 31, 10:04 AM, inbound.** Likes the wall alerts. He tried to build
   a 1-minute hedging view, but `/api/flow/hedging` and the Hedging Flow page
   only come in 5-minute bars. His Claude suggested asking for
   `timeframe=1min`, as the flow series and per-strike flow already offer, and
   described the math: net contracts bought × delta × 100 × index price.
2. **Nov 1, outbound draft.** Yes; his Claude has the math right; a
   `timeframe=1min` option plus a 5 min / 1 min switch on the page; smoothing
   stays at 15 minutes so the chart does not fill with flips; 1-minute history
   reaches back about two months. "I'll email you as soon as it's live."

## The read

- **What shipped.** zerogex-oa: `/api/flow/hedging?timeframe=1min` (and the
  `/api/v2/` mirror). zerogex-web: a 5 min / 1 min switch in the Hedging Flow
  chart's control row. Same calculation, grouped by the minute instead of five.
- **The totals match exactly.** A 5-minute bar's session totals equal those of
  the last minute inside it, and its per-bar flows equal the sum of its five
  minutes (checked on a real Postgres by
  `tests/test_hedging_flow_1min_parity.py`).
- **Smoothing is counted in bars, and its default follows the bar.** 3 bars on
  5-minute, 15 on 1-minute: 15 minutes either way. An API user who passes
  `smoothing` gets that many bars of whatever size he asked for, so the draft
  tells him. The response reports it in `smoothing_bars`.
- **History.** 1-minute bars are computed from the stored trades on every
  read, so they reach back `DATA_RETENTION_DAYS`, which is 60 on the box
  (checked Nov 2). Older dates return an empty `bars` list at `1min` and still
  answer at `5min`.
- **What stays 5-minute on the page.** Gamma Weather, the structure chart under
  the flow chart, and the dated session pages. The two stacked charts share a
  crosshair by time, so hovering 10:03 on the 1-minute chart lands the
  structure chart on its 10:00 bar.

## Confirm before sending

On the EC2 box, from `~/zerogex-oa`, after the API has restarted on the new
code. This reads the ops key from `.env` without printing it and asks for the
last three 1-minute SPX bars:

```bash
KEY=$(grep -E '^(OPS_API_KEY|API_KEY)=.' .env | head -1 | cut -d= -f2- | tr -d "\"'"); curl -s -H "Authorization: Bearer $KEY" "https://api.zerogex.io/api/flow/hedging?symbol=SPX&timeframe=1min&intervals=3" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('timeframe'), d.get('smoothing_bars'), [(b['bar_start'], b['bar_end']) for b in d['bars']]) if 'bars' in d else print(d)"
```

It should print `1min 15` and three bars, each with a `bar_end` one minute after
its `bar_start`, and the three a minute apart.

- **`None 3` and bars five minutes apart:** the API is still running the old
  code, which ignores `timeframe`. Restart it and run the check again.
- **`1min 15 []`:** no 1-minute bars came back. Run it again in a minute; if it
  stays empty, don't send, and ask Claude.
- **A `detail` message instead of bars:** the key in `.env` isn't valid for
  this. Rerun with your own Pro key in place of `$KEY`.

Then open the Hedging Flow page, click **1 min** above the chart, and check that
the bars get thinner and the legend says "15-bar average".

## Draft

**Subject:** Re: (his Oct 31 thread)

Hi Aaron,

1-minute hedging is live, on the API and on the site.

On the API, add timeframe=1min to /api/flow/hedging (the /api/v2/ version takes it too):

https://api.zerogex.io/api/flow/hedging?symbol=SPX&timeframe=1min

Each bar is the same calculation over one minute: contracts bought minus contracts sold, times the option's delta, times 100, times the underlying's price at that minute. The session totals match the 5-minute bars exactly. For example, the 10:04 bar carries the same running totals as the 10:00 five-minute bar.

Three things to know:

1. The smoothed line and the flips still use a 15-minute average by default, which on 1-minute bars is 15 bars. smoothing is counted in bars, so smoothing=5 gives you a 5-minute average. The response tells you what it used in smoothing_bars.
2. 1-minute bars go back about two months. For older days, date= still works at 5 minutes.
3. The per-bar numbers are per minute, so they run about a fifth the size of the 5-minute ones.

On the site, the Hedging Flow page has a new 5 min / 1 min switch above the chart. Gamma Weather and the structure chart underneath stay on 5-minute bars.

Thanks again for the idea. I'd love to hear how it works with your system.

Best,
Michael
