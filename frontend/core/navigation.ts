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
      { id: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', requiredTier: 'basic' },
      { id: '/my-dashboard', label: 'My Dashboard', labelKey: 'nav.myDashboard', requiredTier: 'basic' },
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
    label: 'Metrics',
    labelKey: 'nav.group.metrics',
    items: [
      { id: '/gamma-exposure', label: 'Dealer Positioning', requiredTier: 'basic' },
      { id: '/greeks-gex', label: 'GEX Summary', requiredTier: 'basic' },
      { id: '/gex-strike-profile', label: 'GEX Strike Profile', requiredTier: 'basic' },
      { id: '/gex-heatmap', label: 'GEX Heatmap', requiredTier: 'basic' },
      { id: '/forced-flow', label: 'Forced Flow', requiredTier: 'basic', beta: true },
      { id: '/flow-analysis', label: 'Flow Analysis', requiredTier: 'basic' },
      { id: '/smart-money', label: 'Smart Money', requiredTier: 'basic' },
      { id: '/max-pain', label: 'Max Pain', requiredTier: 'basic' },
      { id: '/intraday-tools', label: 'Technicals', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Strategy Tools',
    labelKey: 'nav.group.strategyTools',
    items: [
      { id: '/options-calculator', label: 'Strategy Builder', labelKey: 'nav.strategyBuilder', requiredTier: 'basic' },
      { id: '/option-contracts', label: 'Live Options Quotes', labelKey: 'nav.liveOptionsQuotes', requiredTier: 'basic' },
      { id: '/premium-heatmap', label: 'Premium Surface', requiredTier: 'basic', beta: true },
      { id: '/replay', label: 'Daily Replay', labelKey: 'nav.dailyReplay' },
      { id: '/forecast', label: 'Daily Forecast', labelKey: 'nav.dailyForecast', beta: true },
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
    ],
  },
];
