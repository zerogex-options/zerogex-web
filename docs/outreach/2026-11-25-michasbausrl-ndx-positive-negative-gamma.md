# michasbausrl@hotmail.de: "Negative or positive gamma on NDX?" (2026-11-25)

He wrote in German, so the draft is in German with "du" (as in
`2026-10-26-michasbausrl-annual-cancel-refund-window.md`), with an English
translation line for line. Each paragraph is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Wed Nov 25, 10:21 AM ET, in the "AW: Sorry to see you go" thread,
replying under your Nov 10 liquidity answer:

> Hy Michael du muss mir Kurtz helfen ,ich brauche negativ gamma oder positiv
> gamma auf NDX;Danke

("Hi Michael, you have to help me quickly, I need negative gamma or positive
gamma on NDX. Thanks.") Same member as
`2026-11-09-michasbausrl-yellow-button-annual.md`: Pro annual, paid through
Oct 20, 2027, so Dealer Positioning is open to him.

> **Status:** sent Wed Nov 25.

## The read

- **He wants to know which regime NDX is in. Today it's negative.** The free
  NDX page's snapshot at 10:08 AM ET: net GEX at spot −$1.03B, NDX 25,291,
  down 923 points (−3.52%). The chart's "Dealer Gamma @ Spot" badge read
  SHORT Γ.
- **The page doesn't say "negative" where he'd look first, which is probably
  why he wrote.** No gamma flip was published (NDX was too deep in negative
  gamma for a crossing near spot), so the Today's Read badge reads "REGIME
  UNRESOLVED" and the Gamma Flip card shows "—". `detectRegime` in
  `frontend/app/live-bulletin/bulletinHelpers.ts` returns `unresolved`
  whenever the flip is missing. Five of the six symbols on the free page were
  in that state this morning. Only SPY had a flip (733.55, spot 702.79).
- **The Key Levels tag answers even with no flip.** On Dealer Positioning,
  next to "KEY LEVELS NDX", a chip reads SHORT Γ (red) or LONG Γ (green). It
  takes the sign of net GEX at spot (`longGammaAtSpot` in
  `frontend/core/gammaRegime.ts`, via `useGammaPlaybook`). The source says
  "Short γ", but `.zg-chip` is uppercase in CSS, so it displays as "SHORT Γ".
  The draft quotes what he sees.
- **Deep link.** `/gamma-exposure?symbol=NDX` opens the page on NDX
  (`frontend/core/TimeframeContext.tsx` honors `?symbol=`).
- **Name.** Your Nov 10 reply opened "Hi Mihai (or do you go by Micha?)" and
  he didn't say, so the draft keeps "Mihai".
- **The 10:08 reading is timestamped,** so it stays true if you send later.

## Draft reply (German, to send)

Reply in the same thread.

Hallo Mihai,

kurz gesagt: Laut unserem Modell ist NDX gerade im negativen Gamma. Um 10:08 Uhr New Yorker Zeit (16:08 Uhr deutscher Zeit) lag Net GEX für NDX bei etwa −1 Mrd. US-Dollar, und NDX ist heute stark gefallen (rund −3,5 %). Negatives Gamma heißt: Das Hedging der Dealer kann Bewegungen verstärken, statt sie zu bremsen.

Wenn im Kasten „Today's Read“ gerade „REGIME UNRESOLVED“ steht und beim Gamma Flip nur ein Strich (—) zu sehen ist, liegt das genau daran: NDX ist so tief im negativen Gamma, dass es in der Nähe des Kurses keinen Gamma Flip gibt. Das Regime selbst ist klar negativ.

So siehst du es jederzeit selbst. Öffne Dealer Positioning mit NDX: https://zerogex.io/gamma-exposure?symbol=NDX

Ganz oben, in der Zeile „KEY LEVELS NDX“, steht ein kleines farbiges Label (Γ ist das griechische Gamma):

„SHORT Γ“ (rot) = negatives Gamma
„LONG Γ“ (grün) = positives Gamma

Viele Grüße,

## English translation (not to send)

Hi Mihai,

Short answer: according to our model, NDX is in negative gamma right now. At 10:08 AM New York time (4:08 PM German time), Net GEX for NDX was about −$1 billion, and NDX has fallen hard today (about −3.5%). Negative gamma means dealer hedging can make moves bigger instead of slowing them down.

If the "Today's Read" box says "REGIME UNRESOLVED" right now and the Gamma Flip shows only a dash (—), that's exactly why: NDX is so deep in negative gamma that there's no gamma flip anywhere near the price. The regime itself is clearly negative.

Here's how to check it yourself any time. Open Dealer Positioning with NDX: https://zerogex.io/gamma-exposure?symbol=NDX

At the very top, in the "KEY LEVELS NDX" line, there's a small colored label (Γ is the Greek letter gamma):

"SHORT Γ" (red) = negative gamma
"LONG Γ" (green) = positive gamma

Best regards,

## Worth a look later (not urgent)

When spot is deep in one regime there's no flip, and the regime badges that
read the flip alone show "unresolved" on exactly the days a trader most wants
the answer: "REGIME UNRESOLVED" on Today's Read, "? GAMMA REGIME" on the live
bulletin, and "Gamma flip unresolved" on the free levels pages
(`detectRegime` callers: `bulletinHelpers.ts`, `spx-gamma-levels/gammaLevels.tsx`,
`gex-levels/page.tsx`). Meanwhile the SHORT Γ chip on the same page says it
plainly. Net GEX at spot is sign-consistent with the flip by construction
(`core/gammaRegime.ts`), so falling back to its sign when the flip is missing
wouldn't bring back the chain-total problem the comments warn about. The free
page's own FAQ already tells readers "the sign of net GEX still tells you which
regime NDX is in."
