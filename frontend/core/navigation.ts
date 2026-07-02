export type NavItem = {
  id: string;
  label: string;
  requiredTier?: 'basic' | 'pro' | 'admin';
  external?: boolean;
  /** Flags an in-development feature; renders a "Beta" pill next to the label. */
  beta?: boolean;
};

export type NavSubgroup = {
  id?: string;
  label: string;
  requiredTier?: 'basic' | 'pro' | 'admin';
  items: NavItem[];
};

export type NavGroup = {
  label: string;
  items?: NavItem[];
  subgroups?: NavSubgroup[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { id: '/dashboard', label: 'Dashboard', requiredTier: 'basic' },
      { id: '/live-bulletin', label: 'Live Bulletin', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Signals',
    items: [
      { id: '/signal-score', label: 'Composite Score', requiredTier: 'pro' },
      { id: '/trading-signals', label: 'Signaled Trades', requiredTier: 'admin' },
    ],
    subgroups: [
      {
        id: '/basic-signals',
        label: 'Basic Signal Dashboard',
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
    label: 'Metrics',
    items: [
      { id: '/gamma-exposure', label: 'Dealer Positioning', requiredTier: 'basic' },
      { id: '/greeks-gex', label: 'GEX Summary', requiredTier: 'basic' },
      { id: '/gex-strike-profile', label: 'GEX Strike Profile', requiredTier: 'basic' },
      { id: '/gex-heatmap', label: 'GEX Heatmap', requiredTier: 'basic' },
      { id: '/flow-analysis', label: 'Flow Analysis', requiredTier: 'basic' },
      { id: '/smart-money', label: 'Smart Money', requiredTier: 'basic' },
      { id: '/max-pain', label: 'Max Pain', requiredTier: 'basic' },
      { id: '/intraday-tools', label: 'Technicals', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Strategy Tools',
    items: [
      { id: '/options-calculator', label: 'Strategy Builder', requiredTier: 'basic' },
      { id: '/option-contracts', label: 'Live Options Quotes', requiredTier: 'basic' },
      { id: '/premium-heatmap', label: 'Premium Surface', requiredTier: 'basic', beta: true },
      { id: '/backtesting', label: 'Backtesting', requiredTier: 'pro', beta: true },
      { id: '/backtesting/insights', label: 'Pattern Insights', requiredTier: 'pro', beta: true },
    ],
  },
  {
    label: 'Education',
    items: [
      { id: '/education', label: 'Hub' },
    ],
    subgroups: [
      {
        id: '/guides',
        label: 'Guides',
        items: [
          { id: '/guides/signals-explained', label: 'Signals: Explained' },
          { id: '/guides/gamma-flip-calculation-before-vs-after', label: 'GEX & Gamma Flip: How We Calculate It' },
        ],
      },
      {
        id: '/articles',
        label: 'Articles',
        items: [
          { id: '/education/gamma-exposure-explained', label: 'Gamma Exposure Explained' },
          { id: '/education/net-volume-vs-directional-flow', label: 'Options Flow Explained' },
          { id: '/education/eod-pressure-and-trap-detection', label: 'EOD Pressure & Trap Detection' },
          { id: '/education/squeeze-setup-positioning-trap-and-trap-detection', label: 'Three Signals, Three Stories' },
        ],
      },
      {
        id: '/help',
        label: 'Help',
        items: [
          { id: '/help/platform', label: 'Platform Guide' },
          { id: '/help/faqs', label: 'FAQs' },
          { id: '/help/quickstarts', label: 'Quick Starts' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: '/admin/monitoring', label: 'Monitoring', requiredTier: 'admin' },
      { id: '/forecast', label: 'Forecast', requiredTier: 'admin' },
      { id: '/replay', label: 'Replay', requiredTier: 'admin' },
    ],
  },
];
