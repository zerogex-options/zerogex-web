# Matt (matt@tiresiastrading.com): a creator Michael follows canceled Pro (2026-10-16)

A Pro member canceled on Friday afternoon. He is a trading content creator
Michael follows, with no prior contact between them. This is the read, a
first founder email, and the commands for when he says yes.

Everything below is from `make diagnose-user` (run 2026-10-16). A web search
for Tiresias Trading turned up nothing, so the read is from the account alone.

| | |
|---|---|
| User id | `user_19c145862bfef124ac864659` |
| Came from | organic/direct. Registered Tue Sep 1; Pro monthly 7-day trial started Fri Sep 11 |
| Paid | **$59 once**, Sep 18 (trial conversion, list price, no discount) |
| Canceled | Fri Oct 16, 1:52 PM ET, **outside the app** (see below). No reason recorded |
| Access | until **Sun Oct 18, 9:53 AM ET** (`sub_1UEUtD4AOiqteMYYx4RbaQIN`, cancel at period end). Friday was his last session with access |
| API key | none ever generated, so no NinjaTrader, Sierra or API use |
| Stripe customer | `cus_VEypqul48RbWGY` |

## The read

- **We don't know why he left, and he was never asked in the app.** The in-app
  cancel (`/api/billing/cancel-flow`) always writes `billing_cancel_flow_submitted`,
  and his history has none. So he canceled from Stripe's billing page, and never
  saw the survey, the 25%-off save or the pause. The automated ack email is the
  only "why?" he got.
- **One paid month, light visible footprint.** Visits on record: Sep 1
  (register), Sep 11 (checkout), Sep 14 (terms), Oct 16 (cancel). Sessions don't
  log page views, so real usage is unknown.
- **Reach out: ask why, and offer the creator program's free Pro.** That is
  stage 1 of `creator-partner-outreach.md` adapted to a canceled member.
- **Hold the commission pitch.** He just decided Pro wasn't worth $59 a month to
  him. Asking him to sell it to his audience before knowing why reads as wanting
  his audience, not his opinion. The playbook says the same: pitch only after a
  positive signal (stage 7), then send
  `../creator-partner-assets/commission-examples.png` with it.

## Draft

**Subject:** a quick question from ZeroGEX's founder

```
Hi Matt,

I'm Michael, the founder of ZeroGEX. I saw you canceled today, and since I follow your content, I wanted to write to you myself.

Would you tell me why? One honest sentence is plenty, and blunt is fine. Your answer would genuinely help me.

I'd also like to give you Pro free for the next 90 days, so you can give it a proper run without paying. No posting and no strings, just tell me what's useful and what's missing. If you'd like that, reply "yes" and I'll switch it on.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

If you can name one post or video of his you liked, add it to the first
paragraph. It's the strongest line in the email.

## If he says yes

Same trap as Gabriela's: while his paid month is still running, a bare
`grant-partner-pro` is wiped out when the subscription ends on Sunday
(`customer.subscription.deleted` resets the tier to `public`).

**Before Sun Oct 18, 9:53 AM ET:** end the paid sub first, then grant. No
`REFUND`: he has had the month he paid for.

```bash
cd ~/zerogex-web
make comp-member EMAIL=matt@tiresiastrading.com DRY_RUN=1
make comp-member EMAIL=matt@tiresiastrading.com YES=1
make grant-partner-pro EMAIL=matt@tiresiastrading.com PROMO_CODE=TIRESIAS25 DRY_RUN=1
make grant-partner-pro EMAIL=matt@tiresiastrading.com PROMO_CODE=TIRESIAS25 YES=1
```

**After that:** his subscription has ended on its own, so run only the two
`grant-partner-pro` lines.

- `TIRESIAS25` follows the house pattern (brand plus 25). Use his handle
  instead if he's better known by it, and add `X_HANDLE=<handle>` if he's on X.
- Then send the stage 5 activation DM from `creator-partner-outreach.md` (the
  deferred-affiliate version), with the expiry date the grant prints.

## If he replies otherwise

- **He gives a reason and no yes.** Answer the reason; don't pitch. If it's a
  missing symbol or data source, add it to the request list alongside Pete's,
  Alexandru's and Gabriela's. No dates.
- **He says something positive later** (uses it, praises a feature, mentions it
  publicly): that's the stage 7 trigger. Pitch the commission with the image.
- **No reply.** Nothing to do. Access ends Sunday on its own.

## Worth a look later (not urgent)

**Stripe's billing page still lets members cancel.** `setup-billing-portal.mts`
turns portal cancels off on purpose, so every cancel goes through the in-app
survey and save offers (32 of 59 paid cancels in the 90 days to Oct 1 went
through the portal, and 1 left a reason). Matt's cancel shows the live portal
still allows it. Check the "cancel subscriptions" switch in Stripe's customer
portal settings, and whether `STRIPE_PORTAL_CONFIG_ID` is set in
`frontend/.env.local` (when it's blank, Stripe's default portal settings apply).
