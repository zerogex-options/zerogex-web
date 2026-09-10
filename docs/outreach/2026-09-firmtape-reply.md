# Reply to FirmTape (Yevhen), September 2026

Context: FirmTape's founder emailed cold — one email, no reply sent yet — asking
to be considered for the next update of [Best GEX Tools](/education/best-gex-tools)
and offering a screenshot or a one-line description. They are now in Bucket 3,
and tape reconstruction is documented as a third calculation methodology.

**Send from:** whichever address the original landed on, so it threads.
**Subject:** Re: SPX dealer positioning

The draft below has each paragraph on a single line, with no hard wrapping, so
it can be pasted straight into a mail client without reflowing badly.

Four things worth knowing before sending:

- The article is live with their entry. Saying so is the whole reason this reply
  gets answered — it costs nothing and it is true.
- The four questions are all claims their own email made that could not be
  confirmed from outside. The framing matters: we are not asking because they
  didn't say, we are asking because a comparison that repeats vendor marketing
  as fact is worthless. That is the same standard the article holds them to, so
  it reads as consistency rather than suspicion. We currently publish neither
  their price nor their session count.
- Question 4 is the one that matters. "Close to a coin flip" is their own
  description of their per-print signing accuracy against Cboe truth, and if the
  real number is near 50% the tape-reconstruction premise is in trouble — the
  cumulative inventory compounds those errors through the session. Criterion 3
  and the pitfalls section already tell readers to treat that number as the
  claim being made. Their answer either firms up the entry or tells us to trim
  it.
- Our own MCP server is live at `https://zerogex.io/mcp` and listed in the
  official registry as `io.zerogex/gamma-levels` (published 2026-09-10). Telling
  them beats having them find it. Sharpnel Trading listed theirs on 2026-09-09,
  so this is now three tools in one comparison — worth saying out loud to
  someone who tracks the category.

Optional addition, if a relationship seems worth having: offer a research trade.
Our flip resolver reports NULL on degraded chains instead of carrying the last
good value forward, and the failure cases behind that would probably be
recognisable to someone who publishes their own misses. Left out below to keep a
first reply short.

Also left out: [How to Get SPX Gamma Levels in Claude, ChatGPT and Cursor](/education/gamma-levels-in-claude)
and the "Read these levels inside Claude" block now on the gamma-levels pages.
Both are ours to promote, not news he can use, and a first reply that links our
own content twice reads as a pitch back.

---

## Draft

Yevhen,

Thanks for writing, and for leading with the misses. That is rarer than it should be in this category.

You are in the comparison as of this week. I wrote the entry rather than using your copy, which I hope you would expect: the dealer book is reconstructed from the options tape print by print rather than from open interest and a sign convention, the zero-gamma flip carries a stated uncertainty rather than arriving as a bare number, and there is a free replay archive behind it. I also added tape reconstruction as a third calculation methodology alongside spot-shift and per-strike aggregation, because it belonged there regardless of who was doing it.

It is not a free win. The same update says the approach trades a modeling assumption for a measurement problem rather than being a strict improvement, that per-print signing is genuinely hard — a trade at mid, a multi-leg spread or a block broken into pieces often has no recoverable side, and because inventory is cumulative those errors compound through the session instead of averaging out — and that any vendor taking that route should publish how often its signing is correct against an independent source. You appear to be the only one who does, and that is the strongest thing in your email.

Yes to the screenshot, thank you. Four things alongside it and I will tighten the entry. I don't publish a vendor's numbers on the vendor's say-so, which is why the entry currently says "a free replay archive" rather than naming a session count, and why it doesn't state your price at all.

1. The archive. Your email says 1,097 finished SPX sessions since April 2022. Is that current, and does the no-account part hold for the whole archive or only for recent sessions?
2. The free levels. Fifteen minutes, which is the same delay we publish on ours. Is that the delay on the live day, and is the archive replay itself unrestricted?
3. Pricing. $49 a month for live intraday — is that the only paid tier?
4. The signing study. A direct link and the headline number, please. "Close to a coin flip" is doing a lot of work in that sentence, and the article tells readers to treat that number, not the narrative around it, as the claim being made. I would rather link it than paraphrase it.

Two things in return, since you clearly track the category. We shipped a free hosted MCP server of our own this week, at zerogex.io/mcp, over our free delayed levels — no key, no account, reading is free, and it is in the registry as io.zerogex/gamma-levels. And Sharpnel Trading listed one the day before we did. So the comparison now names three, and I have added a line to the pricing-and-access section saying that reading a vendor's levels inside an assistant is becoming a normal access route rather than a differentiator. Your email is what made me look at that gap, and I would rather tell you than have you find it.

Send the four and I will update the entry.

[Your name]
ZeroGEX
