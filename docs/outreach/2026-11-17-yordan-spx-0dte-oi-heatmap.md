# Yordan Patronski: SPX 0DTE open interest heatmap (2026-11-17)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Tue Nov 17, 7:14 PM, to support@, as a reply in the thread where
you told him on Nov 5 that the rest of the MAG 7 is coming, then GLD:

> Can you add an SPX open interest heatmap. No need to add a whole option
> chain, just OI for the current day (0DTE). Something like this

He attached a picture. I couldn't see it; see "Decide before sending".

> **Status:** Nov 18: sending the draft as written. The heatmap fix is
> merged but not deployed, so the follow-up below goes after the deploy.

## The read

- **He's asking for numbers we already show, just not as a heatmap.**
  Dealer Positioning (`/gamma-exposure`, Metrics → Positioning) has "Open
  Interest by Strike", with calls above the axis and puts below
  (`components/GexWallsChart.tsx`). The expiration menu at its top right offers
  "0DTE · today's expiry" (`components/ExpirationMultiSelect.tsx`). The feed
  has one row per strike, expiration, and call or put (zerogex-oa
  `get_open_interest`), so the 0DTE view is real. It's a bar chart.
- **Every heatmap on the site is gamma, not open interest.** The GEX Heatmap
  (strike × time) and the Strike × DTE heatmap on Dealer Positioning both shade
  net GEX.
- **The GEX Heatmap's Expiry menu: fixed and merged, not deployed yet.** It
  used to relabel the chart without filtering it. Both halves of the fix are
  on `release` as of Nov 18: web `cc30afa` and zerogex-oa `864cea5`, with no
  schema change. The web half also makes the heatmap follow the expiry picked
  anywhere in the tab, so deploy zerogex-oa first. If the web half goes live
  alone, the draft's 0DTE step labels the heatmap card on the same page
  "0DTE" while it still sums every expiration. The draft leaves the heatmap
  out, because until the deploy its live Expiry menu still mislabels. The
  follow-up after the draft points him to it once it works.
- **The once-a-day point is the useful one for a 0DTE trader.** 0DTE open
  interest is only the positions carried in from earlier days, and it doesn't
  change during the session. The Gamma Terminal's Volume basis does follow the
  0DTE Expiry filter (zerogex-oa `get_volume_gamma_by_strike` applies
  `expirations`), so it's a working pointer for today's trading.
- **Left out on purpose: GLD and the rest of the MAG 7.** Single stocks are
  still NVDA and MSFT (`core/symbols.ts`). Nothing new since Nov 5, and he
  didn't ask.

## Decide before sending: commit to the heatmap or not

- **What it takes.** Web-only, an ordinary deploy. The open interest feed
  Dealer Positioning already loads (`/api/market/open-interest`) has every
  strike, expiration, and side, and the by-strike rows carry `call_oi` and
  `put_oi` too. No API or database change.
- **The shape depends on his picture.**
  - **Strikes against expirations:** an OI switch on the Strike × DTE heatmap
    (0DTE is its first column).
  - **A shaded list of strikes:** a heatmap view on the Open Interest by Strike
    card that follows its expiry menu.
  - **Strikes against time:** open interest doesn't move during the session,
    so it would be flat bands. The draft's once-a-day paragraph already
    answers that.
- **Lean: don't commit yet.** What he asked for is already on the site, and
  his answer will tell you whether the layout matters. Nothing forces it this
  week. The draft notes it and asks. The paragraph after the draft commits.

## Verify first

- **His plan: done, Nov 18.** `y.patronski1819@gmail.com` is `basic`,
  `active`, so the draft goes as written.
- **His second account: done, Nov 18. Leave it.** `ypatronski1819@gmail.com`
  (no dot) is a free account that Sign in with Google created on Oct 21, two
  days after he registered the paid one with a password. Gmail ignores dots,
  but sign-in matches the exact address (`createOrLoginOAuthUser` in
  `core/serverAuth.ts`), so it made a new account instead of signing him in.
  He used it for about 35 minutes that day and never again. The paid account
  has a password, no Google link, and was last used Nov 18. The check:

  ```bash
  sudo sqlite3 -readonly -header /var/lib/zerogex/auth.db "SELECT u.email, u.tier, u.created_at, u.last_seen_at, u.password_hash IS NOT NULL AS has_password, (SELECT group_concat(i.provider) FROM user_identities i WHERE i.user_id = u.id) AS linked FROM users u WHERE u.email IN ('y.patronski1819@gmail.com', 'ypatronski1819@gmail.com');"
  ```

## Draft

Reply in the same thread.

Hi Yordan,

Thanks for the suggestion, and for sending an example.

The numbers are already on the site, as a bar chart rather than a heatmap. Pick SPX in the symbol picker at the top of the page, open Dealer Positioning from the Metrics menu, and scroll down to "Open Interest by Strike". In the expiration menu at the top right of that chart, choose "0DTE · today's expiry". The chart then shows open interest for today's expiration only, strike by strike, with calls above the line and puts below it. Hover over a bar for the exact numbers. https://zerogex.io/gamma-exposure

One thing to keep in mind with 0DTE: open interest is only published once a day, so it shows the positions carried into today's expiration from earlier days. A position opened today never shows up in it, because it expires before the next update. To see where today's trading is, open the Gamma Terminal, set Expiry to "0DTE · today's expiry" and set the ladders' Basis to Volume. Each strike is then shaded by how much gamma has traded there today, and the deeper the color, the bigger the number. https://zerogex.io/chart

I've noted the heatmap itself. Have a look at the open interest chart and let me know whether it gives you what you need, or whether it's the heatmap layout that makes the difference for you.

Best,
Michael
Founder, ZeroGEX

**If you decide to build it, replace the "I've noted the heatmap itself..."
paragraph with:**

I'm also going to add the heatmap: today's SPX open interest, strike by strike, shaded so the biggest strikes stand out at a glance. I'll write to you when it's live.

## Follow-up, after the heatmap deploy

Deploy zerogex-oa first, then the website. Check it on the live site before
sending: open the GEX Heatmap with SPX selected, choose "0DTE · today's
expiry" in its Expiry menu, and confirm the picture changes when you switch
back to All.

Hi Yordan,

A quick follow-up: you can now see 0DTE as a heatmap. Open the GEX Heatmap from the Metrics menu with SPX selected, and choose "0DTE · today's expiry" in its Expiry menu. It then shows today's expiration as a heatmap: strikes up the side, time along the bottom, with the price candles on top. It's shaded by dealer gamma rather than by the number of contracts, which is the same open interest weighted toward the strikes near price, where hedging matters most. https://zerogex.io/gex-heatmap

Best,
Michael
Founder, ZeroGEX

## If he replies

- **"The bar chart (or the GEX Heatmap) does it."** Done. Nothing to build.
- **"I want the heatmap."** Build the shape his picture shows (see "Decide
  before sending"). No date until it's deployed, then write to him.
- **He wants open interest that updates during the day.** The clearinghouse
  publishes it once a day. Tools that show it moving are estimating it from
  trades. Point him back to the Volume basis, which says plainly that it shows
  activity, not positioning.
- **He asks about GLD or the MAG 7.** Same as Nov 5: the rest of the MAG 7,
  then GLD. No date.
- **He says a page asks him to upgrade, or Google sign-in shows the wrong
  account.** He signed in with Google and landed on the free account.
  Deleting it alone won't help, because his next Google sign-in would just
  make another one. Do both steps:
  1. Delete the free account. It has no plan and no password, and the delete
     is permanent, which frees his Google sign-in. The script falls back to
     the local `frontend/data/auth.db` unless told otherwise, so name the
     production path. Dry run first; it must find only the no-dot address:

     ```bash
     cd ~/zerogex-web && AUTH_DB_PATH=/var/lib/zerogex/auth.db make delete-user EMAIL=ypatronski1819@gmail.com DRY_RUN=1
     ```

     Then run the same command with `YES=1` in place of `DRY_RUN=1`.
  2. Ask him to sign in with his email and password, open Account, and click
     Connect next to Google. After that, Sign in with Google opens his paid
     account.
