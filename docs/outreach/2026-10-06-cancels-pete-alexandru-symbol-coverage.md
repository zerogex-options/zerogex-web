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

The facts below come from the two alert emails. `make diagnose-user` wasn't run
for this note, so run it on both addresses before sending (see "Verify first").

| | **kaspe67@gmail.com** (Pete) | **rocadomenicalexandru@gmail.com** |
|---|---|---|
| User id | `user_2b7e9dceb7d7038ec28f3f4e` | from `make diagnose-user` |
| Plan | Pro. The price isn't in the alert | Pro monthly, **$49**, paid up front under the 7-day guarantee |
| Tenure | Signed up Sat Jul 25, 9:23 PM ET, subscribed 4 minutes later. 72 days | Paid within the last 7 days |
| Canceled | Tue Oct 6, 11:12 AM ET, in-app. "Other", nothing typed | Tue Oct 6, self-serve refund on the Account page, `missing_features` |
| Access | until **Sun Nov 1, 8:26 PM ET**. Last trading day is Fri Oct 30 | ended with the refund |

## The read

- **Same complaint, two people, one morning.** It's two data points, not a
  trend. It's still the one thing worth asking both: which symbols, exactly.
  Today ZeroGEX covers SPX, SPY, QQQ and NDX, plus ES and NQ carried over from
  the index options. No single stocks, no IWM or RUT. Don't promise any. No
  roadmap note in either repo commits to new symbols (same line as the Benny
  note: "Don't promise it.").
- **Pete: a warm thread, reply today.** They wrote back to the ack themselves,
  and they said "for now." There's no price complaint and they already ignored
  the 25%-off link, so offer no discount. The useful things are: ask which
  symbols, say honestly there's no date, and keep the switch-back open until
  Nov 1.
- **Alexandru: their message was cut off by our form, not by them.** It is
  exactly 200 characters long. The refund panel lets members type 500, but
  `sanitizeCancellationComment` in `frontend/core/cancellationReason.ts` keeps
  only the first 200. The rest is dropped before it's stored anywhere, so the
  ledger, Stripe and the alert all have the same cut text. The real reason is in
  the part we lost. The reply owns that and asks them to finish the sentence.
- **NDX is already on the platform.** It's in the symbol picker on every
  dashboard page, and NQ is next to it. "Adding NDX" means either they missed
  it, or they suggested it to you earlier and are thanking you. The draft's
  line works for both readings. **A personalized dashboard doesn't exist.** The
  draft asks what they'd put on theirs, and promises nothing.
- **No discount for Alexandru.** Price isn't the complaint and they've been
  refunded. The open offer of a promo rate is the same line you added to
  kfee's reply.

## Verify first

- **Run `make diagnose-user` on both addresses right before sending.** If Pete's
  `Cancel at period end` has flipped to `no`, they switched it back on
  themselves, so send a thank-you instead.
- **Pete's price.** The switch-back line says "same price" on purpose. If
  diagnose-user shows a promo coupon that runs out before December, change it to
  "same plan."
- **Alexandru's name.** "Alexandru" is read off the email address. Romanian
  names are often written surname first, so this person could be Domenic,
  Alexandru or Domenic-Alexandru. Check the name on their Stripe customer, and if
  it's unclear, open with "Hi,".
- **Did Alexandru write to you before?** Search your inbox for the address. If
  they sent you suggestions earlier, and you told them you'd look at NDX or a
  dashboard, add one line saying so, so the reply doesn't read like a form
  letter.

## Draft: Pete

Reply in the same thread, so it lands under their message.

Hi Pete,

Thank you, that's kind of you to say, and it's exactly the kind of answer that helps me most.

Which symbols would you need? Even a short list is plenty. Right now ZeroGEX covers SPX, SPY, QQQ and NDX, plus ES and NQ, and you're not the only member who's asked for more.

I won't promise a date I can't keep. But the symbols members actually ask for go to the top of the list, and if I add yours, I'll email you myself.

Your access stays on until November 1 either way. If you change your mind before then, reply and I'll switch it back on at the same price, with nothing to set up again.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## Draft: Alexandru

**Subject:** Your refund, and the end of your sentence

Hi Alexandru,

Your $49 refund has gone through. It usually shows up within 5 to 10 business days.

Thank you for the kind words. One thing went wrong on my end: our form only kept the first 200 characters of your note, so it stops at "the reason I'm leaving is because it lack". I never saw the rest. Would you finish that sentence for me? It's the part I most want to read.

On your two suggestions:

- NDX is in the symbol picker at the top of every dashboard page, with NQ next to it. If anything about it didn't work the way you expected, tell me.
- A personalized dashboard isn't something we have yet. What would you put on yours? Which charts, and which symbols?

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

  This turns the cancel off and keeps any coupon. It sends no email, so reply to
  confirm the next charge date and amount from the dry run's output.
- **Pete replies after Nov 1.** Switching back no longer works. They come back
  through the pricing page. To give them a discount anyway, use the after-lapse
  path in the "If they reply" section of
  `2026-09-25-trial-cancels-oliver-chenyu.md` (the win-back stamp plus
  `/pricing?winback=1`).
- **Alexandru finishes the sentence.** Read it. It's the real reason.
- **Alexandru takes up the promo rate.** They've used their one money-back
  refund, so tell them the next payment has no guarantee before they pay. Then
  follow kfee's steps in `2026-09-29-cancellations-narsing-abdullah-kfee.md`
  (the win-back stamp, then send https://zerogex.io/pricing?winback=1), with
  their address in place of kfee's:

  ```bash
  sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'rocadomenicalexandru@gmail.com';"
  ```

## Worth fixing later (not urgent)

**The cancel and refund forms let members type 500 characters, but keep only
200.** Both `MoneyBackGuaranteePanel.tsx` and `CancelRetentionModal.tsx` set
`maxLength={500}`. The server's `MAX_COMMENT_LEN = 200` in
`frontend/core/cancellationReason.ts` then quietly drops the rest. Members who
write the most lose the end of what they wrote, as Alexandru did. The fix is to
make the two limits match. Raising the server cap to 500 keeps the most.
