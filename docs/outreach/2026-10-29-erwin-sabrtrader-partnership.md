# Erwin (SabrTrader): "get us listed", a webinar in return (2026-10-29)

Erwin Beckers, co-founder of SabrTrader (erwin@sabrtrader.com), emailed the
support inbox (read Thu Oct 29). He read the GEX tools article, saw Sierra Chart
and Quantower named, and asks what it takes to get SabrTrader listed, since
SabrTrader already has ZeroGEX built in. In return he offers a feature on
sabrtrader.com, a live walkthrough of our levels in one of their weekly
webinars, and a free SabrTrader license.

## Is SabrTrader already listed?

Yes, in two places:

- **`/integrations`** (`frontend/app/integrations/page.tsx`): a section,
  "Trading on SabrTrader? ZeroGEX is built in", with the Connections → Levels
  steps, the support split, and a link to SabrTrader's Gamma Levels guide. The
  page's meta description names it too.
- **`/help/platform/api-access`**: a SabrTrader bullet, in all five locales.

It isn't in the two places where it would also fit:

- **`/education/best-gex-tools`**, the article he read. The Sierra Chart and
  Quantower he saw are in the MenthorQ paragraph: the platforms MenthorQ ships
  its levels to. The article's ZeroGEX section never says where our levels
  plot, on any platform.
- **`/education/zerogex-vs-menthorq`** undercounts us: "ZeroGEX works with
  four: TradingView, thinkorswim, NinjaTrader, and Sierra Chart."

## SabrTrader, from its own site (checked Oct 29)

- Windows desktop order-flow platform (footprint, heatmap, DOM) for futures,
  forex, stocks, options and crypto, "66 brokers / feeds". "Built by the same
  people you know from TradeDevils Indicators." No founder is named on the
  site; the email's domain matches.
- Plans: Free (no gamma levels), Pro $85/mo ($849/yr), Ultimate $115/mo,
  Perpetual $1,499 one-time. Gamma Levels is "bundled with the options desk on
  Pro, Ultimate and Perpetual."
- Size: "Join 250+ traders in our Discord." YouTube @SabrTrader128. No webinar
  schedule or audience figures on any page read.
- Gamma Levels page (<https://www.sabrtrader.com/pages/gamma-levels>): five
  providers, "FlashAlpha, ZeroGEX, QuantData, GEXBot, TanukiTrade", plus
  MenthorQ as a separate block with its own indicator. Every user needs "your
  own ... ZeroGEX ... API key".
- **We're already their lead provider.** The hero chart is "MNQ with ZeroGEX
  levels", we're first in "What the provider adds", and the only
  provider-specific FAQ is "How do I get ZeroGEX levels on my chart?". The
  homepage's "Connects to your broker & data" strip lists ZeroGEX as well.
- **No link to zerogex.io on any page.** ZeroGEX is plain text everywhere,
  including where the page says you need our key.

## The read

- **Yes, it's mutually beneficial, and the structure favors us.** SabrTrader
  doesn't resell our data. Each of its users needs their own ZeroGEX Pro key
  ($59/mo, $299/yr) on top of a paid SabrTrader plan. So every SabrTrader user
  who wants our levels is a Pro sale for us, and a better Gamma Levels feature
  for them.
- **The upside is modest for now.** SabrTrader is new (its own FAQ asks "Can I
  trust a new platform with live orders?"), Windows-only, and has 250+ traders
  in Discord. A guess, until he answers: a webinar in the tens of viewers,
  plus the recording. It's worth doing because it costs very little: the
  listing exists, the article change is one bullet, and the webinar is an
  hour.
- **He's likely pitching the other providers on that page too.** Nothing here
  is exclusive, and nothing should be, in either direction.
- **What to ask for:**
  1. A link to zerogex.io where the page says you need our key, and in the
     ZeroGEX FAQ. Today a SabrTrader user who wants our levels has to find us
     on their own. This is the most valuable thing in the deal.
  2. Webinar details: dates, attendance, and whether the recording goes on
     YouTube. Michael joining for Q&A keeps the levels explained correctly.
  3. A technical contact for the connector. When an API change breaks it, our
     paying members notice first. The fields SabrTrader draws map onto
     `/api/gex/summary` and `/api/forced-flow` in zerogex-oa (see
     `2026-10-12-jp-sabrtrader-levels.md`).
- **What to give:**
  1. The listing (done), plus SabrTrader in the GEX tools article as a fact
     about where our levels plot, in the "What ZeroGEX brings" section only.
     SabrTrader computes no levels, so it doesn't belong in the article's
     buckets. The article is also the credibility anchor in
     `docs/seo/backlink-kit.md`, and a placement that reads as paid would cost
     more than it brings.
  2. Optional: a SabrTrader partner link, 25% off the first year for their
     users, with **no commission** for now (`COMMISSION_BPS=0`). It makes us
     stand out among the six providers on their page, gives the webinar an
     offer, and `make partners SIGNUPS=1` shows exactly what SabrTrader sends.
     They already feature us unpaid, so hold the 30% back as a lever for
     later rather than opening with it.
  3. Pro for their team if they don't already have it, so the connector stays
     tested and the webinar runs on live levels.
- **Take the free license.** It's Windows-only. It answers questions like
  Jim's (which bars on his chart were ours) by looking, not guessing.
- **Don't agree to:** one shared or platform-wide key that serves all
  SabrTrader users (that's reselling our data, which `/terms` section 6 bars,
  and would be a separate, priced data license); exclusivity; or a ranking or
  "recommended platform" line in the comparison article.

## Draft reply

Same thread. Each paragraph is one line so it pastes straight into a mail
client.

```
Hi Erwin,

Thanks for reaching out, and for building ZeroGEX into SabrTrader. I've seen your Gamma Levels page, and I appreciate how prominently our levels feature there.

Good news: SabrTrader is already listed on our site. Our Integrations page has a section for SabrTrader users, with the Connections → Levels steps and a link to your Gamma Levels guide: https://zerogex.io/integrations. Our API help page covers it too: https://zerogex.io/help/platform/api-access.

The GEX tools article is a different story: it doesn't yet say where ZeroGEX's own levels can be plotted. I'll add that, with SabrTrader in the list.

I'd be glad to do the webinar. What dates do you have in mind, roughly how many people usually attend, and does the recording go on your YouTube channel? I'm happy to join and take questions about the levels.

One thing that would help us both: your Gamma Levels page says traders need their own ZeroGEX API key, but it doesn't link to us. A link there, and in your "How do I get ZeroGEX levels on my chart?" answer, would put the key one click away. I can also set up a SabrTrader link that gives your users 25% off their first year of ZeroGEX. That gives the webinar an offer to point to, and shows us both what it brings in.

I'd gladly take you up on the free license. It would let me see exactly how SabrTrader draws our levels when our members ask. And if your team doesn't already have a ZeroGEX Pro account for testing the connector, I'll set one up at no charge.

Last thing: could you send me the best technical contact for the connector? I'd like to give them a heads-up before we change anything in the API it relies on.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

If you'd rather not discount, drop the two sentences starting "I can also set
up a SabrTrader link". The rest stands without them.

## If he replies

### Setting up their link and Pro account

Have Erwin, or whoever runs the connector, register at
<https://zerogex.io/register> and verify the email. Grant soon after, or the
`verified_never_paid` trial email reaches them first (cosmetic, see the
gotchas in `../creator-partner-outreach.md`).

Optional first check: does SabrTrader already have an account with us?

```bash
sudo sqlite3 /var/lib/zerogex/auth.db "SELECT email, tier, subscription_status, created_at FROM users WHERE email LIKE '%sabrtrader%' OR email LIKE '%tradedevils%';"
```

Then:

```bash
cd ~/zerogex-web
make grant-partner-pro EMAIL=<their-email> PROMO_CODE=SABRTRADER COMMISSION_BPS=0 DAYS=365 DRY_RUN=1
make grant-partner-pro EMAIL=<their-email> PROMO_CODE=SABRTRADER COMMISSION_BPS=0 DAYS=365 YES=1
```

- **Check the dry run's coupon:** it should say `ensure exists on Yg3BPJPx`,
  the 25%-off-first-year coupon (see the Brandon note,
  `2026-10-19-brandon-credit-spread-club-creator-partner.md`). If it says
  `21OUViRs`, stop.
- **`DAYS=365`, not the default 90.** When a partner's grant ends, the account
  drops to free and its API key is revoked (`expire-partner-grants.mjs`),
  which would break their connector testing partway through the
  relationship. Re-run with a new `DAYS` to extend.
- **The dry run prints any existing Stripe subscription.** If they already pay
  for Pro, decide whether to comp it first (`make comp-member`, see the
  Gabriela note, `2026-10-16-gabriela-cboe-data-creator-offer.md`) or leave
  their subscription alone and use the grant only for the link.
- **What to send them:** link `https://zerogex.io/register?ref=SabrTrader`
  (case doesn't matter), code `SABRTRADER`. The link is the one to publish.
  The typed code works at checkout only when no other discount applies.
- **Adding a commission later:** re-run the same command with
  `COMMISSION_BPS=3000` (the standard 30% for 12 months). It applies to
  invoices paid from then on, not back-dated.

### Other answers

- **They ask for a revenue share.** The standard creator deal is 30% of what
  each signup pays for their first 12 months. Offer it once the webinar or the
  link has sent real signups, not before.
- **They ask for one key for all their users,** or to show live levels to
  users without a ZeroGEX key: no. Each member needs their own Pro key. If
  they want more than that, it's a data license, priced separately.
- **Webinar prep.** Their walkthrough will show everything SabrTrader draws,
  including its own percentage bars (the Jim note). Ask to see the outline,
  or join, so our levels are described the way `/methodology` describes them:
  a model of positioning, not a measurement of dealer inventory.

## Done on our side (Oct 30, branch `claude/sabrtrader-article-mentions`)

This is what the reply's "I'll add that, with SabrTrader in the list" refers to.

- `/education/best-gex-tools`, all five locales: a "Levels on your own
  charts" bullet in "What ZeroGEX brings", after the MCP server. It lists the
  TradingView and thinkorswim scripts (free, updated by hand), the
  NinjaTrader 8 and Sierra Chart indicators (auto-updating on Pro), and
  SabrTrader (built into its paid plans, runs on a Pro key). It stays in
  ZeroGEX's own section, not the buckets.
- `/education/zerogex-vs-menthorq`: "works with four" is now five, with
  SabrTrader, "which draws MenthorQ's levels too". SabrTrader's Gamma Levels
  page: "MenthorQ connects the same way, and its Q-Levels draw with the Menthor
  Q-Levels indicator." The "Levels where you already chart" bullet under
  "Where ZeroGEX is the stronger choice" stays at four: SabrTrader isn't an
  edge over MenthorQ.
- `/education/zerogex-vs-spotgamma` had the same "works with four" line, now
  five. SabrTrader doesn't list SpotGamma as a provider, so no note there.
- `dateModified` moved to 2026-10-30 on all three in `core/articleRegistry.ts`.
