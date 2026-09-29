# Three cancels, Monday night to Tuesday morning: Narsing, Abdullah, kfee (2026-09-29)

Three members canceled between Monday 10:01 PM and Tuesday 9:33 AM ET. Two are
paying Pro members on the old $29 promo. Both canceled in the Stripe billing
portal, gave no reason, and keep Pro until their period ends. The third paid
$49 on Sunday. They canceled Tuesday morning with "Too complex / hard to use",
then took the full money-back refund.

This is the read and three short 1:1 founder drafts, sent from your own inbox,
one line per paragraph so they paste straight into a mail client.

Everything below is from `make diagnose-user` on each address (run 2026-09-29).

| | **abdullah.safi.888@gmail.com** | **narsingbidar@gmail.com** | **kfee@msn.com** |
|---|---|---|---|
| User id | `user_8604d875915d0562d3ec88a0` | `user_1e8402cfc9278625785203e3` | `user_71786ad8188a46f08e7c22a6` |
| Came from | chatgpt.com | X | direct |
| Plan | Pro monthly, $59 less $30 for 6 months = **$29** | same | Pro monthly, **$49** (October promo), paid up front under the 7-day money-back guarantee |
| Paid so far | $29 on Tue Sep 1, after two bank declines | $29 on Sun Sep 6 | $49 on Sun Sep 27, **refunded in full** Tue Sep 29 |
| Canceled | Tue Sep 29, 3:26 AM ET, Stripe portal, a minute after signing in | Mon Sep 28, 10:01 PM ET, Stripe portal, under two minutes after signing in | Tue Sep 29, 9:32 AM ET, in-app; refund 24 seconds later |
| Reason | none given | none given | Too complex / hard to use, nothing typed |
| Access | until **Wed Sep 30, 2:06 PM ET** | until **Tue Oct 6, 12:14 PM ET** | ended with the refund |
| API key | one, made Sep 1 (`abdullah.safi.888-1`) | none | none |
| Paying with | Visa ending 9250 | Link | Link |

**Send order:** Abdullah today, because the switch-back offer in the draft only
works until Wednesday 2:06 PM ET. Narsing any time this week. kfee tomorrow or
later: there's no deadline, and two automated emails reached them this morning.

**Sent 2026-09-29:** Abdullah and Narsing. kfee's draft below is Michael's
revised version, which adds the other ticker pages, the education library and
an open offer of a promo rate.

## The read

**Abdullah: worth sending today.**

- Found ZeroGEX through ChatGPT on Mon Aug 24 and started the Pro trial the same
  afternoon, on the $29 promo.
- Their bank declined the first charge on Aug 31 (`transaction_not_allowed`,
  the refusal banks often give foreign recurring charges), and again the next
  morning. That afternoon they re-entered the same Visa and paid the invoice
  themselves. They wanted it enough to fight their bank for it.
- Made their first API key on Sep 1, while the payment was still failing. That
  sign-in came from what looks like a hosting company's address (a VPS or VPN),
  not the phone network they used on Sep 2 and Sep 4. So they may have wired the
  API into something running on a server.
- The Sep 2 and Sep 4 sign-ins look like a Saudi mobile network. If so, they
  are seven hours ahead of New York, and their access ends at 9:06 PM their time
  on Wednesday.
- Canceled a day before the Sep 30 renewal, in the Stripe portal rather than the
  in-app window, so no reason was recorded. They did get the ack email with its
  25%-off link, and haven't used it.
- No discount in the draft. Price isn't known to be the reason, and they're
  already paying $29. The useful offer is the switch-back: same $29, same API
  key. After Wednesday 2:06 PM ET it's gone. Coming back after that means paying
  the current price and making a new API key.

**Narsing: worth sending this week.**

- Came from X on Fri Aug 28. Started the Pro trial on Sun Aug 30, after the
  "verified but never paid" nudge, and paid $29 when it converted on Sep 6.
- The only sign-ins on record are Aug 30 and Monday night. Sessions last 14 days
  and extend with use, so having to sign in again means that browser hadn't been
  used for at least two weeks. They may have used another device, but nothing
  says so. No API key.
- Signed in and canceled in the Stripe portal under two minutes later: a trip
  made to cancel. No reason.
- The likeliest reason is "wasn't using it". That's a guess, so the draft asks
  rather than assumes, and lists it as one of three options. Don't mention how
  rarely they signed in; it reads as watching them.

**kfee: worth sending, for what you'll learn rather than a save.**

- Signed up Sun Sep 27 at 9:22 AM ET and paid $49 two minutes later. Since the
  October pricing there's no Pro trial; it's paid up front under the guarantee.
- The first thing they saw was an error. Outlook's link scanner opened their
  verification link 0.2 seconds before their own click did, which used it up.
  Their click landed on the pricing page reading "That verification link is no
  longer valid." The scanner had in fact verified the account, and kfee
  started checkout 22 seconds later anyway. It's not why they left, but it's a bad
  first minute (see the end of this note).
- In the app Sunday morning (first-run welcome at 10:00 AM ET). Monday's visits,
  if any, don't show, because page views don't write audit rows.
- Tuesday at 9:32 AM ET, two minutes after the open, they canceled in-app with
  "Too complex / hard to use" and typed nothing. 24 seconds later they took the
  full $49 refund from the Account page. Pro ended at once.
- Two automated emails went to them this morning, and both ask why. The
  cancel ack said they keep full access until October 27 and offered 25% off;
  both stopped being true 24 seconds later. The refund confirmation then said
  access has ended. kfee has already answered the question, so the draft doesn't
  ask why again. It asks which part was too complex.
- No discount: they've been refunded, and price isn't the complaint. The one
  thing worth giving them is the simplest form of the product, which is free:
  the SPX levels page, delayed about 15 minutes, no account needed.

## Verify first

- **Re-run `make diagnose-user` on each address right before sending.** If
  `Cancel at period end` has flipped to `no` for Abdullah or Narsing, they
  switched it back on themselves. Send nothing, or a thank-you.
- **Names.** "Abdullah" and "Narsing" are read off the email addresses. Check the
  name on the Stripe customer (`cus_V8IrAyOB1I94Sz`, `cus_VAWPcdCCEXPNv7`) before
  sending. kfee's draft opens with "Hi,"; add a first name if `cus_VKxzQZNRwoNi1E`
  has one.
- **The access lines are dated.** Cut Abdullah's after Wed Sep 30, 2:06 PM ET,
  and Narsing's after Tue Oct 6, 12:14 PM ET.
- **Optional, Abdullah:** whether the API key was actually used. Run
  `make api-keys-list USER=user_8604d875915d0562d3ec88a0` from the zerogex-oa
  checkout and read `last_used_at`. It doesn't change the draft. It tells you
  whether you're losing an active API user or one who never got it connected.

## Draft: Abdullah

**Subject:** One question about your cancellation

Hi Abdullah,

I saw you canceled your ZeroGEX subscription. Thanks for sticking with it through the trouble with your bank at the start.

Would you tell me what made you cancel? The data, the price, or something else? One line is plenty.

Your access runs until Wednesday, September 30. If you'd like to keep it, reply before then and I'll switch it back on: same $29 a month, same API key, nothing to set up again.

Best,
Michael
Founder, ZeroGEX

## Draft: Narsing

**Subject:** One question about your cancellation

Hi Narsing,

I saw you canceled your ZeroGEX subscription, and I'd like to know what didn't work for you.

Was it the price, the product itself, or just not having the time to use it? One line is plenty.

Your Pro access stays on until October 6 either way. If you change your mind before then, reply and I'll switch it back on at the same $29 a month.

Best,
Michael
Founder, ZeroGEX

## Draft: kfee

**Subject:** "Too complex": which part?

*Revised 2026-09-29 by Michael: adds the name from Stripe, the other ticker
pages, the education library and an open offer of a promo rate.*

Hi Kenneth,

Thanks for telling me why you canceled. Your $49 refund has gone through, and it usually shows up within 5 to 10 business days.

You picked "too complex / hard to use," and I'd like to understand why. Was it the underlying ideas (gamma, the flip, the walls), the amount of information on the screen, or knowing what action to take? One word back is enough.

If you'd like the simplest version in the meantime, this free page shows the day's key SPX levels, delayed about 15 minutes, with no account needed:
https://zerogex.io/spx-gamma-levels

There are matching pages for SPY, QQQ, NDX, ES and NQ. We also have a library of articles and platform guides here:
https://zerogex.io/education

If you ever want to give ZeroGEX another try, let me know and I'll set you up with a promo rate.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If they reply

- **Abdullah or Narsing wants to keep it, before their access ends.** Dry run
  first, then apply:

  ```bash
  make set-cancellation EMAIL=abdullah.safi.888@gmail.com OFF=1 DRY_RUN=1
  make set-cancellation EMAIL=abdullah.safi.888@gmail.com OFF=1 YES=1
  ```

  For Narsing, use the same two lines with `narsingbidar@gmail.com`. This turns
  the cancel off and leaves everything else as it is: the $30-off coupon, and
  Abdullah's API key. It sends no email, so reply to confirm the next charge:
  $29 on Wednesday for Abdullah, $29 on October 6 for Narsing.
- **Abdullah's renewal goes to the Visa ending 9250,** the card their bank
  blocked in August. If it's declined again, they get the payment-failed email
  and keep Pro through a 3-day grace while they sort it out with the bank. Say
  so in one line when you confirm, so it doesn't surprise them.
- **Either replies after their access has ended.** Switching back no longer
  works. The subscription is gone, and the $29 promo with it. Abdullah's API key
  is revoked, so they'd need a new one. They come back through the pricing page,
  paid up front. To give them a discount anyway, use the after-lapse path in
  the "If they reply" section of `2026-09-25-trial-cancels-oliver-chenyu.md`
  (the win-back stamp plus `/pricing?winback=1`).
- **kfee says which part.** Nothing to set up. Read it.
- **kfee takes up the promo rate.** They've used their one money-back refund,
  so tell them the next payment has no guarantee before they pay. The account
  is already marked lapsed, so stamping the win-back and sending the win-back
  link makes checkout apply the standing win-back coupon:

  ```bash
  sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'kfee@msn.com';"
  ```

  Then send them https://zerogex.io/pricing?winback=1. If
  `STRIPE_COUPON_WINBACK_PRO_MONTHLY` isn't set in `frontend/.env.local`,
  checkout falls back to the public promo while it runs (through October 1),
  then to full price. The stamp also stops the win-back email below from
  offering it a second time.
- **kfee doesn't reply.** The win-back email covers the promo line on its own.
  kfee becomes eligible 30 days after the refund, so they first appear in the
  Monday win-back digest on November 2. It goes out when you send from that
  digest.

## Worth fixing later (not urgent)

**1. Outlook's link scanner uses up the verification link.** At kfee's signup, a
Microsoft address (`2a01:111:f400:…`, Outlook's Safe Links) opened the link
0.2 seconds before kfee did. That spent the one-time token, and kfee's own click
landed on "That verification link is no longer valid. Use Resend below to get a
new one." The account was actually verified. Any Outlook, Hotmail, MSN or Live
signup whose mail gets scanned will see the same thing.
`consumeEmailVerification` in `frontend/core/serverAuth.ts` returns `invalid`
for an already-used token on purpose. For an account that is verified, it
should land on the "verified" banner instead. The one-click save link
(`frontend/app/save/route.ts`) already guards against these scanners.

**2. Cancel, then refund, sends two emails that disagree.** The cancel window
never mentions the money-back guarantee. So an eligible member cancels first,
gets the ack email ("you still have full access until October 27", plus 25%
off), then finds the refund panel on the Account page and gets "your paid access
has ended". kfee got both, 24 seconds apart. Offering the refund inside the
cancel window, to members still inside their 7 days, would put them in the
right order.

**3. Two of these three gave no reason because they canceled in the Stripe
portal.** To see whether the portal asks for a reason, run
`make enable-portal-cancel-reasons DRY_RUN=1`, which only reads. If it prints
`disabled`, `YES=1` turns it on. That changes the live customer portal.
