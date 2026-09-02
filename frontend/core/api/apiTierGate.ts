// Consumer-tier authorization map for BFF-proxied data endpoints.
//
// WHY THIS EXISTS: nginx routes every browser `/api/*` request to the Next.js
// BFF (core/api/proxy.ts), which forwards to the FastAPI backend with a single
// shared, full-access key. The backend authenticates that key but does NOT
// enforce the END-USER's subscription tier (its `scopes` are B2B key-licensing
// bundles, off by default, keyed to the caller key — see the zerogex-oa
// security.py docstring: "tier gating currently lives in the web proxy layer").
// The Next middleware only tier-gates PAGES and explicitly skips `/api/*`. So
// without this, any caller who can reach same-origin `/api/*` — including an
// anonymous visitor — could pull premium analytics by calling the API directly,
// bypassing the page paywall entirely.
//
// This module is the single source of truth for which BFF-proxied prefixes are
// premium and at what tier. It is a pure function (no session, no I/O) so it can
// be unit-tested; proxy.ts resolves the session and enforces the result.
//
// SAFETY MODEL — denylist, not allowlist. Only listed prefixes are gated;
// anything unmatched passes through exactly as before (fail-OPEN). That means a
// new endpoint is never silently broken by this gate — the cost is that a new
// PREMIUM endpoint must be added here to be protected (same discipline the
// backend's per-router scope wiring already requires). Public/delayed content is
// served server-side via serverApiGet (which never traverses this proxy), so
// gating here cannot break the free preview, gamma-levels, or the SSR permalink
// pages. See the reconnaissance in the audit for the full page→endpoint map.

// The access a path requires. 'public' is an explicit pass (used to punch a hole
// through a broader premium prefix, e.g. the public shared-backtest permalink
// under the otherwise-pro /api/backtest). basic|pro|admin require a session whose
// tier ranks at least that high. A null result (no rule matched) also passes.
export type ApiAccess = 'public' | 'basic' | 'pro' | 'admin';

// A rule matches either by path prefix (the common case) or by an exact regex
// — the latter for carve-outs a prefix cannot express, e.g. a per-user action
// nested UNDER a premium collection (`/api/tradeworkz/bots/{id}/follow`).
type Rule =
  | { prefix: string; access: ApiAccess }
  | { pattern: RegExp; access: ApiAccess };

// ORDERED, first-match-wins. More-specific prefixes MUST precede the broader
// prefix they carve out of. Rationale for each tier is in the audit; the short
// version: every prefix here is fetched CLIENT-SIDE only by pages of at least
// the given tier, and never by anonymous chrome or the SSR/delayed public path.
const RULES: readonly Rule[] = [
  // Public shared-backtest report permalink — client-fetched on an anonymous
  // page. Must be exempt even though it sits under the pro /api/backtest prefix.
  { prefix: '/api/backtest/runs/shared', access: 'public' },

  // TradeWorkz fleet administration (simulate / inject-test-event / reset-fleet /
  // provision). Rendered only behind an `isAdmin` check in the UI; enforce it.
  { prefix: '/api/tradeworkz/admin', access: 'admin' },

  // TradeWorkz per-user actions that live UNDER the premium /bots collection.
  // Follow/unfollow is a preference, not signal data, and /account/notifications
  // (open to ANY logged-in tier) calls it — including for a member who has since
  // downgraded off Pro and still needs to unfollow. Must precede the /bots rule.
  { pattern: /^\/api\/tradeworkz\/bots\/[^/]+\/follow$/, access: 'public' },

  // TradeWorkz signal product — the Pro-only /trading-signals page is the sole
  // client-side consumer of every one of these (bot roster + detail, per-bot
  // trades / equity curve / metrics, fleet summary, leaderboard, equity curves,
  // performance trend). They were unmapped, so the whole Pro bot surface was
  // readable by anyone who could reach same-origin /api/*. The /me/* prefs
  // (follows, feed) stay unlisted — per-user state, any logged-in tier.
  { prefix: '/api/tradeworkz/bots', access: 'pro' },
  { prefix: '/api/tradeworkz/summary', access: 'pro' },
  { prefix: '/api/tradeworkz/leaderboard', access: 'pro' },
  { prefix: '/api/tradeworkz/equity-curves', access: 'pro' },
  { prefix: '/api/tradeworkz/performance-trend', access: 'pro' },

  // Signals: the advanced-signal surface and Trade Bias are pro-exclusive (only
  // pro pages fetch them). The composite score / action / basic components under
  // /api/signals are a Basic entitlement (fetched by the Basic /my-dashboard),
  // so the broad /api/signals rule is `basic`. trade-bias-history is a distinct
  // path segment from trade-bias, hence its own explicit rule.
  { prefix: '/api/signals/advanced', access: 'pro' },
  { prefix: '/api/signals/trade-bias', access: 'pro' },
  { prefix: '/api/signals/trade-bias-history', access: 'pro' },
  { prefix: '/api/signals', access: 'basic' },

  // Backtesting platform — pro (the /api/backtest/runs/shared exemption above
  // already peeled off the one public path).
  { prefix: '/api/backtest', access: 'pro' },

  // Derived analytics surfaces — all Basic tool pages. The delayed/public
  // versions of this data are server-rendered (serverApiGet), so they never hit
  // this proxy and are unaffected.
  { prefix: '/api/gex', access: 'basic' },
  { prefix: '/api/flow', access: 'basic' },
  { prefix: '/api/forced-flow', access: 'basic' },
  { prefix: '/api/replay', access: 'basic' },
  { prefix: '/api/option', access: 'basic' },
  { prefix: '/api/max-pain', access: 'basic' },
  { prefix: '/api/technicals', access: 'basic' },

  // Volatility gauge is a Basic feature (/volatility) and is only fetched
  // client-side by Basic pages — carve it out of the otherwise-public
  // /api/market/* prefix (whose quote/session-closes calls are the anonymous
  // header chrome and must stay open). Everything else under /api/market is left
  // unlisted → passes through.
  { prefix: '/api/market/volatility', access: 'basic' },

  // Underlying OHLC bars and open interest. Both were unmapped, which is the
  // squarest form of the bypass this module exists to stop: the free pages that
  // show this data (/chart, /spx-gamma-levels) render it SERVER-side through
  // serverApiGet with a 900s ISR cache, so "free" means ~15-minute-stale — while
  // an anonymous GET to the same path through this proxy returned it LIVE
  // (proxy.ts fetches no-store). Client-side these are fetched only by Basic
  // pages: /gamma-exposure, /my-dashboard, /max-pain, /smart-money, /volatility,
  // /gex-heatmap, /gex-strike-profile. Safe to gate because every public consumer
  // of GammaTerminalChart passes `delayed`/`snapshot`, which sets `live = false`
  // and disables the useMarketHistorical poll entirely.
  { prefix: '/api/market/historical', access: 'basic' },
  { prefix: '/api/market/open-interest', access: 'basic' },

  // NOT gated, deliberately: /api/market/quote and /api/market/session-closes are
  // the anonymous header chrome, and /api/market/session-levels is client-fetched
  // by MarketMakerExposures on the PUBLIC /replay/* pages for non-index symbols
  // (premarket / prior-session high-low overlays). Gating that one would degrade
  // a public page, and the levels themselves are not a paid surface.
];

// Segment-aware prefix match: `path` is covered by `prefix` when it equals the
// prefix or is a descendant path (prefix + '/'). Avoids a bare startsWith that
// would let "/api/gexfoo" match "/api/gex". Query strings are already stripped
// (proxy passes the pathname), so no '?' handling is needed here.
function covers(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + '/');
}

// Strip an API version segment so RULES stays version-agnostic.
//
// The backend serves the SAME endpoints under `/api/gex/summary` (v1) and
// `/api/v2/gex/summary` (v2, the freshness-envelope surface). Every prefix in
// RULES is written in the v1 form and `covers()` matches whole segments, so a
// versioned path matches NOTHING — and because this gate is deliberately
// fail-open, "nothing matched" means "pass". Without this, adding a
// `/api/v2/[...rest]` proxy would hand every premium surface to any caller:
// /api/v2/signals/advanced/*, /api/v2/backtest/*, /api/v2/gex/* and the rest
// would all resolve to `null` → ungated. The upstream cannot save us — it
// authenticates the shared BFF key and enforces no end-user tier, as the
// header comment above says.
//
// Normalizing here rather than adding v2 copies of every rule keeps ONE source
// of truth and covers a future /api/v3 the day it ships, instead of silently
// re-opening the same hole. Only the gate decision is normalized; proxy.ts
// still forwards the original pathname upstream.
function stripApiVersion(pathname: string): string {
  return pathname.replace(/^\/api\/v\d+(?=\/|$)/, '/api');
}

// The access the given request pathname requires, or null when no rule matches
// (unmapped → passes through, preserving today's behavior). First match wins, so
// the ordering in RULES is significant. Versioned paths are normalized to their
// unversioned form first, so /api/v2/signals/advanced gates exactly as
// /api/signals/advanced does.
export function requiredApiAccess(pathname: string): ApiAccess | null {
  const path = stripApiVersion(pathname);
  for (const rule of RULES) {
    const hit = 'prefix' in rule ? covers(path, rule.prefix) : rule.pattern.test(path);
    if (hit) return rule.access;
  }
  return null;
}

// Kill-switch. The gate is ON by default (unset / empty / any value other than
// '0'); an operator disables it instantly by setting BILLING_API_TIER_GATE_ENABLED=0
// and restarting the service (an env reload, NOT a rebuild — this is a server-only
// var read from process.env at request time). Provided as a pure function taking
// the raw env value so the semantics are unit-testable; proxy.ts passes
// process.env.BILLING_API_TIER_GATE_ENABLED. Rationale: this gate can 403 a paying
// page if a premium endpoint is ever mis-mapped, so a no-rebuild rollback must
// exist alongside it.
export function isApiTierGateEnabled(rawEnvValue: string | undefined): boolean {
  return rawEnvValue !== '0';
}
