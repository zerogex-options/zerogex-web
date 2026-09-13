# IBKR and Collective2 integrations — feasibility

**Question:** we ship chart integrations for TradingView, thinkorswim,
NinjaTrader 8 and Sierra Chart. Can we add Interactive Brokers and
Collective2?

**Answer: yes to both, but neither is a fifth and sixth entry in
`frontend/core/integrations.ts`.** They are two different shapes of thing,
and only one of the two is mostly engineering.

- **IBKR cannot host a chart integration at all.** TWS has no user-scripting
  language — custom indicators cannot be added to it, by design. The axis the
  whole registry turns on (`updates: 'auto' | 'manual'`, which falls straight
  out of what the host platform's scripting language is permitted to do) has
  no value for IBKR, because IBKR has no scripting language. Three other
  IBKR-shaped things *are* possible, and one of them already works today and
  costs a paragraph of copy.
- **Collective2 is not a charting platform.** It is a signals marketplace. An
  integration there means publishing the signal engine's trade book as a C2
  strategy — a distribution and business decision about
  `oa:src/signals/portfolio_engine.py`, not a levels-product decision. It is
  the technically easier of the two and the strategically larger.

Both also add channels to audit finding **F8**, which is open
(`oa:docs/compliance/market-data-licensing-audit-2026-09-02.md:170`). See §3.

**Status:** assessment only. No production code written. References are
`file:line` into this repo (`frontend/…`, `docs/…`) or `zerogex-oa`
(prefixed `oa:`), as of the commit this document was added in.

---

## 1. Interactive Brokers

### 1.1 Why the existing mold does not fit

`docs/integrations.md` states the split honestly, and it is the reason the
question has a hard answer: Pine Script and thinkScript are sandboxed with no
network access, so those two are manual-entry; NinjaScript (C#) and ACSIL
(C++) can make HTTP calls, so those two poll `oa:/api/v1/levels/{symbol}` and
keep themselves current. Both halves of that sentence assume the platform
runs user code.

TWS runs none. Its chart studies are a fixed built-in library; there is no
user-written indicator, no scripting language, and no supported way to draw an
arbitrary horizontal line on a TWS chart from outside it. The two IBKR
programmatic surfaces — the TWS socket API and the Client Portal Web API —
both sit *outside* the chart: market data, orders, account state, alerts.
Neither draws.

So `components/PlotOnInteractiveBrokers.tsx` cannot be written, in the sense
the other four `PlotOn…` components mean it. That is the finding, and no
amount of scope will change it.

### 1.2 What is possible instead — three options

**Option A — IBKR through NinjaTrader or Sierra Chart. Ships today, zero
code.**

Both of our auto-updating integrations connect to IBKR already. NinjaTrader 8
connects to an IBKR account through TWS or IB Gateway; Sierra Chart has a
first-class Interactive Brokers trading service. An IBKR customer can install
our NinjaScript indicator or our ACSIL study right now, point it at their IBKR
connection, and get the levels on the price they trade.

This works because our indicator does not care where the bars come from. It
reads `Instrument.MasterInstrument.Name`
(`frontend/public/ninjatrader/ZeroGexGammaLevels.cs:386-407`), which is
NinjaTrader's own normalized root — `"ES"` off an `ES 09-26` chart, with MES
and MNQ folded onto their full-size contracts — not the provider's symbol. The
levels themselves come from our API over HTTP, not from the platform's feed.
Provider-independent by construction.

Two caveats worth putting in the copy rather than discovering in support:
NT8 requires TWS or IB Gateway running alongside it, and IBKR's own market
data is snapshot ticks with thin history, so many NT8 users pair a separate
data feed with IBKR execution. Neither affects us — we draw horizontal levels
fetched from our API, and we never touch the platform's tick quality.

**Cost:** a paragraph on `/integrations`, on the two Pro landings, and in the
FAQ. No registry entry — IBKR is a *connection*, not a platform, and modelling
it as an `Integration` would be the first dishonest row in that table.

**Option B — the levels as IBKR price alerts. A real build.**

IBKR's Client Portal Web API has a create-alert endpoint. We could push the
four levels into a user's IBKR account each morning as price alerts, so IBKR
pings them on a Gamma Flip cross. This is the only path that puts ZeroGEX data
*inside* IBKR.

What it costs is the thing to weigh. It is a hosted service, not a
downloadable script — the first integration we would *operate* rather than
ship. It needs an authenticated IBKR session per user (Client Portal Gateway
or OAuth), a daily reconcile that deletes yesterday's alerts and creates
today's, and a per-account alert budget. It also inverts the support model:
all four existing integrations fail on the user's machine, where the user can
see it and restart it. This one fails on ours, silently, and the customer
finds out by not being alerted.

**Verdict:** genuinely useful, genuinely a product, and not "an integration"
in the sense the other four are. Not worth starting before Option A
establishes there is IBKR demand to serve.

**Option C — IBKR as a market-data vendor.** Already evaluated and rejected:
`oa:docs/design/realtime-market-data-vendors.md:76` — market-data lines capped
around 100, business accounts pay professional fees, and no redistribution.
Listed here only because "IBKR integration" can mean this, and the answer is
already on file.

---

## 2. Collective2

### 2.1 What C2 actually is

Not a chart platform. C2 is a marketplace: a strategy manager publishes
trades, C2 tracks that strategy's record independently, and subscribers pay a
monthly fee and optionally auto-trade it at a connected broker. Managers are
paid a flat fee per subscriber — no performance fee, no fund entity.

So a "Collective2 integration" is **us becoming a strategy manager**. The
artifact is not a script a customer installs. It is a ZeroGEX strategy listed
on C2, and its public record is the engine's live trade log.

### 2.2 We already have the expensive half

C2 wants a stream of orders plus an auditable history. The signal engine
already produces exactly that.

| What C2 needs | What exists | Where |
| --- | --- | --- |
| Orders with side, quantity and instrument, emitted at decision time | `_open_position` / `_close_trade`, each transaction recorded independently | `oa:src/signals/portfolio_engine.py:1731`, `:1634` |
| Options, including multi-leg | the engine trades option legs and spreads; C2 supports spreads, butterflies and condors | `oa:src/signals/portfolio_engine.py:553-557` |
| A closed-trade track record with win rate and P&L | `GET /api/signals/trades-history` | `oa:src/api/routers/trade_signals.py:96` |
| Current open positions | `GET /api/signals/trades-live` | `oa:src/api/routers/trade_signals.py:159` |
| Tight risk controls (required for C2Star certification) | daily-loss kill switch, max portfolio heat, drawdown-aware sizing, time stops, min-hold | `oa:src/signals/portfolio_engine.py:25-86` (config block) |

Every row on the left is already satisfied on the right. That is unusual and
it is the strongest argument for C2 over any other distribution idea on the
list.

### 2.3 The work that is actually left

C2 exposes two generations of signal entry: `POST
https://collective2.com/world/apiv3/submitSignal` (API v3 — `apikey`,
`systemid`, signal body) and `POST
https://api4-general.collective2.com/Autotrade/NewAutotradeOrder` (API4 —
`StrategyId`, `OrderType`, `Side`, `OrderQuantity`, `Limit`, `TIF`, and a
`C2Symbol` object of `FullSymbol` + `SymbolType`). Either is a
straightforward authenticated POST. The integration is not hard; four
specific things in it are.

1. **Symbol translation.** We store OCC/OSI strings —
   `"SPY 250425C00680000"`, per the `/trades-live` contract at
   `oa:src/api/routers/trade_signals.py:159`. C2 does not use the 21-character
   OSI string; it uses its own options symbology (root, 2-digit year, day,
   a single month/put/call code, then a trimmed strike). A translation layer
   with a test per instrument class is the bulk of the mechanical work, and
   getting it wrong means subscribers trade the wrong contract.

2. **Exactly-once emission.** `PortfolioEngine` is a *reconciler*, not an
   event stream: it recomputes a target portfolio each cycle and executes the
   minimum set of transactions to reach it (`oa:src/signals/portfolio_engine.py:1-14`).
   Posting to C2 needs a per-transaction dedupe key and a persisted ledger of
   what was already sent, so a restart mid-cycle does not double-send.
   `SIGNALS_ENTRY_DEDUPE_WINDOW_SECONDS` guards our own book; it does not
   guard C2's.

3. **Two P&L numbers that will not agree.** `oa:src/signals/execution.py`
   fills long legs at the ask plus a slippage fraction. C2 marks its own
   fills, and auto-trading subscribers get real ones at their broker. Our
   published record and C2's will diverge, and C2's is the one the public
   sees and the one prospective subscribers judge. Decide before launch which
   number we quote on our own site.

4. **Latency.** Auto-trade subscribers trade on signal receipt. A decision
   made on the ~60 s analytics tick and posted afterwards is fine for swing
   entries and marginal for 0DTE. Worth measuring on the live book before
   publishing a strategy with 0DTE in it.

### 2.4 The decisions that are not engineering

- Publishing a strategy means subscribers trade real money on our output.
  That is a different posture from analytics-with-no-advice, and the terms and
  disclaimer copy should be reviewed **before** the build, not after it.
- The signal engine's public surface is Pro-gated today
  (`frontend/core/auth.ts:112`) and its book is internal paper trading.
  Publishing to C2 makes that record externally audited and permanent —
  including the drawdowns. That is the entire value of C2 and also the entire
  risk: a bad quarter cannot be unpublished.
- **The reverse direction is cheaper and may be worth doing first.** C2 has
  thousands of strategy managers, and they are an exact match for the API's
  customer profile — people who already trade systematically and would pay for
  a dealer-positioning input. A "use ZeroGEX levels in your C2 strategy"
  partner page needs no C2 integration at all, and no strategy of our own.

---

## 3. Both land on F8

`oa:docs/compliance/market-data-licensing-audit-2026-09-02.md:170` rates the
four existing chart integrations as an **undeclared onward distribution
channel** — High, ≤ 60 days — on the grounds that every vendor agreement
treats onward distribution into another vendor's environment as its own
declarable channel. Its remediation asks for a one-page inventory of every
channel data leaves through, as an exhibit for any licence application.

Both proposals here add channels to that inventory:

- **IBKR Option B** pushes derived levels into a broker account, per user.
- **Collective2** republishes derived output to C2's audience and, through
  auto-trade, onward into subscribers' brokerage accounts. It would be the
  widest distribution channel we have.

Neither is blocked by F8 on its face — both carry derived analytics, not
quotes, which is the same footing the existing four stand on. But both belong
on the F8 inventory from the day they are specced rather than the day they
ship, because the alternative is an inventory that is wrong before it is
written. IBKR **Option A** adds no channel at all: it is the existing
NinjaTrader and Sierra Chart channels, already inventoried, reaching one more
category of user.

---

## 4. Recommendation

1. **Now, about a day:** ship Option A. Say plainly on `/integrations`, on the
   two Pro landings and in the FAQ that IBKR is supported through NinjaTrader
   8 or Sierra Chart. It is true today and it turns "do you support IBKR?"
   from a no into a yes without a line of new integration code.
2. **Decide before any C2 code is written:** whether ZeroGEX publishes a
   trading strategy at all (§2.4). If yes, C2 is a well-scoped build against
   an engine that already exists — the symbol layer and the idempotent
   emitter are most of it.
3. **Cheap either way, independent of (2):** the C2-strategy-manager-as-API-
   customer page. No integration, no strategy, no compliance surface.
4. **Not now:** IBKR price alerts (Option B). Revisit if Option A produces
   real IBKR volume.
