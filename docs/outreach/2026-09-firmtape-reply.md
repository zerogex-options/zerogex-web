# FirmTape (Yevhen) — correspondence, September 2026

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

## Thread so far

1. **2026-09-09, inbound.** Cold outreach asking to be considered for the next
   update of [Best GEX Tools](/education/best-gex-tools). Claimed a free SPX
   replay archive, a tape-reconstructed dealer book, a flip with stated
   uncertainty, a registry-listed MCP server, and research publishing their own
   misses — including per-print signing "close to a coin flip" against Cboe.
2. **2026-09-11, outbound.** Told him he was already in the comparison, that the
   entry carries the criterion-3 caveat, and asked four questions: archive size
   and access, the delay, the price, and a link plus the headline number for the
   signing study.
3. **2026-09-11, inbound.** Answered all four with a source for each, and
   volunteered two things that damage him. See below.
4. **2026-09-11, outbound.** Sent. Confirms where each number landed, explains
   why the flat-dealer finding went to criterion 3 rather than his entry, and
   offers the NULL-flip-resolver writeup.

**Outstanding commitment from (4):** the reply says "I will run list_sessions
against your MCP server and check it against the entry." firmtape.com and
mcp.firmtape.com are both unreachable from the build environment, so this has
to be run from a machine that can reach them. Until it is, the entry's "roughly
1,100 sessions back to April 2022" rests entirely on his email. Check against
1,099 as of the 10 Sep close and a first session of 2022-04-14.

## What he answered

| | |
| --- | --- |
| Archive | 1,099 finished SPX sessions as of the 10 Sep close, first 2022-04-14, one added each evening. No account, whole archive, not just recent days. Per-session JSON at `/snapshots/YYYY-MM-DD.json`; `list_sessions` on their MCP returns count and span. |
| Delay | 15 minutes on the live day only; the page states the ET time its reading belongs to. Archive replay is unrestricted — second by second from the open, no delay, no truncation, no account. |
| Pricing | ARCHIVE free forever, no account. LIVE $49/mo or $490/yr. LAB $49/mo for 200 credits, or packs from $9. DATASET $249/mo or $2,490/yr. For live levels $49 is the only tier; LAB and DATASET are separate products, not access levels. |
| MCP | `com.firmtape/spx-options-gamma` at `https://mcp.firmtape.com/mcp`, no key for sessions and levels. |

He also asked us not to publish a fixed session count, since it moves by one a
day — "about 1,100" or "1,099 as of 10 Sep 2026". The entry uses the former.

## The two findings

Both from a single session, 2025-03-28, the only free Cboe participant-tagged
session that overlaps their archive. He states the single-session limit himself,
on both pages.

**Signing accuracy.** The standard quote rule signs SPXW 0DTE prints correctly on
52.3% of volume against Cboe truth (13,648 prints matched, 8,671 signable). A
narrower single-leg pass gave 47.6% on 14,679 trades, which is where "close to a
coin flip" came from. A documented correction lifts the score to 74.5% — and
**that correction is not yet in the production pipeline**. He volunteered that
last part unasked. Their multi-leg package signer scores 80.4% of customer legs
(87.9% excluding a category the exchange itself cannot attribute), covering
40.2% of prints that day.

**The dealer ends flat.** On the whole SPX 0DTE book at 13:16 that session, 1.84
million contracts, the market-maker capacity's net position change was 0.10% of
contracts, while customer and pro-customer flows ran +2.24% and -2.78% against
each other. Any customer-vs-dealer book attributes that inter-client flow to the
dealer — his words, "ours included."

This one is not about FirmTape. It bears on every tool in the comparison,
ZeroGEX among them, which is why it went into criterion 3 rather than his entry,
naming our own exposure to it. Publishing the number that damages him while
omitting the one that damages us would have been cherry-picking, to the one
reader who knows both.

## What is published now

- **Criterion 3** carries the dealer-attribution finding as a category-wide open
  question, says it is one session, says it names ZeroGEX too, and points at
  [the methodology page](/methodology).
- **His entry** carries the archive size, the free tier, the 15-minute delay,
  the $49 live price, the registry ID, and the signing numbers with their
  denominators and the not-yet-in-production caveat.
- **The pitfalls section** gains: when a vendor does publish an accuracy number,
  check how many sessions it covers and whether the scored pipeline is the one
  in production.
- All four translations (de/es/fr/it) are synced.

Nothing above is independently verified — firmtape.com is unreachable from the
build environment, so every claim is attributed to FirmTape in the copy. The
cheap check, if it is ever worth doing: add `https://mcp.firmtape.com/mcp` to a
client and call `list_sessions`, which is the non-self-reported source he
offered.

---

## Reply as sent, 2026-09-11

Yevhen,

That is the most useful reply I have had from a vendor, and the two things you volunteered are why. The correction that is documented and not yet in production is not something you had to tell me. Neither is the inter-client flow number.

All four are in. The entry now states roughly 1,100 sessions back to April 2022 rather than a fixed count, on your advice, and says the archive replay is unrestricted while the 15 minutes applies only to the day still running. Price reads as $49 a month for live intraday, with a note that the research-credit product and the data license are separate products rather than access tiers, since that distinction is the one a reader would otherwise get wrong.

On the signing study, I have published 52.3% of volume, the documented correction to 74.5%, the fact that the correction was not in the production pipeline as of this month, and 80.4% of customer legs from the package study at 40.2% of prints. I have not blended them into one number, because volume, legs and prints are three different denominators and a single figure would be invented. Every one of them says "one session" in the same sentence. I have also added a line to the pitfalls section saying that when a vendor publishes an accuracy number a reader should check how many sessions it covers and whether the scored pipeline is the one in production — which is a generalization of what you told me about yourself, and it is in the article because it is good advice, not to make a point.

The flat-dealer number went somewhere else. It is not in your entry, because it is not about you. It is in criterion 3, as the open question underneath the whole category, and it names ZeroGEX as exposed to it alongside everyone else — we infer positioning from open interest under a stated sign convention, which assumes a dealer side on every contract rather than measuring one, so if the market-maker capacity ends a session flat then our "net dealer gamma" has the same attribution problem yours does, by a different route. Publishing the number that costs you while leaving out the number that costs me would have been cherry-picking, and you would have been the one person who could tell.

I have not been able to open firmtape.com from where I build the site, so everything above is attributed to you in the copy rather than asserted. Not a complaint, just so you know why it reads that way. I will run list_sessions against your MCP server and check it against the entry.

The screenshot is useful, thank you — the three-book disagreement strip is the part I had not understood from the site description.

One thing back, in the spirit of the exchange. Our flip resolver returns NULL on degraded chains rather than carrying the last good value forward, and the edge cases that forced that — grid-edge artifacts, hairline crossings far from spot, one-sided chains in an IV spike — are documented failure cases rather than a design story. If a comparison of where two different methods each decline to answer is interesting to you, I will write ours up properly and send it. You are the only person in this category I would offer that to.

Michael
ZeroGEX
