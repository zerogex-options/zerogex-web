# Sam (SabrTrader): free license, yes to the 25% offer, webinar next Wednesday (2026-11-05)

Sam Eells, "Co Founder | Partner" at SabrTrader, joined the Erwin thread
(`2026-10-29-erwin-sabrtrader-partnership.md`), to support@ and Erwin. Read
Wed Nov 4, evening ET:

> We are happy to offer you a free license to Sabrtrader. You can download the
> full "ultimate version" directly from our website: https://sabrtrader.com
>
> You will need to add a data feed. We connect with 68 different brokers
> and/or data providers so plenty to choose from.
>
> We will add the links and the specifics of how to connect to ZeroGEX for
> you. And like the sound of the 25% discount to offer as a call to action for
> a webinar.
>
> If we can get all posted this week, we could schedule a webinar for next
> Wednesday.

> **Status:** the link went live Wed Nov 4 at 11:23 PM ET (Nov 5, 04:23 UTC).
> `SABRTRADER` is on `tradedevils@gmail.com` (`user_3b8efe97733109d68ac42520`),
> SabrTrader's team account (their site says it's built by the TradeDevils
> team). Stripe promotion code `promo_1UYICy4AOiqteMYY1QppkhW5` on `Yg3BPJPx`,
> partner grant to 2027-11-05. That account already pays for Pro
> (`sub_1TxQEI4AOiqteMYYlFwmMH0G`, active; registered Jul 26), so the reply
> below no longer has the "I've also put Pro" paragraph. Sent. Sam's second
> reply and a check of their new ZeroGEX page are at the end.

## What he's saying

Each line answers part of Michael's Oct 29 reply to Erwin.

- **"Free license ... ultimate version":** yes to the free license Michael
  accepted. Ultimate is their $115/mo plan. Windows only.
- **"You will need to add a data feed":** SabrTrader doesn't include price
  data. The chart runs on the user's own broker or data feed (our
  `/integrations` page says the same). Our levels arrive through the ZeroGEX
  connection, but there's no chart to draw them on without a feed.
- **"We will add the links and the specifics of how to connect":** yes to
  Michael's ask that their Gamma Levels page and FAQ link to us. They want the
  link to use and the steps to post.
- **"Like the sound of the 25% discount":** yes to the SabrTrader link (25%
  off the first year), as the webinar's call to action. It doesn't exist yet.
- **"If we can get all posted this week ... next Wednesday":** the webinar
  waits on the link and steps being live. If sent this week, next Wednesday
  is Nov 11, so they'd want the link by about Fri Nov 6.

Not answered from Oct 29: webinar attendance, whether the recording goes on
YouTube, a technical contact for the connector. None blocks the webinar.

## Setup before replying

The link only works once `SABRTRADER` is attached to a ZeroGEX account with
`partner_tier='creator'` (`findCreatorByReferralCode` in
`frontend/core/creatorPartners.ts`), so it needs an account on their side.
They built the connector, so they likely have one already:

```bash
sudo sqlite3 /var/lib/zerogex/auth.db "SELECT email, tier, subscription_status, created_at FROM users WHERE email LIKE '%sabrtrader%' OR email LIKE '%tradedevils%';"
```

If it finds one:

```bash
cd ~/zerogex-web && make grant-partner-pro EMAIL=<their-email> PROMO_CODE=SABRTRADER COMMISSION_BPS=0 DAYS=365 DRY_RUN=1
```

```bash
cd ~/zerogex-web && make grant-partner-pro EMAIL=<their-email> PROMO_CODE=SABRTRADER COMMISSION_BPS=0 DAYS=365 YES=1
```

- **The dry run must say `ensure exists on Yg3BPJPx`** (25% off for 12
  months). If it says `21OUViRs`, stop.
- **If the dry run shows `stripe_sub=... status=active`,** they already pay
  for Pro. Apply anyway: the link works either way, and the grant expiry
  skips paying accounts (`expire-partner-grants.mjs`). Cut the "I've also put
  Pro on your team's account" paragraph from the reply. Comping their
  subscription is optional and can wait (`make comp-member`, see the Gabriela
  note).
- `DAYS=365`, `COMMISSION_BPS=0`: same reasons as the Oct 29 note.

## Draft reply

Same thread. Each paragraph is one line so it pastes straight into a mail
client. Change the Wednesday line if that day doesn't work.

```
Hi Sam,

Thanks for jumping in, and for the license. I'll download it and get it set up. Two quick questions: do I need a license key, or does Ultimate unlock when I sign in? And which data feed would you suggest for a quick setup, ideally a free or demo one with ES and NQ?

The 25% offer is ready. Here's what to post:

Link: https://zerogex.io/register?ref=SabrTrader
Code: SABRTRADER

Anyone who signs up through the link gets 25% off their first year of ZeroGEX, on any plan. The link is the one to post. The code is for anyone who'd rather type it in at checkout.

To connect ZeroGEX in SabrTrader:
1. Sign up for ZeroGEX Pro through the link above. The SabrTrader connection needs a Pro API key.
2. In ZeroGEX, go to Account → API Access, click Generate API Key, and copy the key right away. It's only shown once.
3. In SabrTrader, go to Connections → Levels, add ZeroGEX, and paste the key.

Anyone who already has a ZeroGEX key, say for NinjaTrader, should paste that same key. Generating a new one switches off the old one everywhere it's used.

As promised, SabrTrader is now in our GEX tools article too: https://zerogex.io/education/best-gex-tools

Next Wednesday works for me. What time are you thinking, and would you like me on the call to take questions about the levels?

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

## Facts behind the draft (checked Nov 5)

- The GEX tools article names SabrTrader on the live site (commit `4501b61`).
- The steps match `/help/platform/api-access`: Account → API Access, Generate
  API Key, shown once, one active key per account.
- `?ref=` is uppercased before the lookup, so `?ref=SabrTrader` works.

## Later

- **Webinar prep:** ask for the outline, or join, so the levels are described
  the way `/methodology` describes them (see the Oct 29 note).
- **After the webinar:** `make partners SIGNUPS=1` shows what the link brought
  in. That's the time to consider a commission, not before.
- **If Michael comps their Pro later:** run `make comp-member` first, then
  re-run the grant. The grant alone doesn't survive their subscription
  ending: `markSubscriptionEnded` (`frontend/core/billingUser.ts`) sets
  `tier='public'` whatever the grant says (same as the Gabriela note).

## Sam's second reply (shared Thu Nov 5)

> Thanks for the setup on your end and the 25% code is a excellent touch.
>
> Yes, the Ultimate version will unlock when you log in.
>
> For a look at Sabrtrader with real time data. I'd suggest the trial from
> IQFeed or the trial from Rithmic.

- **License:** no key. Ultimate unlocks on login, presumably with the address
  they've been writing to.
- **Feed: Rithmic over IQFeed.** Their ZeroGEX page says the chart's
  wall-defense labels (stacking, defended, cracking, broken) need a feed with
  order-book depth, "such as Rithmic or Databento". Rithmic is futures-only,
  which is all ES and NQ need.
- **Webinar time:** still unanswered.

### Their ZeroGEX page (checked Nov 5, 17:16 UTC)

<https://www.sabrtrader.com/pages/zerogex>, an "Integration partner" page,
listed under Partners in their nav next to gexbot, MenthorQ and
quantedOptions. Their Gamma Levels page and homepage link to it.

- **No partner link.** Every "get your key" link goes to plain
  `https://zerogex.io` (5 links), plus `/help/platform/api-access` and
  `/integrations`. No `?ref=SabrTrader`, no `SABRTRADER`, and no 25% in the
  visible text, so signups from it get no discount and no attribution.
- **Doesn't say Pro.** "You need your own ZeroGEX subscription for the key."
  A Basic buyer gets no key (`/help/platform/api-access`).
- **The rest is accurate.** The steps match ours (they say "account → API";
  ours is Account → API Access), and "ZeroGEX covers SPX, SPY, QQQ and NDX"
  matches our help pages. The hold-rate, the regime badge and wall defense
  are SabrTrader's own features.

To re-check once they say it's changed:

```bash
curl -s https://www.sabrtrader.com/pages/zerogex | grep -o 'href="[^"]*zerogex.io[^"]*"' | sort | uniq -c
```

### Reply

Same thread, one line per paragraph. Best sent before the webinar, so
viewers who visit their page get the discount.

```
Hi Sam,

Thanks, glad the code helps. I'll grab the Rithmic trial and take a look.

I just saw your new ZeroGEX page, and it looks great. Two small changes would help:

1. Could the zerogex.io links, especially the "Get your ZeroGEX API key" and "Visit zerogex.io" buttons, point to https://zerogex.io/register?ref=SabrTrader instead? Anyone who signs up through that link gets 25% off their first year automatically, so it's worth a mention on the page too. It's also how we'll both see what the page brings in.

2. The API key comes with ZeroGEX Pro. Where the page says you need your own ZeroGEX subscription, could it say Pro? Otherwise someone could buy Basic and find no key.

Are we still on for next Wednesday? What time are you thinking, and would you like me on the call to take questions about the levels?

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```
