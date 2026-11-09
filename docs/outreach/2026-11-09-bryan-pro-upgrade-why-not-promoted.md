# Bryan: staying and moving to Pro, asks why ZeroGEX isn't promoted more (2026-11-09)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Bryan B, 7:00 PM, replying to his cancellation email ("Sorry to
see you go", the subject without "mind sharing why?", so he gave a reason or a
comment when he canceled). He has changed his mind, says he's going to upgrade
to Pro monthly, loves ZeroGEX, and asks why it isn't promoted more.

> **Status:** not sent, nothing applied. I couldn't see his account from here
> (no access to the server or Stripe), and the screenshot doesn't show his
> email address. Copy it from the thread and use it wherever this note says
> `BRYAN_EMAIL`.

## The read

- **Help him out with the 25% his cancellation email already offered, on Pro.**
  That's $44.25 a month instead of $59 for 12 months, then $59. It costs you
  $14.75 a month, about $177 over the year, from someone who had decided to
  pay full price. It's worth it here: it's the offer he was already shown, he
  didn't ask for it, and he's the kind of member who tells other traders. Same
  tool and coupon as Alexander on Nov 3
  (`docs/outreach/2026-11-03-alexander-pro-25-off.md`).
- **If the button in that email (quoted below his reply) says 50%, not 25%,**
  he picked "Too expensive" when he canceled. 25% is still a fair thank-you,
  since he isn't asking about price any more. The draft says 25%.
- **The referral program answers his question and helps him at the same time.**
  His Account page has a Refer a friend panel with his own link. A friend gets
  a month free on monthly or quarterly (10% off the first year on annual), and
  he gets one free month per friend who subscribes, as a credit on his next
  bill. On Pro monthly that's $59 each, and they stack (`frontend/core/referrals.ts`,
  `frontend/app/account/page.i18n.ts`). The program was live on Oct 9 (Rod's
  referral month), but check it's still on before sending, below.
- **Ask to quote him.** "I think ZeroGEX is an incredible tool" is a ready-made
  testimonial, and the site has none yet. First name only. One line in the
  draft; delete it if you'd rather not ask.
- **The honest answer to "why isn't it promoted more" is the right one.** One
  person builds it, runs it and answers support, so promotion has taken a back
  seat. The draft says that plainly and makes no claims about where members
  come from or what's planned.

## Commands

In `~/zerogex-web` on the server.

0. Referral program still on (the draft's referral paragraph depends on it):

   ```bash
   grep '^REFERRAL_PROGRAM_ENABLED=' frontend/.env.local
   ```

   Must print `REFERRAL_PROGRAM_ENABLED=1`. If it doesn't, delete the paragraph
   that starts "If you'd like to help spread the word".

1. See where his account stands (read-only):

   ```bash
   make diagnose-user EMAIL=BRYAN_EMAIL
   ```

   Read the plan, the subscription status, and whether a cancel is still
   scheduled. That picks one of the three cases below, and which version of the
   draft's second paragraph to send.

### Case A: he's already on Pro monthly (he upgraded himself)

```bash
make honor-winback-discount EMAIL=BRYAN_EMAIL PERCENT=25 CREATE_COUPON=1 DRY_RUN=1
make honor-winback-discount EMAIL=BRYAN_EMAIL PERCENT=25 CREATE_COUPON=1 YES=1
```

In the preview, check `Stripe: LIVE mode`, `Plan: pro/monthly — list 59.00
USD`, and `Coupon to apply: winback-25pct-1yr-monthly (25% off, 12 mo)`. If
`Current discounts` isn't `none`, the 25% stacks on top of it and the next
charge will be lower than $44.25. The real run's last line should read `Next
charge (after all discounts): 44.25 USD.` If it shows another amount, change
the number in the draft to match. Send **version A**.

### Case B: he's still on Basic, and the subscription is still live

Same two commands as Case A. The plan line will say `basic/monthly — list
39.00 USD`, and the last line should read `Next charge (after all discounts):
29.25 USD.` It also turns off his scheduled cancel, so the subscription renews
normally. Send **version B**, which tells him how to switch to Pro himself.

The pricing page's "Switch to Pro" button works whether he's paying or still
in a trial: a paid plan goes on to the Stripe portal, a trial switches in the
app (`decidePlanSwitch`, `frontend/core/planSwitch.ts`). The win-back coupon is one the app never strips
on a plan switch (`reconcileSwitchDiscounts`, same file), so it should come
across to Pro. Once he's switched, run `make diagnose-user EMAIL=BRYAN_EMAIL`
again and check the discount is still there. If it isn't, re-run the Case A
commands. The script replaces an earlier win-back coupon rather than stacking a
second one, so a re-run is safe.

### Case C: no live subscription (it has already ended)

Alexander's path, word for word:

```bash
make reactivate-member EMAIL=BRYAN_EMAIL TIER=pro CADENCE=monthly DAYS=3 DRY_RUN=1
make reactivate-member EMAIL=BRYAN_EMAIL TIER=pro CADENCE=monthly DAYS=3 YES=1
make honor-winback-discount EMAIL=BRYAN_EMAIL PERCENT=25 CREATE_COUPON=1 DRY_RUN=1
make honor-winback-discount EMAIL=BRYAN_EMAIL PERCENT=25 CREATE_COUPON=1 YES=1
```

The reactivate preview shows `Card:` (brand and last four, for the draft) and
`Trial: 3 days, ending …`. The real run should end with `Webhook landed:
tier=pro, status=trialing, lapsed=no.` and the discount's last line with `Next
charge (after all discounts): 44.25 USD.` If the preview shows no card on
file, stop: this path can't work, and he'll need to upgrade from the pricing
page himself. Send **version C**, with "free through" set to the day before
the trial's end date, as in Alexander's draft.

## Draft reply

Reply in the same thread. Pick one version of the second paragraph and delete
the other two.

Hi Bryan,

Thank you, that's really kind of you, and I'm glad you're staying. It means a lot to hear ZeroGEX has everything you need.

**[Version A, already on Pro]** As a thank-you, I've taken 25% off your Pro subscription for the next 12 months, so it's $44.25 a month instead of $59. It's already applied, so there's nothing you need to do.

**[Version B, still on Basic]** As a thank-you, I've added 25% off your subscription for the next 12 months and turned off the cancellation, so your account carries on as normal. To move to Pro, go to the Pricing page, pick Monthly, and click Switch to Pro. The 25% comes with you, so Pro is $44.25 a month instead of $59, and Stripe shows you the exact amount before you confirm.

**[Version C, subscription had ended]** As a thank-you, I've set you up on Pro at 25% off for the next 12 months. It's already on your account and free through [WEEKDAY, MONTH DAY]. After that it's $44.25 a month instead of $59, on your [CARD BRAND] ending in [LAST 4]. There's no checkout and no card to enter: just log in and the Pro pages are open.

To answer your question honestly: ZeroGEX is a one-man shop. I build the platform, keep the data running, and answer every email myself, and so far nearly all of my time has gone into making the product as good as I can. Sales and promotion have taken a back seat, and that's something I want to change.

If you'd like to help spread the word, your Account page has a Refer a friend panel with your own link. Anyone who signs up through it gets a month free on a monthly or quarterly plan, and every time one of them subscribes, you get a free month, credited to your next bill. The free months stack.

And one small ask: would you mind if I quoted your line about ZeroGEX being an incredible tool, with your first name only? A few words from a real member go further than anything I could write myself.

If you'd like pointers on getting the most out of Pro, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX

## Worth knowing

- **If he says he runs a trading group or posts about trading,** the creator
  partner program fits better than refer-a-friend: 30% of what each referred
  member pays for 12 months, and 25% off the first year for his audience
  (`docs/creator-partner-outreach.md`, `make grant-partner-pro`). Nothing in
  his email suggests that, so the draft doesn't raise it.
- **If he agrees to be quoted,** save his reply. The site has no testimonials
  section yet, so there's nothing to update today. That can wait.
