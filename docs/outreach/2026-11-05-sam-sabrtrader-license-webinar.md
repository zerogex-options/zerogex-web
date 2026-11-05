# Sam (SabrTrader): free license, yes to the 25% offer, webinar next Wednesday (2026-11-05)

Sam Eells, "Co Founder | Partner" at SabrTrader, joined the Erwin thread
(`2026-10-29-erwin-sabrtrader-partnership.md`), to support@ and Erwin. Read
Thu Nov 5:

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

If it finds nothing, send the reply with the alternate paragraph below, then
run the two commands once they send an email.

## Draft reply

Same thread. Each paragraph is one line so it pastes straight into a mail
client. Fill in their email. Change the Wednesday line if that day doesn't
work.

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

I've also put Pro on your team's ZeroGEX account ([their email]) free for the next year, so you can keep testing the connector and run the webinar on live levels.

As promised, SabrTrader is now in our GEX tools article too: https://zerogex.io/education/best-gex-tools

Next Wednesday works for me. What time are you thinking, and would you like me on the call to take questions about the levels?

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

### If they have no ZeroGEX account

Replace everything from "The 25% offer is ready" through the "I've also put
Pro" paragraph with:

```
For the 25% offer, I'll attach the link to your team's ZeroGEX account, and that account gets Pro free for a year so you can test the connector and run the webinar on live levels. Could you sign up at https://zerogex.io/register with the email you'd like to use and send it to me? I'll switch it on the same day and send you the link, the code, and the setup steps to post.
```

Once they answer, run the two commands above and send the link, code, and
steps blocks from the main draft.

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
