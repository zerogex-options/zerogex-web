# Methodology & Validation

*What ZeroGEX measures, what it models, and how we test whether the models are any good.*

---

ZeroGEX is a derived-analytics product. It takes factual market data as input and produces modeled estimates of dealer positioning as output. Those are two different categories of thing, and this page keeps them separate on purpose.

The short version: **the option chain is observed. Dealer positioning is modeled.** Everything below explains where that line sits, what assumptions we apply to cross it, and how we hold ourselves accountable for them.

---

## 1. What ZeroGEX observes

These are factual market inputs. They are measured, not inferred:

- **Option chain snapshots** — every listed strike and expiration on the covered underlyings, captured continuously through the session.
- **Open interest** — the number of contracts outstanding at each strike and expiration. Standard listed-options open interest is tallied by the clearinghouse after the session and published for the *next* trading day. It is an end-of-session figure, not a live intraday one.
- **Options trades and quotes** — the real-time options tape: prints, sizes, and bid/ask context, used to classify aggressor side and infer intraday positioning changes between official open-interest updates.
- **Underlying prices** — real-time quotes and OHLCV bars for the underlying index or ETF.
- **Implied volatility** — solved from live option prices, maintained as a per-expiration volatility surface.
- **Contract terms** — strike, expiration, days to expiry, and contract multiplier.

**Greeks are computed, not received.** Per-contract delta, gamma, theta, and vega are calculated on every chain ingest through a Black-Scholes pipeline against the live implied-volatility surfaces. They are deterministic functions of the observed inputs above — reproducible from the same snapshot, and not a positioning assumption.

For the futures pages (/ES, /NQ), the levels are derived from the SPX and NDX option chains and carried onto a CME futures price axis. The futures price feed is a separate market-data entitlement from the options and equity feeds.

---

## 2. What ZeroGEX derives

Everything below this line is a model output. Each one is computed from the observed inputs, but each one also depends on the positioning convention described in section 3.

- **Dollar gamma exposure** per contract, using the industry convention `gamma × OI × 100 × S² × 0.01` — the dollar amount of underlying that would need to be traded per 1% move in the underlying under the model.
- **The spot-shift dealer gamma profile** — the core primitive. Every option's gamma is re-priced across a grid of hypothetical spot prices spanning roughly ±20% of spot in 0.25%-of-spot steps, then summed across the chain. Gamma is itself a function of spot, so the static snapshot value cannot be reused across the grid. Each contract is weighted by `min(1, DTE / 5 days)` so a same-day 0DTE concentration cannot dominate a multi-day regime read.
- **Net GEX at spot** — the value of that profile at today's price.
- **Gamma flip** — the price where the profile crosses zero, subject to three acceptance gates (interior, structural, and actionable-distance) and an adaptive grid ladder. Both readings come from the same curve, so the headline Net GEX and the spot-versus-flip regime cannot contradict each other.
- **Call wall and put wall** — the strikes carrying the heaviest gamma-weighted open interest on each side of spot. A wall is a concentration, not automatically support or resistance; whether it absorbs, repels, or accelerates depends on the modeled gamma sign and the surrounding flow.
- **Max pain** — the expiration price that would leave option holders with the least total value. This is an arithmetic property of the open-interest distribution, not a statement about what any market participant wants.
- **Vanna and charm exposures, pin strike, and the signal suite** — further derived layers built on the same profile and the same convention.

---

## 3. The dealer-positioning convention

Gamma exposure only becomes *dealer* gamma exposure once you decide which side of each contract the dealer is on. Public data does not decide that for you.

ZeroGEX applies the traditional convention used across the published GEX literature:

- **Calls are signed positive.**
- **Puts are signed negative.**

This corresponds to modeling dealers as **net long the calls customers overwrite** and **net short the puts customers buy for protection** — the standard characterization of retail and institutional index-option flow.

It is a defined, disclosed, consistently applied assumption. It is not a measurement. Applied uniformly over time it is a useful and stable basis for comparing chain structure session over session, which is what most of the product is actually for.

---

## 4. The limitation, stated plainly

> **Dealer positioning is modeled, not directly observed. Public options data does not identify the dealer side of every outstanding contract. ZeroGEX applies defined positioning assumptions to derive these analytics.**

Open interest tells you how many contracts exist at a strike. It does not tell you who is long and who is short. No public dataset resolves that contract by contract, for any vendor.

Practical consequences we think are worth stating:

- The convention is a population-level assumption. It can be wrong at individual strikes, and it is most likely to be wrong where customer flow is unusual — heavy put selling, call buying into a squeeze, large structured trades that invert the typical side.
- A gamma flip crossing is a change in the *model's* aggregate hedging tendency, not a verified switch in dealer behavior.
- Levels are probabilistic context, not mechanical triggers. Realized behavior still depends on actual flow, liquidity, volatility, and catalysts.

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

The clearest way to test a positioning convention is against positioning that does not rely on it.

Some exchanges publish open/close volume classified by participant type, including market-maker activity. Positioning reconstructed from that classification is a genuinely different estimate of the dealer book than a convention applied to aggregate open interest.

**We have built a research framework to compare the production positioning model against positioning reconstructed from exchange-classified market-maker activity.** The framework is designed so that the current production methodology can lose — that is the point of building it. If the attributed reconstruction produces a materially better read of subsequent market behavior, the production model changes.

To be explicit about status: **this research has not yet produced findings, and nothing on this site should be read as claiming the current methodology has been validated against market-maker-attributed data.** When there are results, they will be published here — including if they are unfavorable or inconclusive.

---

## What this means when you use the product

Use ZeroGEX levels the way a desk uses structural context: to know which regime you are in, where hedging flows are modeled to concentrate, and which setups the current structure favors or punishes. That is a real and durable edge over trading the same chart with no positioning context at all.

Do not use them as certainties about what dealers hold or what price must do. Nobody has that, and anyone selling it is describing a model without telling you.

---

## See also

- [GEX and the Gamma Flip — How ZeroGEX calculates them](/guides/gamma-flip-calculation-before-vs-after)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Data Coverage & Refresh](/help/platform/data-coverage)
- [Dealer Positioning tiles](/help/platform/dealer-positioning)

*Educational and informational only. ZeroGEX is not investment advice.*
