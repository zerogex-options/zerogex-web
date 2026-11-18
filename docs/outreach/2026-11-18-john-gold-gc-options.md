# John Shepherd: looking for gold (GC) options, which we don't cover (2026-11-18)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

**Inbound.** Wed Nov 18, 11:14 AM, from jpshepherd@mac.com to your inbox, as a
reply to "Thank you for subscribing to ZeroGEX!":

> Hey, Michael..I was looking for GC options. It appears it is one that you do
> not cover. Is that a fair assumption? I apologize for not looking over the
> site to the degree necessary before I purchased…

That subject is the paid-up-front welcome (`core/mailer.ts`). A Basic monthly
trial gets "Your ZeroGEX trial is active" instead. So he most likely paid on
day one, on a plan the 7-day money-back guarantee covers, and that welcome
email named his refund deadline. `make diagnose-user` confirms it (see "Verify
first").

> **Status:** drafted Nov 18, not sent.

## The read

- **He's right, and real GC isn't a capacity question.** Nothing you run reads
  options on futures. ThetaData sells no CME data at all
  (`docs/design/market-data-provider-abstraction.md` in zerogex-oa), and the
  TradeStation futures login only streams ES and NQ prices. Real GC options
  would take three things:
  - a CME-capable vendor (Databento is the one your notes already looked at);
  - CME licensing, which the September audit already rates Critical for ES/NQ
    (F4). CME prices data per exchange, and gold trades on COMEX, not on CME
    where ES and NQ trade, so it adds an exchange to that question;
  - pipeline work, since each GC option settles into a specific futures month
    rather than one spot price.

  That's weeks of work plus new monthly fees. Not now, and not in the reply.
- **GLD, the gold ETF, fits what you have.** Its options are ordinary OPRA
  options on the same ThetaData feed as NVDA and MSFT. The backend needs no
  code, and the web change is the usual symbol-list edit. It's one more chain
  under the same 40-strike cap as each MAG 7 stock. The Nov 6 baseline projects
  all 11 symbols (MAG 7 done) at about 40 s for the stalest option rows,
  against the 60 s warning, so a 12th chain should fit. `make capacity-check`
  decides, exactly as for each stock (`mag7_rollout.md`). It's also what you
  told Yordan on Nov 5: the rest of the MAG 7, then GLD.
- **One decision when GLD goes in, not now.** Put it on the stock path, not
  in `ETF_SYMBOLS`. Market Tide counts every symbol in `ETF_SYMBOLS`
  (`market_tide_universe()` in zerogex-oa), and gold doesn't belong in an
  equity tide. The stock path keeps it out, but it then sits under "Stocks" in
  the picker, compares against SPY, and its vol gauge reads VIX. Those are
  small web touches.
- **GC prices on the levels, the way ES carries SPX, is a separate, bigger
  job.** The futures projection is built for quarterly index futures
  (third-Friday roll, dividend carry). Gold rolls on a different calendar.
  GC also trades at about 11 times GLD's price, a conversion the code doesn't
  have: in carry-only mode (on since Sep 23) it would put GC levels at GLD
  prices. Live GC prices would also need COMEX on the TradeStation futures
  login. Promise GLD, not GC.
- **The discount: offer the refund first.** Three reasons:
  - His problem is coverage, not price, the same as Pete and Alexandru on
    Oct 6. A discount doesn't fix it.
  - Staying means paying for something he can't use, with no date. And what's
    coming is GLD, which he may not count as GC.
  - While he waits, his 7-day refund window closes. A customer who paid to wait
    and didn't get what he waited for is how a dispute starts (Lee, Oct 30).

  So the draft offers a full refund, and makes him your early tester: when
  GLD is live, two free weeks to try it. Staying, with a free month, is offered
  only if he also trades something you already cover. The free month is your
  discount: `gift-month` does it in one command on any plan, and it needs no
  end date.

## Verify first

- **His plan, payment date and refund window,** on the server in
  `~/zerogex-web`:

  ```bash
  make diagnose-user EMAIL=jpshepherd@mac.com
  ```

  You want his plan and cadence, what he paid and when, and whether he's still
  inside the 7 days. If he's on a **quarterly or annual** plan, change "I'll
  make your next month free" to "I'll take a month off your next bill".
  `gift-month` credits a month's worth of his plan (a third of the quarterly
  price, a twelfth of the annual) against his next bill.
- **Whether he's already gone.** If the output shows a `refund_issued` row or
  tier `public`, he used the money-back button himself. Then replace the third
  paragraph with "I see your refund has already gone through. When GLD is
  ready, I'd like you to be one of the first to try it. I'll write to you then,
  and your first two weeks will be on me." and delete the fourth.

## Draft

Reply in his thread.

Hi John,

No apology needed, and thanks for asking. You're right: we don't cover gold today. ZeroGEX is built on stock and index options, and GC options trade on the COMEX futures exchange, which our data doesn't include.

Gold is on the list, through GLD, the gold ETF, rather than GC options themselves. It's queued behind a few stocks I'm adding now, and I can't give you a date yet.

I don't want you paying for something you can't use, so just reply "refund" and I'll refund your payment in full. When GLD is ready, I'd like you to be one of the first to try it. I'll write to you then, and your first two weeks will be on me.

If you also trade the S&P 500 or the Nasdaq (ES, NQ, SPX or SPY) and would rather keep your plan in the meantime, that works too, and I'll make your next month free.

One question: do you trade GC futures, or the options themselves? It helps me decide how to build gold.

Best,
Michael

## If he replies

### "Refund"

The rest runs in `~/zerogex-web` on the server.

1. **Preview, no writes:**

   ```bash
   make money-back-refund EMAIL=jpshepherd@mac.com
   ```

   It should say he's eligible. Then apply:

   ```bash
   make money-back-refund EMAIL=jpshepherd@mac.com YES=1
   ```

   That's the Account page's own path: a full refund, the plan canceled on the
   spot, any API key revoked, the refund confirmation email sent, and the
   refund recorded as his one guarantee refund.
   - **Window closed:** add `FORCE=1` to both commands. It honors the refund as
     goodwill and bypasses nothing else.
   - **It says `not_covered`** (a Basic monthly plan): `FORCE=1` doesn't lift
     that. Refund in the Stripe Dashboard (reason "Requested by customer"),
     then run `make cancel-subscription EMAIL=jpshepherd@mac.com FORCE=1
     DRY_RUN=1`, and the same with `YES=1` in place of `DRY_RUN=1`. Those are
     Jose's steps (`2026-11-18-fortune-futures-trial-charge-cancel.md`).

**Reply:**

Hi John,

Done. I've refunded your payment in full and closed your plan, so nothing more will be charged. The refund usually shows up within 5 to 10 business days, depending on your bank.

I'll write to you when gold is live.

Best,
Michael

### "I'll stay"

Only after he says yes. Preview, then apply:

```bash
make gift-month EMAIL=jpshepherd@mac.com NOTE="waiting for gold" DRY_RUN=1
```

```bash
make gift-month EMAIL=jpshepherd@mac.com NOTE="waiting for gold" YES=1
```

It credits a month's worth of his own plan to his Stripe balance, so his next
bill is that much less ($0 on a monthly plan). His plan and billing date don't
change. No apostrophes in `NOTE`. Afterward, `make diagnose-user` shows the
credit under Balance and the reduced charge under Upcoming invoice. Then reply
with the date of that next bill.

### What his answer to the GC question tells you

- **GC futures:** GLD levels are a partial fit until they're on GC prices,
  which is the bigger job above. Don't promise it, but note it as a request
  for that job.
- **GC options:** GLD is a different book from COMEX gold options, though both
  track the same metal. Say so plainly when you invite him. The free two weeks
  are how he judges.

## When GLD is live: the early-tester invite

**If he took the refund.** Send this before turning anything on, and
reactivate him only after he says yes.

Hi John,

Gold is live on ZeroGEX, through GLD, the gold ETF: the walls, the gamma flip and max pain, updated through the session. As promised, your first two weeks are on me. Want me to turn your account back on? After the two weeks it renews at your old plan's price unless you cancel, and you'll get a reminder before then.

Best,
Michael

**If he stayed,** there's nothing to turn on. Send the first sentence, then
"It's in the symbol menu at the top of the page. Let me know what you think."

When he says yes:

```bash
make reactivate-member EMAIL=jpshepherd@mac.com DAYS=14 DRY_RUN=1
```

```bash
make reactivate-member EMAIL=jpshepherd@mac.com DAYS=14 YES=1
```

It re-creates his last plan on the card still on file, with 14 free days, then
bills at his plan's price unless he cancels. The "Welcome back" email goes out
on its own, and both trial reminders are re-armed. The dry run refuses if no
usable card is left. Reply with the trial end date it prints, and say it bills
after that unless he cancels.
