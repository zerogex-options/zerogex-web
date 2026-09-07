# Methodology & Validation

*What ZeroGEX observes, what it computes, what it models, and how we test whether the models are any good.*

---

ZeroGEX is a derived-analytics product. It takes factual market data as input and produces modeled estimates of dealer positioning as output. Those are two different categories of thing, and this page keeps them separate on purpose.

The short version: **the option chain is observed. Trade direction is classified. Dealer positioning is modeled.** Everything below explains where those lines sit, what assumptions we apply to cross them, and how we hold ourselves accountable for them.

---

## 1. What ZeroGEX observes and mechanically computes

ZeroGEX starts with observed market data and applies mechanical calculations to it. Neither step identifies who owns an option position.

**Observed market data:**

- **Option chain snapshots** — every listed strike and expiration on the covered underlyings, captured continuously through the session.
- **Open interest** — the number of contracts outstanding at each strike and expiration. Standard listed-options open interest is tallied by the clearinghouse after the session and published for the *next* trading day. It is an end-of-session figure, not a live intraday one.
- **Options trades and quotes** — the real-time options tape: execution prices, sizes, and bid/ask context.
- **Underlying prices** — real-time quotes and OHLCV bars for the underlying index or ETF.
- **Contract terms** — strike, expiration, days to expiry, and contract multiplier.

**Mechanically computed from those inputs:**

- **Aggressor classification** — each print is classified as buyer-initiated or seller-initiated from its execution price relative to the contemporaneous bid/ask, a Lee-Ready-style rule. Prints inside the spread, the opening auction, and prints with no usable quote are left unclassified rather than assigned a side. This estimates which side *initiated* a trade. It does not identify the participant type on either side.
- **Implied volatility** — solved from live option prices and maintained as a per-expiration volatility surface.
- **Greeks** — per-contract delta, gamma, theta, and vega, calculated on every chain ingest through a Black-Scholes pipeline against those surfaces. They are deterministic functions of the observed inputs — reproducible from the same snapshot, and not a positioning assumption.

These are three different layers, and the distinction matters: observed market data, classified trade direction, and modeled dealer positioning are not the same thing. Any positioning inference built from aggressor-classified flow is a separate model assumption, not an observed fact. Section 4 says so again where it counts.

For the futures pages (/ES, /NQ), the levels are derived from the SPX and NDX option chains and carried onto a CME futures price axis. The futures price feed is a separate market-data entitlement from the options and equity feeds.

---

## 2. What ZeroGEX derives

Everything below this line is a model output. Each one is computed from the inputs above, but each one also depends on the positioning convention described in section 3.

- **Dollar gamma exposure** by option series, using the industry convention `gamma × OI × 100 × S² × 0.01` — the modeled dollar sensitivity of the aggregate open interest in that series to a 1% move in the underlying.
- **The spot-shift dealer gamma profile** — the core primitive. Every option's gamma is re-priced across a grid of hypothetical spot prices spanning roughly ±20% of spot in 0.25%-of-spot steps, then summed across the chain. Gamma is itself a function of spot, so the static snapshot value cannot be reused across the grid. Each contract is weighted by `min(1, DTE / 5 days)` so a same-day 0DTE concentration cannot dominate a multi-day regime read.
- **Net GEX at spot** — the value of that profile at today's price.
- **Gamma flip** — the price where the profile crosses zero, subject to three acceptance gates (interior, structural, and actionable-distance) and an adaptive grid ladder. Both readings come from the same curve, so the headline Net GEX and the spot-versus-flip regime cannot contradict each other.
- **Call wall and put wall** — the strikes carrying the heaviest gamma-weighted open interest on each side of spot. A wall is a concentration, not automatically support or resistance; whether it absorbs, repels, or accelerates depends on the modeled gamma sign and the surrounding flow.
- **Max pain** — the expiration price that would leave option holders with the least total value. This is an arithmetic property of the open-interest distribution, not a statement about what any market participant wants.
- **Vanna and charm exposures, pin strike, and the signal suite** — further derived layers built on the same profile and the same convention.

---

## 3. The dealer-positioning convention

Gamma exposure only becomes *modeled dealer* gamma exposure once an assumption is made about which side of the outstanding contracts dealers hold. Standard option-chain and open-interest data do not decide that.

ZeroGEX applies the traditional convention used across much of the published GEX literature:

- **Calls are signed positive.**
- **Puts are signed negative.**

This is a common structural heuristic. It roughly corresponds to dealers being net long the calls customers overwrite and net short the puts customers buy for protection. It is not an empirical claim that every call is dealer-long, every put is dealer-short, or that the pattern holds at every strike or on every session.

It is a defined, disclosed, consistently applied assumption. It is not a measurement. Applied uniformly over time it is a stable basis for comparing chain structure session over session, which is what most of the product is actually for.

---

## 4. The limitation, stated plainly

> **Dealer positioning is modeled, not directly observed. Standard option-chain and open-interest data does not identify the dealer side of every outstanding contract. ZeroGEX applies defined positioning assumptions to derive these analytics.**

Open interest tells you how many contracts exist at a strike. It does not tell you which participant categories are long or short them.

Some proprietary exchange datasets go materially further. They classify executed volume by participant type (customer, professional customer, broker-dealer, market maker), by buy/sell action, and in some cases by open/close position effect. Those datasets support a materially richer reconstruction of market-maker positioning. They still do not provide a complete, consolidated, continuously observable ledger of every dealer's outstanding inventory across the market: position levels have to be reconstructed from flows, and the reconstruction depends on venue coverage, history depth, and participant classification. We say "reconstruction" rather than "observation" for that reason, and we are testing the approach rather than asserting it (section 6).

A separate distinction applies to the options tape, and it is an easy one to blur: **aggressor classification is not participant attribution.** A buyer-initiated trade does not by itself establish that a customer bought or that a dealer sold. A seller-initiated trade does not establish that a customer sold or that a dealer bought. Where a print sits relative to the quote says who initiated; it does not say who was on either side.

Practical consequences we think are worth stating:

- The convention is a population-level assumption. It can be wrong at individual strikes, and it is most likely to be wrong where customer flow differs from the conventional pattern — heavy put selling, call buying into a squeeze, large structured trades that invert the typical side.
- Aggressor-classified flow measures the direction of aggressive trading. Turning that flow into a statement about dealer inventory requires an additional assumption about who was on the other side, and anything ZeroGEX builds that way is labeled inferred, not observed.
- A gamma flip crossing is a change in the *model's* aggregate hedging tendency, not a verified switch in dealer behavior.
- Levels are probabilistic context, not mechanical triggers. Realized behavior still depends on actual positioning, flow, liquidity, volatility, and catalysts.

None of this makes the output arbitrary. A consistently applied model with disclosed assumptions is a legitimate analytical instrument — it is how implied volatility, DIX, and most of the derived-analytics category work. It just is not a ledger of dealer books, and we will not describe it as one.

---

## 5. How ZeroGEX evaluates models

Our position is that a positioning model earns its place by measurement, not by plausibility. The standards we hold ourselves to:

- **Compare against observed market outcomes.** A model's value is whether its output relates to what price actually did — not whether the narrative sounds right.
- **Compare against appropriate baselines.** A signal has to beat a reasonable null: the unconditional base rate, a simpler construction, or the existing production method. "Better than nothing" is not a result.
- **Use adequate samples.** Index-option regimes are serially correlated and seasonal. Small samples in a single regime produce confident nonsense.
- **Allow results to be inconclusive.** Some questions do not resolve at the sample sizes available. Reporting that honestly is a result, and we treat it as one.
- **Change the methodology when the evidence supports it.** We have done this: the gamma flip was migrated from a cumulative-by-strike approximation to the spot-shift dealer gamma profile after our own historical data showed the old level sticking flat for hours at a wall. That change is documented in full, including what was wrong before, in [GEX and the Gamma Flip — How ZeroGEX calculates them](/guides/gamma-flip-calculation-before-vs-after).

The same standard applies to degraded data. When the option chain is too degraded for the flip resolver to find a qualifying crossing, ZeroGEX reports the flip as unresolved and emits a health warning rather than fabricating an edge value or silently carrying forward a stale one. A number we cannot stand behind does not get printed.

---

## 6. Research into richer attribution

The clearest way to test a positioning convention is against an independently constructed estimate that does not rely on it.

Proprietary exchange datasets classify options activity by participant type, buy/sell action, and open/close position effect. That is materially richer evidence about market-maker activity than aggregate open interest or bid/ask aggressor classification alone.

**We have built a research framework that compares three things on identical sessions and identical outcomes:** the current production positioning model; positioning inferred from our own aggressor classification under the common "the passive side is a market maker" assumption; and Market-Maker Attributed GEX reconstructed from exchange-classified market-maker activity. The attributed measure is still a reconstruction, not an observation of dealer inventory: its quality depends on participant classification, exchange coverage, enough history to build inventory from a known zero, and the contracts that can be matched and priced.

The framework deliberately reuses the same gamma calculations, spot-shift profile, gamma-flip resolver, wall methodology, and market outcomes across all three. The variable under test is the positioning attribution itself, and the framework is designed so that the current production methodology can lose. It also tests the aggressor assumption directly: how often the exchange-classified market-maker population was actually on the side our classification would assume, bucket by bucket. If participant-attributed positioning produces a materially better and repeatable relationship with subsequent market behavior, the production methodology changes.

To be explicit about status: **the research pipeline has been built, but this research has not yet produced findings.** No comparison against real participant-attributed exchange data has been run, and nothing on this site should be read as claiming the current methodology has been validated against market-maker-attributed positioning. When there are results, they will be published here — including if they are unfavorable or inconclusive.

---

## What this means when you use the product

Use ZeroGEX levels as structural context: a consistent map of modeled gamma regimes, concentrations, and potential hedging pressure, read alongside price action, observed flow, liquidity, volatility, and catalysts. That is useful context the same chart gives you none of on its own.

Do not use them as certainties about what dealers hold or what price must do. ZeroGEX does not claim to observe a complete dealer book. Where richer participant-attributed data is available, our approach is to test whether it materially improves the model rather than to assume that either methodology is right.

---

## See also

- [GEX and the Gamma Flip — How ZeroGEX calculates them](/guides/gamma-flip-calculation-before-vs-after)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Data Coverage & Refresh](/help/platform/data-coverage)
- [Dealer Positioning tiles](/help/platform/dealer-positioning)

*Educational and informational only. ZeroGEX is not investment advice.*
