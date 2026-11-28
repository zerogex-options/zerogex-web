# Filip: does options data have to cost $20k-$200k to be reliable? (2026-11-28)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** From Filip (ivan_filip@icloud.com), Sat Nov 28, 4:58 AM, in the
"Question" thread. ZeroGEX has helped his trading a lot, and he has built a big
part of his strategy around it. A friend who uses Quant Data heard that options
data has to cost "$20k or even $200k" to be reliable. He isn't switching; he
wants to know what that means and whether it's true.

## The read

- **Nothing to fix, nothing to sell.** A happy customer asking out of
  curiosity. Thank him, answer plainly, stop. No offer, no upsell.
- **The claim is most likely one of two real things, and both are true in
  their place:**
  - **Speed.** Direct exchange connections carry the same quotes as the
    consolidated OPRA feed, faster and with more depth. That matters to
    high-frequency firms, not to levels recomputed every 60 seconds.
  - **Who traded.** Cboe's Open-Close data breaks volume down by type of
    trader and by opening vs closing. It can sharpen a positioning estimate,
    but it still isn't a dealer's book. We don't use it: it exists only as a
    research harness in zerogex-oa (`research/mm_attributed_gex`), with no
    data ever bought. Don't promise it.
- **One answer cuts against us, and it stays in.** Order flow is where finer
  data matters most, because every buy/sell label is an estimate. Our
  methodology page already says ours is one. He'd learn it anyway; better
  from you.
- **Quant Data is named once, next to ZeroGEX**, in "every GEX tool is
  modeling dealer positions." That matches what our own comparison page says
  about Quant Data's help center. No knock on them; his friend uses it.
- **Left out on purpose:**
  - **Vendor names.** The FAQ says we don't disclose them publicly.
  - **Our September feed comparison.** It's the strongest evidence for the
    levels (walls on the same strike in 116 of 116 paired checks), but it was
    one comparison of several, another came out less clean, and quoting it
    invites "which feeds?". The email makes the same point from facts anyone
    can check.
  - **Anything about data licensing.**

## Verified

1. **OPRA, "based on".** Same wording as the public FAQ
   (`frontend/app/help/faqs/Client.tsx`, "Where does the data come from?"):
   option quotes and trades "are based on OPRA, the consolidated U.S. options
   tape", and open interest is "a separate end-of-session figure from
   clearing". The same answer says "We don't disclose specific vendor names
   publicly."
2. **Levels every minute.** `ANALYTICS_INTERVAL` defaults to 60 (zerogex-oa
   `src/config.py`), confirmed on the box for the Ron Windsor reply
   (`2026-11-19-ron-windsor-datafirst-speed.md`).
3. **Dealer positioning is modeled, by us and by Quant Data.**
   `content/articles/zerogex-vs-quant-data.md`: "Quant Data's help center
   describes its figures as an estimate, not a direct look into any dealer's
   inventory, and ZeroGEX says the same."
4. **Even Open-Close data gives an estimate.** zerogex-oa
   `docs/design/market-maker-attributed-gex.md`, "Terminology": the result
   "must not be called 'true dealer GEX'", because it is "still a
   reconstruction".
5. **A trade report carries no opening/closing flag, and Cboe sells one.** The
   same line Ron (Nov 19) and Paolo (Nov 3) got.
6. **Our flow is an estimate, and we say so.** `content/methodology.md`,
   "Aggressor classification": "This estimates which side *initiated* a trade.
   It does not identify the participant type on either side."
7. **Every forecast graded, misses included.** `app/track-record/page.tsx`:
   "Every gamma forecast we have published, graded", with "the dates we
   missed".

## Draft

**Subject:** Re: Question

```
Hi Filip,

Thank you, this genuinely made my day. It means a lot to hear you've built part of your strategy around ZeroGEX.

There's a grain of truth in what your friend heard. Data at those prices does exist, but what the money mostly buys is speed and extra detail, not more reliable numbers. I can't be sure what he had in mind, but it's most likely one of two things.

The first is speed. Every U.S. options exchange reports its quotes and trades to one consolidated feed, called OPRA. The option prices at your broker come from it, and ZeroGEX's data is based on it too. The biggest trading firms also pay for direct connections to each exchange, which deliver the same quotes, with more detail, a tiny fraction of a second sooner. That matters a lot to high-frequency firms racing other computers. For levels like the gamma flip and the walls, which we recompute every minute, it makes no difference.

The second is knowing who traded. A trade report doesn't say who bought or sold, or whether the trade opened a position or closed one. Cboe, for example, sells extra data that breaks trading down by type of trader and by opening and closing, and it isn't cheap. It can sharpen an estimate of how dealers are positioned, but it's still an estimate. No data you can buy shows dealers' actual positions, so every GEX tool, ours and Quant Data's alike, is modeling them, not seeing them.

For the levels themselves, the key ingredient is open interest, which the clearinghouse publishes once a day. It's the same number for everyone, whatever they pay. Where finer data matters more is order flow: labeling each trade as a buy or a sell, which every flow tool has to estimate trade by trade. Ours is an estimate too, and our methodology page says so.

So the better test of reliability isn't what the data costs, it's how the levels hold up over time. That's why we grade every forecast we publish, misses included, in public: https://zerogex.io/track-record

Thanks again for writing. If anything ever looks off to you, just reply and I'll dig in.

Best,
Michael
Founder, ZeroGEX
```

## If he replies

- **"So what data do you use?"** Give him the FAQ answer: option quotes and
  trades based on OPRA, SPX and NDX from a separate index feed, SPY and QQQ
  from a real-time equity feed, ES and NQ from the real-time CME feed, and open
  interest once a day from clearing. No vendor names.
- **"Will you add the Cboe data?"** Not today, and no dates.
- **"How do you decide buy vs sell?"** The tick test: each trade is compared
  with the previous trade in the same contract, higher counts as bought, lower
  as sold. The full description is on the Methodology page
  (https://zerogex.io/methodology), under "Aggressor classification".
- **"What data does Quant Data use?"** Don't guess. Point him to their help
  center.
