# Wall hold/break claims: what changed, and what is left for you

September 30, 2026. Branch `claude/playbook-wall-claims`.

## The rule this audit applied

[How Often Do Gamma Walls Actually Break?](/education/how-often-do-gamma-walls-break) measured 737 wall tests on SPY, SPX, QQQ and NDX over ten weeks. S&P walls held about two times in three within an hour of a test and Nasdaq walls about half. Nothing measured about the wall or the tape predicted which ones broke: side of the gamma flip, net GEX and its trajectory, distance to the flip, wall size, the wall's gamma strengthening or being consumed, migration, signed flow at the strike, wall age, prior tests, time of day and realized volatility were all tested.

So copy was changed when it said a wall is more or less likely to hold or break **because of one of those things**, or quoted odds beyond the measured base rate. What the regime still legitimately changes is the mechanism: in long gamma, hedging leans against a move into a wall; in short gamma, it adds to a move once a wall gives way. The fixes say that instead, and cite the base rate once per page.

## What changed on this branch

- **Gamma Terminal Playbook**: all four cells now describe the hedging, not the odds. "Where the edge is" became "What to watch", and a "How often walls break" line shows the base rate for the symbol's index (SPY, SPX and ES read the S&P rate; QQQ, NDX and NQ the Nasdaq rate).
- **The wall study itself**: its takeaway no longer puts "which side of the flip" back into the base rate. The SPX figures in the prose now match its table (17.5% and 30.7%, not 15% and 34%). A fade that "worked" two times in three now reads as a level that held two times in three.
- **Sixteen education articles** (English, plus the four translations of the fourteen that have them), the article FAQs, registry descriptions and `/articles` blurbs, the free gamma-levels pages, the Live Bulletin lead, the About FAQ (five locales), the landing page use case, the trading-mistakes page, the Help FAQ, the methodology page and five help docs (with their translations).
- Every English article, guide and help page was then read line by line by two reviewers, and the translators read every block they touched, so the list below is what was deliberately left, not what was missed.
- **`tests/wallBreakClaims.test.ts`** fails the build if the removed phrasings come back.

One thing to check: the study's prose used to say the SPX 30- and 60-minute intervals "do not overlap". That clause went with the old 15%/34% figures. Put it back if the intervals at 17.5% and 30.7% still separate.

## Left for you to decide

None of these was changed. Each is either a product decision or a claim about something the study did not measure. None is urgent; they can wait.

### 1. Trap Detection and the other fade signals

The sharpest remaining tension. Trap Detection's inputs (long gamma, gamma strengthening, a static wall) are features the study found did not predict wall breaks. The study asked a related but different question (does a wall break within an hour of a test, not does a poke-through fail), so it does not disprove the signal. But the copy that calls a break "likely to fail" has no measurement behind it.

- `app/trap-detection/page.tsx`: "Flags failed breakouts as fade opportunities when dealer long gamma is reinforcing a reversal at a wall"; "Net GEX is rising ... Reinforces fade-trade behavior at the wall"; migration "invalidates the setup"; setups ending "fade the failed break with a short-call-spread or put-debit"
- `content/help/platform/advanced-signals-dashboard.md`: flags a break "as likely to fail when dealers are modeled long gamma and gamma is strengthening"; "buy the failed breakdown"
- `content/articles/eod-pressure-and-trap-detection.md`: "dealers tend to absorb breakouts"; "In a short-gamma book, breakouts tend to run rather than fade" (and its four translations)
- `app/trading-mistakes/Client.tsx` (mistake 05): Trap Detection scores "whether the current break is structurally likely to fail"
- `app/advanced-signals/page.tsx`: "Failed-breakout fades when dealer gamma reinforces reversal"; `app/my-dashboard/registry.tsx`: "Built to catch the fake before you chase it"
- The signal articles themselves, all with four translations: `eod-pressure-and-trap-detection.md` (about fifteen sentences: "a wall migrating ... suggests a real breakout", "In a short-gamma book, breakouts tend to run rather than fade", "accelerating flow into the breakout means real participants"), `eod-pressure-explained.md` ("EOD drift confirms a failed-breakout fade"), `squeeze-setup-positioning-trap-and-trap-detection.md` ("if the modeled wall has moved *away* from price, the breakout is more likely real")

Options: measure Trap Detection's hit rate the way the wall study was measured, or reword "likely to fail" to "flags a break running into these conditions" (the breakouts article now does this).

Same pattern, lower stakes:

- `app/gamma-vwap-confluence/page.tsx`: short gamma means the level "acts as a continuation breakout", long gamma means it "reverts"
- `app/gex-gradient/page.tsx`: "Structural resistance above - fade rips" / "Structural support below - buy dips"
- `components/SignalScorePanel.tsx`: "breakouts & momentum favored" / "fades & mean-reversion favored"
- `components/ForcedFlowRead.tsx`: "breakouts run, dips aren't bought" / "extremes get faded, expect the pin"
- `components/SignalScorePanel.tsx`: an extreme negative reading is a "compression regime where breakouts are less likely to sustain"
- Help and guides describing those same signals: `content/guides/signals-explained.md` (Confluence "Mean-rev (long gamma) / Continuation (short gamma)", "fade down under long gamma / accelerate up under short gamma"; GEX Gradient "a supportive floor" / "resistance overhead" in long gamma), `content/help/platform/advanced-signals-dashboard.md` ("In positive gamma, confluence reads are fades; in negative gamma, they're continuation reads"), `basic-signals-dashboard.md` (GEX Gradient's regime flip) and `score-line.md` (the regime flips the reading of Confluence, GEX Gradient and Trap Detection)
- Other signal articles with the same regime logic: `gamma-vwap-confluence-explained.md` ("in one regime the market runs from the level, and in the other it returns to it"), `squeeze-setup-explained.md` ("when the score is triggered, the breakout setup is more likely to be genuine"), `positioning-trap-explained.md` (whose factor table says long gamma "tends to dampen the trap thesis" while its sizing advice says the same trap in long gamma "can be a sharper trade"; those two contradict each other), and the put-wall example in `hedging-flow-explained.md`
- Hedging Flow structure labels, which also feed Gamma Weather (`content/help/platform/hedging-flow.md`): "Firming ... dips absorbed", "Capping ... rallies sold into", "Deteriorating ... moves more likely to accelerate", and "Structure says whether the book absorbs that push or amplifies it". Building or thinning gamma near spot is the gamma strengthening or being consumed that the study tested.

These describe how the signals are actually built. Rewording the copy alone would describe them wrongly, so the decision is whether to change the signal or the claim.

### 2. Labels that call walls resistance and support

These don't depend on the regime. "Tends to act as resistance" fits the S&P base rate (about 2 in 3) but overstates the Nasdaq one (about half) where the same string renders for QQQ, NDX or NQ.

- "Call Wall (Resistance)" / "Put Wall (Support)": `app/dashboard/page.i18n.ts`, `app/my-dashboard/tiles.i18n.ts`, `app/greeks-gex/page.tsx`, `content/help/platform/dashboard.md`, `content/help/platform/gex-summary.md`
- "Tends to act as resistance/support as dealers sell into rallies / buy into selloffs": `core/keyLevels.ts`, `app/dashboard/page.i18n.ts`, `app/greeks-gex/page.tsx`
- Indicator tooltips "tends to cap upside" / "tends to floor downside": `public/tradingview/zerogex-daily-gamma-levels.pine`, `public/thinkorswim/zerogex-daily-gamma-levels.thinkscript` (a change here means re-downloads for users)
- MCP field table, "Heaviest call gamma - the level that tends to cap" / "the level that tends to support" (`content/help/platform/mcp-integration.md`), served for every symbol including QQQ, NDX and NQ
- Chart legend, "the call wall red (resistance above), the put wall green (support below)" (`content/help/platform/reading-charts.md`)
- "a magnet and a brake" vs "an accelerant", and "price gets pinned toward them into expiry and often reverses off them": `components/GammaTerminalChart.tsx`, `app/chart/ChartClient.tsx`

The free gamma-levels pages already use neutral hints ("Heaviest call gamma above spot"); the same wording would work anywhere a label renders for every symbol.

### 3. Trade-instruction wording

Not a hold/break claim on its own, but it is the voice the Playbook just dropped ("Buy weakness into the wall").

- Landing: "Fade extremes, skip the middle."
- Article FAQ for the flip: "lean on mean reversion and fade extremes back toward the walls" (the FAQ file's own header says answers never give trade advice)
- Help: `signals-overview.md` "Don't fade rallies in negative gamma"; `composite-score.md` "buy the dip small, fade the extremes, don't chase" (core/regime.ts says this style was removed); `score-line.md` "a failed downside break you would buy"
- `app/chart/ChartClient.tsx`: "One glance tells you whether to fade extremes or ride momentum."
- Regime playbooks kept in the articles, all with translations: the "Best playbook" / "Worst playbook" rows of the `what-is-negative-gamma.md` table; "Positive GEX → favor fades ... Negative GEX → favor momentum and breakouts" (`what-is-gex-in-trading.md`); "Match the tactics to the sign" (`spx-net-gamma-exposure-today.md`, `zero-gamma-level-explained.md`); "the setups that work in one regime are usually the wrong setups in the other" (`how-to-read-a-gamma-flip.md`, `gamma-exposure-explained.md`); "Default playbook: fade the extremes" in the `how-to-trade-around-gamma-flip.md` example. The mechanism supports this advice, but the study found fades at walls did not work more often above the flip than below it.

### 4. Claims about things the study did not measure

Not contradicted, but no published number stands behind them either.

- Chart-level and VWAP confluence: "When chart-S/R and options-S/R agree, the level tends to be more reliable" (`options-support-and-resistance.md`); "the levels that tend to hold hardest" (`app/my-dashboard/registry.tsx`)
- Pinning near walls and max pain: "a pin is *more likely*" (`content/help/platform/max-pain.md`)
- Follow-through after a break: "trend continuation *becomes more likely*" (`content/help/platform/technicals.md`)
- A break of a held call wall as a sign "the regime itself is flipping" (`what-is-a-call-wall.md`, four places)
- "Why options-based S/R is sturdier than chart-based S/R" (a heading in `options-support-and-resistance.md`)
- "A level where SPX and SPY agree can matter more than the biggest wall on either chart alone" (`spy-vs-spx-gamma-levels.md`)
- "A wall indicates a reaction is more likely there than at a random strike" (article FAQ, `what-is-a-gamma-wall.md`). The `make gex-rank-backtest` harness, with its random-strike control, looks like the place to measure it.

### 5. Copy this repo cannot see

Action Card rationales, bot taglines, strategy-catalog summaries, the Range Break playbook payload, Gamma Weather labels and X post text come from the backend. They deserve the same pass there.

### 6. Translation drift found along the way

The translators rewrote every block this branch changed. Along the way they found older drift that has nothing to do with wall odds. It is not fixed here:

- `gamma-walls-explained` (all four languages): blocks 3-5 still hold the old "What is a gamma wall?" intro. Blocks 26-27 hold the migration section's heading, so the Width and Asymmetry paragraphs sit under the wrong heading and that heading appears twice. Block 41 repeats block 35 instead of translating "Two practical consequences".
- `options-support-and-resistance.es.md` block 6 says "notablemente más fiable" (markedly more reliable) where the English says "tends to be more reliable".
- All four languages: several blocks say "must" or "only works" where the English now says "tend to" or "modeled". In Spanish, for example: `gamma-walls-explained` blocks 9 and 22, `what-is-a-call-wall` block 9, `how-to-trade-around-gamma-flip` block 25 and `options-support-and-resistance` blocks 19, 22 and 30.
- `how-to-avoid-chasing-0dte.de.md` block 23 says a fade becomes "weit wahrscheinlicher" (far more likely) where the English says "more likely".
- English loose ends in `what-is-a-call-wall.md`: block 15 calls the two walls "symmetric opposites" right after block 6 says the put wall "is not a mechanical mirror", and block 6 ends in a fragment ("under the convention that local put inventory is modeled negative gamma").
- Fixed on this branch because it was in a changed block: `options-support-and-resistance` block 26 in Spanish and Italian was a stray copy of block 23, so those pages were missing the whole "Why does SPY reverse at these levels?" paragraph.

A per-language pass that retranslates any block whose meaning has drifted from the English would clear all of this.

### 7. The Playbook heading

"Where do we expect the underlying to go?" was kept. The cells now describe the hedging at the nearest wall rather than a direction. Something like "What is dealer hedging doing at the nearest wall?" would match them, if you want the heading to follow.
