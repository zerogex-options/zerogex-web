# Chart-platform integrations

Four ways to get the ZeroGEX dealer-positioning levels onto a chart the trader
already has open, plus the `/integrations` hub that houses them.

| Platform | Route | Language | Updates | Tier | Source of record |
| --- | --- | --- | --- | --- | --- |
| TradingView | `/tradingview-indicator` | Pine Script v6 | manual | free | `frontend/public/tradingview/zerogex-daily-gamma-levels.pine` |
| thinkorswim | `/thinkorswim-indicator` | thinkScript | manual | free | `frontend/public/thinkorswim/zerogex-daily-gamma-levels.thinkscript` |
| NinjaTrader 8 | `/ninjatrader-indicator` | NinjaScript (C#) | auto | Pro | `frontend/public/ninjatrader/ZeroGexGammaLevels.cs` |
| Sierra Chart | `/sierra-chart-indicator` | ACSIL (C++) | auto | Pro | `frontend/public/sierrachart/ZeroGexGammaLevels.cpp` |

Per-platform detail lives in `docs/tradingview-indicator.md`,
`docs/thinkorswim-indicator.md`, `docs/ninjatrader-indicator.md` and
`docs/sierra-chart-indicator.md`.

Platforms that were asked for and are **not** in the table above are
assessed in `docs/integrations-ibkr-collective2-feasibility.md` — IBKR
(which cannot host a chart integration at all, because TWS runs no user
code) and Collective2 (which is a signals marketplace, not a chart
platform, and belongs to the signal engine rather than to this registry).

## The split is a platform constraint, not a pricing decision

This is the single most important thing to keep straight when writing copy for
any of these pages, because it is the question every visitor asks:

- **Pine Script and thinkScript are sandboxed.** Neither can open a network
  connection. No script on TradingView or thinkorswim — ours or anyone's — can
  fetch live levels. So those two are manual-entry, which also means there is
  nothing to gate: the script is inert without numbers, and the numbers are
  published free on the gamma-levels pages. Hence free.
- **NinjaScript is C# and ACSIL is C++.** Both can make HTTP calls, so those
  two poll `/api/v1/levels/{symbol}` and keep themselves current. Polling needs
  an API key, the key is a Pro entitlement, so those two are Pro.

`tests/integrations.test.ts` asserts `updates === 'auto'` if and only if
`tier === 'pro'`, so the two cannot drift apart quietly.

## The registry

`frontend/core/integrations.ts` is the source of record for the list. It feeds:

| Consumer | What it takes |
| --- | --- |
| `components/Navigation.tsx`, `components/Header.tsx` | `INTEGRATIONS_HUB` — one menu entry, not four |
| `components/Footer.tsx` | `INTEGRATIONS_HUB` — one link in the Platform column |
| `app/integrations/page.tsx` | `INTEGRATIONS`, regrouped by `updates` |
| `components/IntegrationsStrip.tsx` | `otherIntegrations(...)` — the cross-link cards |
| each landing page | `integrationById(...)` for its own crumb and path |

Adding a platform is: append a registry entry, add `app/<route>/page.tsx`, add
its `PlotOn<Platform>.tsx` section, drop the source under `frontend/public/`,
and add it to `scripts/integration-assets-manifest.js` if it needs a hashed URL.

Two consumers **cannot** import the registry and repeat the routes as literals:

- `frontend/core/auth.ts` (`PUBLIC_ROUTE_PATTERNS`) — it is the edge
  middleware's module and is imported by tests running under node's
  `--experimental-strip-types` loader, which resolves extensionless relative
  imports differently than the bundler. An import there breaks both.
- `frontend/next-sitemap.config.mjs` — loaded as plain ESM outside the Next
  build, so the `@/…` alias does not resolve.

`tests/integrations.test.ts` asserts both lists agree with the registry, so the
duplication is checked rather than trusted.

## Brokers are a separate list

`frontend/core/brokerConnections.ts` answers the question the registry does
not: **"does this work with my broker?"** In practice that is asked about
Interactive Brokers and almost nothing else, and the honest answer has two
halves that are wrong given apart:

1. There is no IBKR integration and there cannot be one. Trader Workstation
   runs no user code — no scripting language, no way to draw on its charts
   from outside — so nobody can install an indicator into TWS.
2. Both auto-updating integrations already reach an IBKR account anyway.
   NinjaTrader 8 connects through the TWS API; Sierra Chart has its own
   Interactive Brokers trading service on that same API. Either one runs our
   study, because the study fetches levels from `/api/v1/levels/{symbol}` over
   HTTP and never reads the platform's quotes.

Give only (1) and a customer we could serve today hears "no". Give only (2)
and the next question is "so where's the IBKR download?".

A broker is **not** an `Integration` and must not be added to the registry: an
entry there describes a platform that runs our code, and every field on it
(`language`, `updates`, `tier`) describes what that platform's scripting
runtime permits. IBKR would need a row with no language, no script and no
landing page — and it would put a fifth card on the hub that someone clicks
expecting a download.

| Consumer | What it takes |
| --- | --- |
| `components/BrokerConnectionNote.tsx` | the whole list — one rendering, two modes |
| `app/integrations/page.tsx` | `<BrokerConnectionNote />` under the auto-updating group, listing every route |
| the two Pro landings | `<BrokerConnectionNote integration="…" />`, listing only their own |
| `app/help/faqs/Client.tsx` | `api-interactive-brokers`, written out (the FAQ is a flat data file that imports nothing) |

`tests/brokerConnections.test.ts` asserts every integration a broker names
exists in the registry and is auto-updating — a manual-entry script is typed in
by hand and cannot care what the chart is connected to — and that each landing
a broker routes through actually renders the note.

The two builds that would put ZeroGEX data *inside* IBKR (levels pushed as
Client Portal price alerts) or publish the signal engine's book to a signals
marketplace (Collective2) are assessed and deferred in
`docs/integrations-ibkr-collective2-feasibility.md`.

## Why the menus collapsed to one link

The sidebar's "More" group, the mobile header's copy of it, and the footer's
Platform column each listed every platform by name. At two that was tolerable;
at four the group would have been mostly brand names, and a fifth would have
made it unreadable. The hub is also where someone who does not yet know which
platform script they want has to land anyway — previously no such page existed,
and each landing only ever cross-linked the one other page.

The four landings keep their own URLs (they rank on
"<platform> gamma levels indicator" searches and are linked from the published
TradingView script, from X/StockTwits, and from the docs). They are reachable
from the hub, from the cross-link strip on every sibling landing, from the
gamma-levels pages, from search, and from the sitemap — just not from the
menus. Each also declares `/integrations` as its breadcrumb parent, which is
what tells Google they are a set with a parent rather than four loose pages.

## Cache-busting

`frontend/public/` is served through Cloudflare with a 4-hour cache that
`make deploy` never purges, so a fixed URL can hand someone the previous build
for hours after a new one ships. Two generators hash the bytes into the
filename so a new build is a new URL:

- `scripts/ninjatrader-manifest.js` → `core/ninjaTraderManifest.ts` (also
  verifies and conditionally publishes the NT8 export archive)
- `scripts/integration-assets-manifest.js` → `core/integrationAssets.ts`
  (the thinkorswim and Sierra Chart sources)

Both manifests are **committed** so a plain `npm run build` needs no pre-step,
and both have a test asserting the committed hash still matches the tracked
source. `make build`, `make rebuild` and `make deploy` all run both generators.

The TradingView `.pine` deliberately has no hashed URL: the published
TradingView script is the artifact users actually install, and the file in
`public/` is a reference copy.

## Where the levels come from

All four draw the same numbers, from the same place:

- free/manual: the trader copies them off `/spx-gamma-levels` (or the SPY, QQQ,
  NDX, ES, NQ pages), which are public and delayed roughly 15 minutes.
- Pro/auto: the study calls `GET /api/v1/levels/{symbol}` on the ZeroGEX API,
  which is `gex`-scoped and returns derived analytics only — never raw
  per-contract quotes.
