# Two cancels a minute apart, both about coverage: Pete and Alexandru (2026-10-06)

Two Pro members left on Tuesday morning, and the alerts arrived at 11:22 and
11:23 AM ET. Both say they like the product, and both are leaving over what it
covers.

- **Pete (kaspe67@gmail.com)** canceled at 11:12 AM. The survey said "Other" and
  they typed nothing. Eight minutes later they replied to the cancel ack email:
  "I loved your platform and I found it very useful. The only reason I'm
  canceling for now is because it's limited only to a few symbols."
- **rocadomenicalexandru@gmail.com** took the 7-day money-back refund ($49) from
  the Account page with reason `missing_features`, and wrote: "Really love the
  platform. I really appreciate that you consider some of my suggestions, such as
  adding NDX into the platform or a personalized Dashboard. Yet, the reason I'm
  leaving is because it lack"

This is the read and two short founder replies, sent from your own inbox.

Everything below is from `make diagnose-user` on each address (run 2026-10-06).

| | **kaspe67@gmail.com** (Pete) | **rocadomenicalexandru@gmail.com** |
|---|---|---|
| User id | `user_2b7e9dceb7d7038ec28f3f4e` | `user_c50de23e19a092ec025880f1` |
| Came from | organic/direct | organic/direct |
| Plan | Pro monthly, $59 less $30 for 6 months = **$29** (coupon `cNfEtdq0`) | Pro monthly, **$49**, paid up front under the 7-day guarantee |
| Paid so far | $29 on Aug 2, Sep 2 and Oct 2 (UTC) after a 7-day trial. **$87 total** | $49 on Wed Sep 30, **refunded in full** Tue Oct 6 |
| Canceled | Tue Oct 6, 11:12 AM ET, in-app. "Other", nothing typed | Tue Oct 6, 11:23 AM ET, self-serve refund on day 6 of 7, `missing_features` |
| Access | until **Sun Nov 1, 8:26 PM ET**. Last trading day is Fri Oct 30 | ended with the refund |
| API key | none | one, made Sep 30. **Revoked** by the refund |
| Paying with | Link | Mastercard ending 4473 |

## The read

- **Same complaint, two people, one morning.** It's two data points, not a
  trend. It's still the one thing worth asking both: which symbols, exactly.
  Today ZeroGEX covers SPX, SPY, QQQ and NDX, plus ES and NQ carried over from
  the index options. No single stocks, no IWM or RUT. Don't promise any. No
  roadmap note in either repo commits to new symbols (same line as the Benny
  note: "Don't promise it.").
- **Pete: worth saving, reply today.** Three paid months, and regular sign-ins
  through August and September from home and phone. They were on the site two
  minutes before canceling. They wrote back to the ack themselves, and they
  said "for now." There's no price complaint, they're already on $29, and they
  passed on the 25%-off link, so offer no discount. The useful things are: ask
  which symbols, say honestly there's no date, and keep the switch-back open
  until Nov 1. The $30-off coupon has three of its six months left, so a
  switch-back renews at $29 on Nov 2.
- **Alexandru: their message was cut off by our form, not by them.** It is
  exactly 200 characters long. The refund panel lets members type 500, but
  `sanitizeCancellationComment` in `frontend/core/cancellationReason.ts` keeps
  only the first 200. The audit rows show the same cut text, so the rest was
  dropped before it was stored anywhere. The real reason is in the part we lost.
  The reply owns that and asks them to finish the sentence.
- **Both things they asked for already exist.** NDX is in the symbol menu at the
  top of the dashboard, with NQ next to it. The personalized dashboard is **My
  Dashboard** (`/my-dashboard`, in the main menu for Basic and up): a board
  members build from widgets, saved to their account, which can split into two
  halves on different symbols or expirations. Both were on `release` before
  they joined on Sep 30. So the likely reading is "I'd appreciate it if you
  considered…", and they never found either one. The draft points to both
  without assuming, and asks what was missing if they did find them. (My first
  draft said the dashboard didn't exist. That was wrong.)
- **One member is not a pattern, but note it.** A paying Pro member spent six
  days on the product without finding two features they wanted. If the next
  replies say the same, it's a discoverability problem. For now it can wait.
- **They made an API key the evening they joined.** It was revoked by the
  refund. The draft doesn't mention it, so it doesn't read as watching them.
- **They weighed Basic first.** On Sep 30 they opened Pro checkout, then the
  Basic 7-day trial, then Pro again, and paid for Pro. Not for the email, but
  they chose to pay up front over a free trial.
- **No discount for Alexandru.** Price isn't the complaint and they've been
  refunded. The open offer of a promo rate is the same line you added to
  kfee's reply.

## Verify first

- **Alexandru's name.** "Alexandru" is read off the email address. Romanian
  names are often written surname first, so this person could be Domenic,
  Alexandru or Domenic-Alexandru. The diagnose output doesn't show a name, so
  check the Stripe customer (`cus_VM52xcDuTJRpHo`) or the name on the
  Mastercard. If it's unclear, open with "Hi,".
- **Did Alexandru write to you before?** Search your inbox for the address. Their
  audit history since signup has no feedback event, so any earlier suggestion
  came by email. If you already pointed them to NDX or My Dashboard, change the
  "if you couldn't find them" line to ask what was missing.
- **Pete, if you send after today:** re-run `make diagnose-user
  EMAIL=kaspe67@gmail.com`. If `Cancel at period end` has flipped to `no`, they
  switched it back on themselves, so send a thank-you instead.

## Draft: Pete

Reply in the same thread, so it lands under their message.

Hi Pete,

Thank you, that's kind of you to say, and it's exactly the kind of answer that helps me most.

Which symbols would you need? Even a short list is plenty. Right now ZeroGEX covers SPX, SPY, QQQ and NDX, plus ES and NQ, and you're not the only member who's asked for more.

I won't promise a date I can't keep. But the symbols members actually ask for go to the top of the list, and if I add yours, I'll email you myself.

Your access stays on until November 1 either way. If you change your mind before then, reply and I'll switch it back on at the same $29 a month, with nothing to set up again.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## Draft: Alexandru

**Subject:** Your refund, and the end of your sentence

Hi Alexandru,

Your $49 refund has gone through to your Mastercard ending 4473. It usually shows up within 5 to 10 business days.

Thank you for the kind words. One thing went wrong on my end: our form only kept the first 200 characters of your note, so it stops at "the reason I'm leaving is because it lack". I never saw the rest. Would you finish that sentence for me? It's the part I most want to read.

On your two suggestions: both are already in ZeroGEX, so if you couldn't find them, that's on me.

- NDX is in the symbol menu at the top of the dashboard, with NQ next to it.
- My Dashboard, in the main menu, is the personalized dashboard. You build your own board from the charts and panels, and you can split it to show two symbols side by side.

If you did find them and they weren't what you had in mind, tell me what was missing.

If ZeroGEX ever has what you need and you'd like to come back, let me know and I'll set you up with a promo rate.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If they reply

- **Pete names symbols.** Nothing to set up. Add them to whatever list you keep
  of symbol requests, along with Alexandru's if they name any.
- **Pete wants to keep it, before Nov 1.** Dry run first, then apply:

  ```bash
  make set-cancellation EMAIL=kaspe67@gmail.com OFF=1 DRY_RUN=1
  make set-cancellation EMAIL=kaspe67@gmail.com OFF=1 YES=1
  ```

  This turns the cancel off and keeps the $30-off coupon. It sends no email, so
  reply to confirm the next charge: $29 on November 1 (8:26 PM ET), through
  Link. The coupon covers three more renewals (November, December, January),
  then the price goes to $59. Say that in one line, so February doesn't
  surprise them.
- **Pete replies after Nov 1.** Switching back no longer works. The
  subscription is gone, and the $29 promo with it. They come back through the
  pricing page. To give them a discount anyway, use the after-lapse path in the
  "If they reply" section of `2026-09-25-trial-cancels-oliver-chenyu.md` (the
  win-back stamp plus `/pricing?winback=1`).
- **Alexandru finishes the sentence.** Read it. It's the real reason.
- **Alexandru takes up the promo rate.** They've used their one money-back
  refund, so tell them the next payment has no guarantee before they pay. Their
  API key was revoked, so they'd make a new one. The account is already marked
  lapsed, so stamping the win-back and sending the win-back link makes checkout
  apply the standing win-back coupon:

  ```bash
  sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'rocadomenicalexandru@gmail.com';"
  ```

  Then send them https://zerogex.io/pricing?winback=1. If
  `STRIPE_COUPON_WINBACK_PRO_MONTHLY` isn't set in `frontend/.env.local`,
  checkout falls back to the public promo if one is running, otherwise full
  price. The stamp also stops the win-back email from
  offering it a second time.
- **Alexandru doesn't reply.** The win-back email covers the promo line on its
  own. They become eligible 30 days after the refund, so they first appear in
  the Monday win-back digest on November 9.

## Worth fixing later (not urgent)

**1. The cancel and refund forms let members type 500 characters, but keep
only 200.** Both `MoneyBackGuaranteePanel.tsx` and `CancelRetentionModal.tsx`
set `maxLength={500}`. The server's `MAX_COMMENT_LEN = 200` in
`frontend/core/cancellationReason.ts` then quietly drops the rest. Members who
write the most lose the end of what they wrote, as Alexandru did. The fix is to
make the two limits match. Raising the server cap to 500 keeps the most.

**2. The used-verification-link error, again.** Alexandru's verify link
worked at 12:33:29 UTC on Sep 30, and a second open from the same address 10
seconds later logged "already-consumed token". That's a double click or a
reload, not a scanner. It's the same bug as item 1 in
`2026-09-29-cancellations-narsing-abdullah-kfee.md`, and it's still on
`release`. `consumeEmailVerification` in `frontend/core/serverAuth.ts` returns
`invalid` for a used token even when the account is verified. It's not why
they left.
