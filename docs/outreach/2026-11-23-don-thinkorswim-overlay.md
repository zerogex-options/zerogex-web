# Don Brown: can the levels go on thinkorswim charts? (2026-11-23)

American English, and each paragraph in the reply is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** To support@zerogex.io, from don.brown@leveragesourcecapital.com,
subject "Platform question", received by Mon Nov 23 (the screenshot doesn't
show the time):

> Can your levels be overlaid on think or swim charts or do I need a separate
> monitor to view them.

Nothing says what he trades or whether he has an account.

> **Status:** ready to send, with the sale line. The account check, run Mon
> Nov 23, found no account under this email.

## The read

- **Yes, with the free thinkorswim study, and it comes filled in.**
  `/thinkorswim-indicator` copies the study with that day's SPX levels already
  in it (`core/thinkorswimStudy.ts`, fed the 15-minute-delayed snapshot in
  `app/thinkorswim-indicator/page.tsx`). No account needed. Each ticker's free
  levels page (SPX, SPY, QQQ, NDX, ES, NQ) has the same section, "Plot these
  levels on thinkorswim", filled with that ticker's numbers
  (`app/spx-gamma-levels/gammaLevels.tsx`).
- **/ES and /NQ need their own page, so the reply names them.** Those pages
  convert the SPX and NDX levels to the futures price
  (`app/es-gamma-levels/page.tsx`, `app/nq-gamma-levels/page.tsx`). An
  SPX-filled study on a /ES chart would draw every line off by the SPX-to-ES
  gap.
- **It's manual, and that's thinkorswim's rule, not ours.** thinkScript has no
  network access, so no study on that platform can fetch outside data
  (`docs/thinkorswim-indicator.md`). Same answer as
  `2026-10-25-todd-ninjatrader-tradingview-updates.md` and
  `2026-11-01-michael-nash-nq-walls.md`. Don't hint that a self-updating
  thinkorswim version is coming.
- **The lines don't move during the day, so the reply says so.** Refreshing
  means copying again and pasting over the saved study, or typing the numbers
  into its settings (both are on the page). The free numbers are about 15
  minutes behind (`core/freeDelay.ts`).
- **"Separate monitor": no.** The four lines sit on his own chart. The
  dashboard, where paid plans get levels recalculated about once a minute
  through the session (the plan list on `/gex-levels`), runs in a browser, so a
  tab or window next to thinkorswim works. The reply calls a second screen
  handy, not required.
- **He has no account under this email, so the reply includes the sale.** The
  check under the reply came back empty on Mon Nov 23. The Black Friday sale
  is half off the first year of any plan, first-time members only, through
  Tue Dec 1 (`docs/black-friday-2026-runbook.md`). It gets one line, after
  the answer, and the rest of the reply sells nothing.
- **Left out: NinjaTrader, Sierra Chart, Bookmap, SabrTrader, wall alerts and
  the morning email.** He asked about thinkorswim. They're in "If he replies".

## Reply (draft)

**Subject:** Re: Platform question

Hi Don,

Thanks for reaching out. Yes, you can put our levels right on your thinkorswim charts, so you don't need a separate monitor for them.

We have a free thinkorswim study that draws the Gamma Flip, Call Wall, Put Wall and Max Pain as lines on your chart, each labeled with its price. Go to https://zerogex.io/thinkorswim-indicator and click the "Copy with today's SPX levels" button. Then, on a thinkorswim chart, open Studies, choose Edit Studies and click Create. Select everything in the editor, paste ours over it, name it "ZeroGEX Daily Gamma Levels" and click OK, then apply it to the chart. The numbers are already filled in, so the lines show up right away. It can also sound an alert in thinkorswim when price crosses one of them.

That page fills in SPX. If you trade SPY, QQQ, NDX, /ES or /NQ instead, open that ticker's page from https://zerogex.io/gex-levels and scroll down to "Plot these levels on thinkorswim" to copy the study with its numbers. For /ES and /NQ, the levels are already converted to the futures price.

One thing to know: thinkorswim doesn't let any study pull in data from outside thinkorswim, ours or anyone else's. So the lines stay where they are until you update them. To update them, for example each morning, copy the study again and paste it over your saved one, or type the new numbers into its settings. The free numbers run about 15 minutes behind the market.

If you want levels that update as the market moves, that's our dashboard, where they're recalculated about once a minute during the session. It runs in your web browser, so a tab or window next to thinkorswim works fine. A second monitor is handy but not required.

If you'd like to try the dashboard, our Black Friday sale runs through Tuesday, December 1: half off your first year on any plan, covered by our 7-day money-back guarantee. Details are here: https://zerogex.io/pricing

If anything doesn't work when you set it up, just reply here.

Best,
Michael

### The account check behind the sale line

Run Mon Nov 23. It returned no row, so the sale line is in the reply above.
Read-only:

```bash
sudo sqlite3 -readonly /var/lib/zerogex/auth.db "SELECT email, tier, created_at, stripe_subscription_id, subscription_status, paid_welcome_email_sent_at, subscription_lapsed FROM users WHERE lower(email) = 'don.brown@leveragesourcecapital.com';"
```

No row means no account under this email, so a new account would count as
first-time. So would a row with `tier` `public`, empty
`stripe_subscription_id` and `paid_welcome_email_sent_at`, and
`subscription_lapsed` 0: that is what checkout counts as first-time
(`hasHeldSubscriptionBefore` in `app/api/billing/checkout/route.ts`). If he
turns out to have an older account under another email that has held a
subscription, checkout won't offer him the sale on it.

## If he replies

- **"Can it update by itself on thinkorswim?"** No, for the reason in the
  reply, and don't give a date. Levels that redraw themselves on a chart exist
  only on other platforms: NinjaTrader 8, Sierra Chart and Bookmap with a Pro
  API key, and SabrTrader, which has ZeroGEX built in on the same key. All on
  https://zerogex.io/integrations. Each means charting outside thinkorswim, so
  only bring them up if he asks.
- **"Do the alerts work when thinkorswim is closed?"** No. They're what
  thinkorswim calls local alerts: the study raises them, so they only go off
  while thinkorswim is open with the study on a chart, as a message and a
  sound inside thinkorswim. They can also go off mid-bar, as soon as price
  crosses a line, at most once per bar. thinkorswim's reference defines
  `Alert.BAR` only as "once per bar", so don't tell him they wait for the bar
  to close, even though the study's own comments say so. Alerts that reach him
  without thinkorswim open are our wall alerts, on any paid plan, for SPX, SPY,
  QQQ and NDX. They follow the live walls and email him when price hits,
  breaks through or bounces off one (details in
  `2026-11-18-gregory-tradingview-without-website.md`).
- **"Does it work on thinkorswim web or the phone app?"** The page says the
  study syncs to his account and follows him to both. Nobody has tested it on
  a phone, so say "it should".
- **"The button just said Copy the study" or "the lines didn't show up."** The
  page couldn't load that minute's levels, so it handed over the blank study,
  and a blank study draws nothing. Tell him to reload the page and copy again,
  or type the four numbers from the cards on any free levels page into the
  study's settings.
- **"The morning numbers don't match the site later."** His lines don't move,
  and the free numbers are delayed. Before the open, the levels are still the
  ones from the previous 4 PM close: we price the options only in the regular
  session, and the new open interest comes in around the 9:30 open
  (`/help/platform/data-coverage`). The free pages show the new numbers about
  15 minutes after that, and the paid dashboard is live through the day.
- **"Can the numbers come to me instead?"** The free morning email: every
  trading day between 8:30 and 9:25 AM ET, the Gamma Flip, Call Wall, Put Wall
  and Max Pain for SPX, SPY, QQQ, NDX, ES and NQ, each one labeled. Sign up at
  https://zerogex.io/gex-levels#levels-email and click the confirmation link.
  He can type those into the study's settings instead of re-copying.
- **"What does it cost?" or "Is there a trial?"** He's first-time (check
  above), so the sale and the 7-day free trial exclude each other: the free
  trial is on Basic monthly at the regular $39, and starting it costs him the
  sale. `2026-11-21-joaquin-see-the-dashboard.md` has the wording.
