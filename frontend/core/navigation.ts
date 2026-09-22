import type { TranslationKey } from '@/core/i18n';

// `label` is the stable English string — used as a fallback AND as the key for
// expand/collapse state, so it must never change per-locale. `labelKey`, when
// present, is what the UI renders through t(); items without one (trading
// feature names, tickers, brand names) intentionally stay in English.
export type NavItem = {
  id: string;
  label: string;
  labelKey?: TranslationKey;
  requiredTier?: 'basic' | 'pro' | 'admin';
  external?: boolean;
  /** Flags an in-development feature; renders a "Beta" pill next to the label. */
  beta?: boolean;
  /**
   * Treat `id` as a path PREFIX for active-state, not an exact match. For
   * sections whose real pages are dated permalinks (`/scorecard/SPY/2026-09-11`)
   * and whose `id` is only the entry point, exact matching would leave the item
   * unhighlighted everywhere the reader actually is. Off by default, because
   * for nested entries like `/backtesting` and `/backtesting/insights` a prefix
   * would light up both.
   */
  matchPrefix?: boolean;
};

export type NavSubgroup = {
  id?: string;
  label: string;
  labelKey?: TranslationKey;
  requiredTier?: 'basic' | 'pro' | 'admin';
  items: NavItem[];
};

export type NavGroup = {
  label: string;
  labelKey?: TranslationKey;
  items?: NavItem[];
  subgroups?: NavSubgroup[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    labelKey: 'nav.group.main',
    items: [
      { id: '/dashboard', label: 'Main Dashboard', labelKey: 'nav.dashboard', requiredTier: 'basic' },
      { id: '/my-dashboard', label: 'My Dashboard', labelKey: 'nav.myDashboard', requiredTier: 'basic' },
      // /chart is a public dual-mode route (delayed snapshot for anonymous
      // visitors, live for subscribers), so it carries no requiredTier — the
      // route table in core/auth.ts keeps it public and the page branches on
      // the session. Marking it 'basic' here would wrongly hide it from guests.
      { id: '/chart', label: 'Gamma Chart' },
      // Gamma Terminal (beta): the Gamma Chart's price chart with two gamma
      // ladders beside it. Live-only (no delayed public snapshot), so unlike
      // /chart it is a member page and carries the Basic tier.
      { id: '/gamma-terminal', label: 'Gamma Terminal', requiredTier: 'basic', beta: true },
      { id: '/live-bulletin', label: 'Live Bulletin', labelKey: 'nav.liveBulletin', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Signals',
    labelKey: 'nav.group.signals',
    items: [
      { id: '/trade-bias', label: 'Trade Bias', requiredTier: 'pro' },
      { id: '/signal-score', label: 'Composite Score', labelKey: 'nav.compositeScore', requiredTier: 'pro' },
    ],
    subgroups: [
      {
        id: '/basic-signals',
        label: 'Basic Signal Dashboard',
        labelKey: 'nav.basicSignalDashboard',
        requiredTier: 'basic',
        items: [
          { id: '/tape-flow-bias', label: 'Tape Flow Bias', requiredTier: 'basic' },
          { id: '/skew-delta', label: 'Skew Delta', requiredTier: 'basic' },
          { id: '/vanna-charm-flow', label: 'Vanna/Charm Flow', requiredTier: 'basic' },
          { id: '/dealer-delta-pressure', label: 'Dealer Delta Pressure', requiredTier: 'basic' },
          { id: '/gex-gradient', label: 'GEX Gradient', requiredTier: 'basic' },
          { id: '/positioning-trap', label: 'Positioning Trap', requiredTier: 'basic' },
        ],
      },
      {
        id: '/advanced-signals',
        label: 'Advanced Signal Dashboard',
        labelKey: 'nav.advancedSignalDashboard',
        requiredTier: 'pro',
        items: [
          { id: '/volatility-expansion', label: 'Volatility Expansion', requiredTier: 'pro' },
          { id: '/eod-pressure', label: 'EOD Pressure', requiredTier: 'pro' },
          { id: '/squeeze-setup', label: 'Squeeze Setup', requiredTier: 'pro' },
          { id: '/trap-detection', label: 'Trap Detection', requiredTier: 'pro' },
          { id: '/0dte-position-imbalance', label: '0DTE Position Imbalance', requiredTier: 'pro' },
          { id: '/gamma-vwap-confluence', label: 'Gamma/VWAP Confluence', requiredTier: 'pro' },
          { id: '/range-break-imminence', label: 'Range Break Imminence', requiredTier: 'pro' },
          { id: '/market-pressure', label: 'Market Pressure Index', requiredTier: 'pro' },
        ],
      },
    ],
  },
  {
    // The unified "simulate a strategy" product: watch bots trade a strategy
    // live (paper), and backtest one over history. Same idea, two time
    // directions — forward (Bot Trading) and backward (Backtesting).
    label: 'TradeWorkz™',
    items: [
      { id: '/trading-signals', label: 'Bot Trading', labelKey: 'nav.botTrading', requiredTier: 'pro', beta: true },
      { id: '/backtesting', label: 'Backtesting', labelKey: 'nav.backtesting', requiredTier: 'pro', beta: true },
      { id: '/backtesting/insights', label: 'Pattern Insights', labelKey: 'nav.patternInsights', requiredTier: 'pro', beta: true },
    ],
  },
  {
    // Fifteen flat entries was a wall, not a menu. The three subgroups below
    // are the three questions the pages actually answer — what the book HOLDS,
    // what the tape DID to it, and what surrounds both — and each subgroup
    // label is also the eyebrow its pages print (see `navSubcategoryLabel`), so
    // a page can never advertise a category the menu does not put it in.
    //
    // No labelKey on the subgroups on purpose: every item inside them is an
    // untranslated trading term ('GEX Summary', 'Max Pain'), and a translated
    // parent over untranslated children reads worse than leaving both English.
    label: 'Metrics',
    labelKey: 'nav.group.metrics',
    subgroups: [
      {
        // Named for the question, not for the page inside it: a subgroup called
        // "Dealer Positioning" containing a page called "Dealer Positioning"
        // made that page's header read POSITIONING / Dealer Positioning twice.
        label: 'Positioning',
        items: [
          { id: '/gamma-exposure', label: 'Dealer Positioning', requiredTier: 'basic' },
          { id: '/greeks-gex', label: 'GEX Summary', requiredTier: 'basic' },
          { id: '/gex-strike-profile', label: 'GEX Strike Profile', requiredTier: 'basic' },
          { id: '/gex-heatmap', label: 'GEX Heatmap', requiredTier: 'basic' },
          { id: '/gamma-shift', label: 'Gamma Shift', requiredTier: 'basic', beta: true },
          { id: '/pair-comparison', label: 'Pair Comparison', requiredTier: 'basic', beta: true },
          { id: '/max-pain', label: 'Max Pain', requiredTier: 'basic' },
        ],
      },
      {
        label: 'Options Flow',
        items: [
          { id: '/flow-analysis', label: 'Flow Analysis', requiredTier: 'basic' },
          { id: '/hedging-flow', label: 'Hedging Flow', requiredTier: 'basic', beta: true },
          { id: '/forced-flow', label: 'Forced Flow', requiredTier: 'basic', beta: true },
          { id: '/smart-money', label: 'Smart Money', requiredTier: 'basic' },
          { id: '/market-tide', label: 'Market Tide', requiredTier: 'basic', beta: true },
        ],
      },
      {
        label: 'Market Context',
        items: [
          { id: '/volatility', label: 'Volatility', requiredTier: 'basic', beta: true },
          { id: '/intraday-tools', label: 'Technicals', requiredTier: 'basic' },
          { id: '/spread-monitor', label: 'Spread Monitor', requiredTier: 'basic', beta: true },
        ],
      },
    ],
  },
  {
    label: 'Strategy Tools',
    labelKey: 'nav.group.strategyTools',
    items: [
      { id: '/options-calculator', label: 'Strategy Builder', labelKey: 'nav.strategyBuilder', requiredTier: 'basic' },
      { id: '/option-contracts', label: 'Live Options Quotes', labelKey: 'nav.liveOptionsQuotes', requiredTier: 'basic' },
      { id: '/premium-heatmap', label: 'Premium Surface', requiredTier: 'basic', beta: true },
      // All three are landing pages whose real content lives at dated
      // permalinks, so each matches its own subtree for active-state.
      { id: '/replay', label: 'Daily Replay', labelKey: 'nav.dailyReplay', matchPrefix: true },
      { id: '/forecast', label: 'Daily Forecast', labelKey: 'nav.dailyForecast', beta: true, matchPrefix: true },
      // Public per-session receipt: every signal's flips, what was scorable,
      // and how it resolved. It existed for months reachable only from the
      // 4:15 PM ET post that links one date — no sidebar entry, no inbound
      // link, absent from the sitemap — so nobody inside the product could
      // find it. Now a landing page of session cards, like Daily Replay.
      { id: '/scorecard', label: 'Daily Scorecard', labelKey: 'nav.dailyScorecard', matchPrefix: true },
      // The aggregate of what Daily Forecast grades, across every session
      // rather than one. Sits with the three dated views because it is the
      // same subject at a different scope, and it is listed AT ALL because
      // /scorecard already taught us what an unlinked public page is worth:
      // it sat reachable only from one dated post for months. No labelKey —
      // untranslated, like Premium Surface, rather than shipping a key with
      // no strings behind it in five locales.
      { id: '/track-record', label: 'Track Record' },
    ],
  },
  {
    label: 'Education',
    labelKey: 'nav.group.education',
    items: [
      { id: '/education', label: 'Hub', labelKey: 'nav.hub' },
    ],
    subgroups: [
      {
        id: '/guides',
        label: 'Guides',
        labelKey: 'nav.guides',
        items: [
          { id: '/guides/signals-explained', label: 'Signals: Explained' },
          { id: '/guides/gamma-flip-calculation-before-vs-after', label: 'GEX & Gamma Flip: How We Calculate It' },
        ],
      },
      {
        id: '/articles',
        label: 'Articles',
        labelKey: 'nav.articles',
        items: [
          { id: '/education/gamma-exposure-explained', label: 'Gamma Exposure Explained' },
          { id: '/education/why-market-makers-trade-stock', label: 'Why Dealers Are Forced to Trade' },
          { id: '/education/net-volume-vs-directional-flow', label: 'Options Flow Explained' },
          { id: '/education/eod-pressure-and-trap-detection', label: 'EOD Pressure & Trap Detection' },
          { id: '/education/squeeze-setup-positioning-trap-and-trap-detection', label: 'Three Signals, Three Stories' },
        ],
      },
      {
        id: '/help',
        label: 'Help',
        labelKey: 'nav.help',
        items: [
          { id: '/help/platform', label: 'Platform Guide', labelKey: 'nav.platformGuide' },
          { id: '/help/faqs', label: 'FAQs' },
          { id: '/help/quickstarts', label: 'Quick Starts', labelKey: 'nav.quickStarts' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    labelKey: 'nav.group.admin',
    items: [
      { id: '/admin/monitoring', label: 'Monitoring', labelKey: 'nav.monitoring', requiredTier: 'admin' },
      { id: '/admin/analytics', label: 'Page Analytics', labelKey: 'nav.pageAnalytics', requiredTier: 'admin' },
      { id: '/admin/x-post', label: 'X Post Review', requiredTier: 'admin' },
    ],
  },
];

/**
 * The subcategory a route sits under, e.g. '/max-pain' → 'Dealer Positioning'.
 *
 * Pages print this as the eyebrow above their title, which is the whole point:
 * the label a page shows and the label the menu files it under are the same
 * string from the same array, so reorganising the menu moves the page copy with
 * it and the two can never drift. Returns undefined for routes that sit
 * directly in a group (no subcategory to name) or are not in the menu at all.
 */
export function navSubcategoryLabel(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  for (const group of NAV_GROUPS) {
    for (const subgroup of group.subgroups ?? []) {
      if (subgroup.items.some((item) => item.id === pathname)) return subgroup.label;
    }
  }
  return undefined;
}

/**
 * The menu label for a route, e.g. '/gex-heatmap' → 'GEX Heatmap'.
 *
 * The counterpart to navSubcategoryLabel above, and it exists for the same
 * reason: when a page needs to NAME another page in prose — "you were reaching
 * for the GEX Heatmap" — the string should come from the menu rather than be
 * retyped at the call site, so renaming a feature renames every reference to
 * it. Searches top-level items, subgroup headers, and subgroup items in that
 * order. Returns undefined for a route that isn't in the menu at all, which
 * callers should treat as "don't name it" rather than substituting the raw
 * path: the raw path is developer-facing and reads as a leak in body copy.
 *
 * Deliberately returns the stable ENGLISH `label`, never the `labelKey`
 * translation. Callers are server components rendering prose that is already
 * English, and a half-translated sentence is worse than a consistent one.
 */
export function navItemLabel(pathname: string | null | undefined): string | undefined {
  if (!pathname) return undefined;
  for (const group of NAV_GROUPS) {
    for (const item of group.items ?? []) {
      if (item.id === pathname) return item.label;
    }
    for (const subgroup of group.subgroups ?? []) {
      if (subgroup.id === pathname) return subgroup.label;
      for (const item of subgroup.items) {
        if (item.id === pathname) return item.label;
      }
    }
  }
  return undefined;
}
