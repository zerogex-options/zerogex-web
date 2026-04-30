export type NavItem = {
  id: string;
  label: string;
  requiredTier?: 'basic' | 'pro' | 'admin';
  external?: boolean;
};

export type NavSubgroup = {
  label: string;
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
      { id: '/underlying-price-action', label: 'Underlying Price Action', requiredTier: 'basic' },
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
        label: 'Basic Signals',
        items: [
          { id: '/basic-signals', label: 'Basic Signal Dashboard', requiredTier: 'basic' },
          { id: '/tape-flow-bias', label: 'Tape Flow Bias', requiredTier: 'basic' },
          { id: '/skew-delta', label: 'Skew Delta', requiredTier: 'basic' },
          { id: '/vanna-charm-flow', label: 'Vanna/Charm Flow', requiredTier: 'basic' },
          { id: '/dealer-delta-pressure', label: 'Dealer Delta Pressure', requiredTier: 'basic' },
          { id: '/gex-gradient', label: 'GEX Gradient', requiredTier: 'basic' },
          { id: '/positioning-trap', label: 'Positioning Trap', requiredTier: 'basic' },
        ],
      },
      {
        label: 'Advanced Signals',
        items: [
          { id: '/advanced-signals', label: 'Advanced Signal Dashboard', requiredTier: 'pro' },
          { id: '/volatility-expansion', label: 'Volatility Expansion', requiredTier: 'pro' },
          { id: '/eod-pressure', label: 'EOD Pressure', requiredTier: 'pro' },
          { id: '/squeeze-setup', label: 'Squeeze Setup', requiredTier: 'pro' },
          { id: '/trap-detection', label: 'Trap Detection', requiredTier: 'pro' },
          { id: '/0dte-position-imbalance', label: '0DTE Position Imbalance', requiredTier: 'pro' },
          { id: '/gamma-vwap-confluence', label: 'Gamma/VWAP Confluence', requiredTier: 'pro' },
          { id: '/range-break-imminence', label: 'Range Break Imminence', requiredTier: 'pro' },
        ],
      },
    ],
  },
  {
    label: 'Metrics',
    items: [
      { id: '/gamma-exposure', label: 'Dealer Exposure', requiredTier: 'basic' },
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
    ],
  },
  {
    label: 'Education',
    items: [
      { id: '/education', label: 'Hub' },
      { id: '/education/decoding-gamma-exposure', label: 'Gamma Exposure Guide' },
      { id: '/education/net-volume-vs-directional-flow', label: 'Flow Metrics Guide' },
    ],
  },
];
