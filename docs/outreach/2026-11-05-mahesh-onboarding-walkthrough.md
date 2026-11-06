# Mahesh Chhatlani: asks for an onboarding call and a mock trade walkthrough (2026-11-05)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Mahesh Chhatlani (chhatlani@hotmail.com) replied to his "Thank you for
subscribing to ZeroGEX!" welcome email:

> Michael,
> I'm really looking forward to use these tools to trade.
> Do you have an onboarding person I could call to understand more about the
> process I can use on my trades?
>
> For example, I'd like to take a random date/asset and do a mock/demo
> walkthrough of:
>
> - The pre-market analysis and key levels
> - The trade setup and entry strategy
> - Position sizing and trade management
> - The exit decision and post-trade review
>
> Let me know how I can be helped?

## The read

- **New paid member.** That subject goes to signups who paid up front instead
  of starting a trial (`sendPaidWelcomeEmail` in `frontend/core/mailer.ts`), so
  the 7-day money-back guarantee most likely applies. Replying within a day or
  two is plenty.
- **No call.** Bandwidth is reason enough, and the draft says so plainly.
- **Sizing and trade management are a no even with time to spare.** Terms
  section 5: ZeroGEX "is not a registered investment adviser" and "you are
  solely responsible for your trading and investment decisions." Coaching a
  customer on sizing and managing his own trades is personal advice, so the
  draft says that part is his call.
- **He can do the rest himself.** Each of his four bullets maps to a page that
  already exists:
  - *Pre-market and key levels:* Getting Started ("Your First 15 Minutes with
    ZeroGEX") and Reading the Dashboard. Plus one fact Getting Started leaves
    out: before the open, the levels reflect the prior close and are
    recomputed at 9:30 AM ET (`/help/platform/data-coverage`, "Pre-market and
    after-hours").
  - *Setup and entry:* "How to Trade Around Gamma Flip Levels" (setups for
    each side of the flip, and what to do when price crosses it).
  - *Exit and review, and the "random date" idea itself:* GEX Replay. It's
    free with no login, covers each minute of the regular session, and lists
    recent sessions for each symbol (up to 60). The **Future** button hides
    the candles ahead of the playhead, which turns it into a blind practice
    session. Replay opens on the last minute, so he drags the slider back to
    the open first.
- **Questions by email, with a Replay link.** "Snapshot this minute" copies a
  link to the exact minute he's looking at, so his questions arrive with the
  chart attached.
- **No plan check needed.** The help pages, the article and Replay are all
  public, so every link works whatever plan he's on.
- **No videos to point to.** Every Quick Start video is still "coming soon"
  (`frontend/core/quickStarts.ts`), so the draft doesn't mention them.

## Draft

Reply in the same thread.

```
Hi Mahesh,

Thanks for subscribing, and I'm glad you're looking forward to trading with ZeroGEX.

I should be upfront: ZeroGEX is a one-person company. I build it, run it and answer support myself, so I'm not able to do onboarding calls or one-on-one walkthroughs. That said, the walkthrough you described is something you can run yourself with what's already on the site:

1. Pre-market analysis and key levels. Start with "Your First 15 Minutes with ZeroGEX," then "Reading the Dashboard." One thing to know for your morning prep: before the 9:30 AM ET open, the levels reflect positioning as of the previous close. They're recomputed at the open, once that day's open interest comes in.
https://zerogex.io/help/platform/getting-started
https://zerogex.io/help/platform/dashboard

2. Trade setup and entry. "How to Trade Around Gamma Flip Levels" covers the setups that fit each side of the gamma flip, and what to do when price crosses it.
https://zerogex.io/education/how-to-trade-around-gamma-flip

3. Your mock session, exit and review. GEX Replay lets you pick a symbol and a recent date and replay that session minute by minute. Click "Future" to hide the candles that haven't happened yet, drag the slider back to the 9:30 AM ET open, and write down the key levels and your plan. Then press Play and pause wherever you'd enter or exit. When you're done, click "Future" again to show the whole day and see how your plan held up.
https://zerogex.io/replay

4. Position sizing and trade management. This part is your call, since it depends on your account and how much risk you're comfortable taking. ZeroGEX gives you the levels and the context, but it isn't an investment adviser, so I can't advise on how to size or manage your trades.

Once you've worked through a session or two, send me any specific questions and I'll answer them by email. The easiest way is to click "Snapshot this minute" in Replay and paste the link with your question, so I can see the exact moment you're asking about.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

## If he replies

- **A Replay link with a question.** Explain what the levels and data show at
  that minute. Stop short of what trade to take or how big: that's the line
  Terms section 5 draws.
- **He asks for a call again.** "I'm not able to do calls, but I'm happy to
  keep going by email."
- **He asks how much to risk or where to put a stop.** Same answer as point 4:
  his call. Pointing him to the education articles is fine.
