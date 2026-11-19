# John Shepherd: looking for gold (GC) options, which we don't cover (2026-11-18)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

**Inbound.** Wed Nov 18, 11:14 AM, from jpshepherd@mac.com to your inbox, as a
reply to "Thank you for subscribing to ZeroGEX!":

> Hey, Michael..I was looking for GC options. It appears it is one that you do
> not cover. Is that a fair assumption? I apologize for not looking over the
> site to the degree necessary before I purchased…

That subject is the paid-up-front welcome (`core/mailer.ts`), which also named
his refund deadline. His account confirms it: Pro monthly, paid on day one,
under the 7-day money-back guarantee.

> **Status:** sent Wed Nov 18. **John replied at 3:19 PM: he's staying, on the
> free month.** Next: run `gift-month`, then send the reply under "I'll stay".

## His reply (Wed Nov 18, 3:19 PM)

> Hey, Michael. Thanx for the message. I didn't expect a response. What I'm
> working on is picking the instrument to fit the tool. Yeah. The whole cart
> and horse thing. I found something interesting and I need option and related
> data. I like your site: I was on Tanuki trader and I was like "what?" The
> nerds got a hold of the veto button over there. Marketing didn't have much of
> a chance.
>
> I don't want to accept your generous offer and bail on you early next year if
> it doesn't work out. I'm not that guy. Once again, I do like your site. I
> could learn a great deal with what you offer for educating folks.
>
> Okay, you talked me into it. I will accept your kind offer and stay with ya.

- **He took the "stay" offer,** so his next month is free. He turned down the
  refund-and-come-back route because he didn't want to take it and then leave.
- **He's flexible on the instrument.** "Picking the instrument to fit the tool"
  means he'll trade what we cover, so the reply points him to the S&P 500 and
  the Nasdaq, the only markets with signals and trade ideas.
- **Worth keeping:** he came from Tanuki Trader and found it too technical. The
  education side is what he likes here.
- **"Option and related data" is unspecified.** The reply asks what it is
  rather than guessing.

## His account (`make diagnose-user`, Nov 18)

Times are ET.

| | |
|---|---|
| Plan | **Pro monthly, $59**, paid up front, no trial, no discounts. A money-back plan (`money_back=1`) |
| Signed up | Wed Nov 18, 9:53 AM. Paid at 9:55 AM, two minutes later |
| Refund window | 7 days from the payment: closes about **9:55 AM on Wed Nov 25** |
| Last seen | 11:07 AM, about 70 minutes after paying |
| Next bill | $59 on Fri Dec 18 |
| Paying with | Link (`pm_1UdAG94AOiqteMYYsid0qUXr`), no card |
| Stripe | `cus_VeTCDr6hnUdZxm`, `sub_1UdAGA4AOiqteMYYyacOdIk1`, invoice `in_1UdAGA4AOiqteMYYyW8Aj66z` |
| User id | `user_17cf27166355b05f5a170556` |

Ignore two lines in that output. "DORMANT" appears on any account under a day
old. "MONEY EVER COLLECTED: 0 cleared invoice(s)" lags because the invoice table
refreshes on a timer; Stripe shows the $59 paid.

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

- **His plan and refund window: done, Nov 18.** Pro monthly, inside the
  window, no discounts (table above), so the draft goes as written.
- **If you send it after today, re-run `make diagnose-user` first.** He can
  take the money-back refund himself from the Account page. A `refund_issued`
  row or tier `public` means he has. Then replace the third paragraph with "I
  see your refund has already gone through. When GLD is ready, I'd like you to
  be one of the first to try it. I'll write to you then, and your first two
  weeks will be on me." and delete the fourth.

## Draft

Reply in his thread.

Hi John,

No apology needed, and thanks for asking. You're right: we don't cover gold today. ZeroGEX is built on stock and index options, and GC options trade on the COMEX futures exchange, which our data doesn't include.

Gold is on the list, through GLD, the gold ETF, rather than GC options themselves. It's queued behind a few stocks I'm adding now, and I can't give you a date yet.

I don't want you paying for something you can't use, so just reply "refund" and I'll refund your $59 in full. When GLD is ready, I'd like you to be one of the first to try it. I'll write to you then, and your first two weeks will be on me.

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
   - **After about 9:55 AM on Wed Nov 25** the window has closed: add
     `FORCE=1` to both commands. It honors the refund as goodwill and bypasses
     nothing else.
   - **Any other reason it isn't eligible:** stop there and send me the
     output.

**Reply:**

Hi John,

Done. I've refunded the full $59 and closed your plan, so nothing more will be charged. The refund usually shows up within 5 to 10 business days, depending on your bank.

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

The preview should show `Auth DB: /var/lib/zerogex/auth.db`, his subscription
`sub_1UdAGA4AOiqteMYYyacOdIk1`, "one month = $59.00", and "Balance now: $0.00".
If "Balance now" says "(a credit already)", the free month is already in
place: stop, and don't apply it again. The tool only blocks a repeat on the
same New York day, so a second run on a later day would credit another $59.
The real run should end with his next invoice on 2026-12-18 at `$0.00 due`.

It credits $59, one month of his plan, to his Stripe balance, so his Dec 18
bill is $0 and billing carries on at $59 after that. His plan and billing date
don't change. No apostrophes in `NOTE`.

**Reply** (send only after the real run shows `$0.00 due`):

Hi John,

That's good of you, and I'm glad you're staying. Your next month is on me, so your December 18 bill will be $0, and it's $59 a month after that. I'll write to you when gold is live.

Since you're picking the instrument to fit the tool, the S&P 500 and the Nasdaq (SPX, SPY and ES, or NDX, QQQ and NQ) get the most out of the site. They're the only ones with the signals and trade ideas so far.

If there's specific options data you need for what you found, tell me what it is and I'll point you to it. And since you like the education side, it's all in one place here: https://zerogex.io/education

Best,
Michael

### What his answer to the GC question tells you

**Nov 18:** he didn't answer it. He's picking the instrument to fit the tool,
so don't ask again. The notes below stay for when gold comes up.

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
on its own, and both trial reminders are re-armed. He pays through Link rather
than a card, which the script accepts: the dry run should print
`Card: link (pm_1UdAG94AOiqteMYYsid0qUXr)`. Reply with the trial end date it
prints, and say it bills after that unless he cancels.
