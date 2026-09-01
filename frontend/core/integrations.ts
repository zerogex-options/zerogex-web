// The chart-platform integrations, in one place.
//
// Four surfaces used to hardcode this list independently — the sidebar's "More"
// group, the mobile header's copy of it, the footer's Platform column, and the
// two indicator landings' hand-written cross-links to each other. That was
// already one list too many at two platforms; at four it is the kind of thing
// where a fifth integration ships with a page nobody can navigate to, or the
// footer keeps advertising a platform after its landing has been renamed.
//
// So the registry below is the source of record, and every one of those
// surfaces derives from it:
//
//   core/navigation-adjacent menus  → INTEGRATIONS_HUB (a single link)
//   components/Footer.tsx           → INTEGRATIONS_HUB (a single link)
//   app/integrations/page.tsx       → INTEGRATIONS (grouped by `updates`)
//   components/IntegrationsStrip    → INTEGRATIONS minus the current page
//   core/auth.ts                    → integrationRoutes() feeds the public
//                                     route allowlist, so a new entry here
//                                     cannot ship a landing the middleware
//                                     then bounces to /login
//
// Adding a platform is: append an entry, add its landing page and its section
// component, add the source file under public/. Nothing else needs editing, and
// tests/integrations.test.ts fails if the registry and the routes disagree.

/** Stable key for one integration. Used for React keys and telemetry. */
export type IntegrationId = 'tradingview' | 'thinkorswim' | 'ninjatrader' | 'sierrachart';

/**
 * What it costs to actually use the thing.
 *
 * `free` means no ZeroGEX account is involved at all — the script is inert
 * without numbers, and the numbers are on the public gamma-levels pages.
 * `pro` means the download is gated AND the data behind it needs a Pro API
 * key; see docs/ninjatrader-indicator.md for why both gates exist.
 */
export type IntegrationTier = 'free' | 'pro';

/**
 * Whether the levels keep themselves current.
 *
 * This is the single most useful fact about any of these for a visitor
 * choosing one, and it is NOT a product decision — it falls straight out of
 * what the host platform's scripting language is allowed to do. Pine Script
 * and thinkScript are sandboxed with no network access, so those two can only
 * ever be manual-entry. NinjaScript (C#) and ACSIL (C++) can make HTTP calls,
 * so those two poll the API. `updatesNote` carries that reason, because "why
 * is the free one manual?" is otherwise a support question.
 */
export type IntegrationUpdates = 'auto' | 'manual';

export type Integration = {
  id: IntegrationId;
  /** Platform brand name. Stays English in every locale, same as "API Specs". */
  platform: string;
  /** Site-relative landing route. Mirrored into core/auth.ts as a public route. */
  href: string;
  /** Short label for menus and the breadcrumb trail. */
  navLabel: string;
  /** Hub card heading — what the integration does, not what it is called. */
  cardTitle: string;
  /** One or two sentences for the hub card and the cross-link strip. */
  blurb: string;
  tier: IntegrationTier;
  updates: IntegrationUpdates;
  /** Why it updates the way it does — the platform constraint, in one line. */
  updatesNote: string;
  /** Scripting language/runtime, shown as a chip on the hub card. */
  language: string;
  /** The levels this one can draw, for the hub's at-a-glance comparison. */
  levels: string;
  /** CSS custom property driving the card's eyebrow pill and accents. */
  accent: '--color-brand-primary' | '--color-brand-accent';
};

/**
 * Ordered free-first, then by how established the integration is. The hub
 * regroups these by `updates` (auto-updating vs manual entry) because that is
 * the axis a visitor actually chooses on; this array order decides the order
 * *within* each of those groups, and the order of the cross-link strip.
 */
export const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'tradingview',
    platform: 'TradingView',
    href: '/tradingview-indicator',
    navLabel: 'TradingView Indicator',
    cardTitle: 'Plot the levels on TradingView',
    blurb:
      'A free, published Pine Script that draws the Gamma Flip, Call Wall, Put Wall, and Max Pain as horizontal lines on SPY, SPX, QQQ, NDX, ES or NQ — with optional cross-alerts. Add it from the indicator search; no account needed.',
    tier: 'free',
    updates: 'manual',
    updatesNote: 'Pine Script cannot make HTTP calls, so you type today’s four numbers into Settings.',
    language: 'Pine Script v6',
    levels: 'Gamma Flip · Call Wall · Put Wall · Max Pain',
    accent: '--color-brand-primary',
  },
  {
    id: 'thinkorswim',
    platform: 'thinkorswim',
    href: '/thinkorswim-indicator',
    navLabel: 'thinkorswim Study',
    cardTitle: 'Plot the levels on thinkorswim',
    blurb:
      'A free thinkScript study for thinkorswim desktop, web, and mobile. Paste it once into the Study Editor and it draws the Gamma Flip, Call Wall, Put Wall, and Max Pain, with a level chip on each line and optional cross-alerts.',
    tier: 'free',
    updates: 'manual',
    updatesNote: 'thinkScript has no network access at all, so it is manual-entry by design.',
    language: 'thinkScript',
    levels: 'Gamma Flip · Call Wall · Put Wall · Max Pain',
    accent: '--color-brand-primary',
  },
  {
    id: 'ninjatrader',
    platform: 'NinjaTrader 8',
    href: '/ninjatrader-indicator',
    navLabel: 'NinjaTrader Indicator',
    cardTitle: 'Auto-updating levels on NinjaTrader',
    blurb:
      'A NinjaScript indicator that polls the ZeroGEX API on a timer and redraws — Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike, plus an optional per-strike gamma histogram. Set the symbol to ES or NQ and the levels arrive already on the futures price axis.',
    tier: 'pro',
    updates: 'auto',
    updatesNote: 'NinjaScript is C#, so it polls the API and you never retype a number.',
    language: 'NinjaScript (C#)',
    levels: 'Gamma Flip · Call Wall · Put Wall · Max Pain · Pin Strike · GEX 1..N · VWAP',
    accent: '--color-brand-accent',
  },
  {
    id: 'sierrachart',
    platform: 'Sierra Chart',
    href: '/sierra-chart-indicator',
    navLabel: 'Sierra Chart Study',
    cardTitle: 'Auto-updating levels on Sierra Chart',
    blurb:
      'An ACSIL study that polls the ZeroGEX API and redraws the Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike as chart-wide lines. Builds in place with Sierra Chart’s own compiler — no toolchain to install.',
    tier: 'pro',
    updates: 'auto',
    updatesNote: 'ACSIL is C++, so the study fetches the levels itself on a timer.',
    language: 'ACSIL (C++)',
    levels: 'Gamma Flip · Call Wall · Put Wall · Max Pain · Pin Strike',
    accent: '--color-brand-accent',
  },
] as const;

/** The parent page that houses all of the above. */
export const INTEGRATIONS_HUB = {
  href: '/integrations',
  /** Menu + footer label. Deliberately shorter than the page's own <h1>. */
  navLabel: 'Integrations',
  /** Breadcrumb label and the hub's own short name. */
  crumb: 'Chart Integrations',
} as const;

/** Look one up by id. Throws rather than returning undefined — every call site
 *  passes a literal, so a miss is a typo at build time, not a runtime state. */
export function integrationById(id: IntegrationId): Integration {
  const found = INTEGRATIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown integration id: ${id}`);
  return found;
}

/** Every integration except the one whose page is being rendered. */
export function otherIntegrations(exclude: IntegrationId | readonly IntegrationId[]): Integration[] {
  const skip = new Set<IntegrationId>(Array.isArray(exclude) ? exclude : [exclude as IntegrationId]);
  return INTEGRATIONS.filter((entry) => !skip.has(entry.id));
}

/**
 * Every route the registry owns — the four landings plus the hub.
 *
 * core/auth.ts spreads this into PUBLIC_ROUTE_PATTERNS so the two can't drift.
 * All of these are marketing/how-to pages carrying no member data; the Pro
 * DOWNLOADS inside two of them are gated by their own section components, not
 * by the route, because routing the pages to /login would cost them the SEO
 * traffic they exist to capture.
 */
export function integrationRoutes(): string[] {
  return [INTEGRATIONS_HUB.href, ...INTEGRATIONS.map((entry) => entry.href)];
}
