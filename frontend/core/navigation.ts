export type NavItem = {
  id: string;
  label: string;
  requiredTier?: 'starter' | 'pro' | 'elite' | 'admin';
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
      { id: '/dashboard', label: 'Dashboard', requiredTier: 'starter' },
      { id: '/underlying-price-action', label: 'Underlying Price Action', requiredTier: 'starter' },
    ],
  },
  {
    label: 'Signals',
    items: [
      { id: '/signal-score', label: 'Composite Score', requiredTier: 'elite' },
      { id: '/trading-signals', label: 'Signaled Trades', requiredTier: 'elite' },
    ],
    subgroups: [
      {
        label: 'Basic Signals',
        items: [
          { id: '/basic-signals', label: 'Basic Signal Dashboard', requiredTier: 'pro' },
          { id: '/tape-flow-bias', label: 'Tape Flow Bias', requiredTier: 'pro' },
          { id: '/skew-delta', label: 'Skew Delta', requiredTier: 'pro' },
          { id: '/vanna-charm-flow', label: 'Vanna/Charm Flow', requiredTier: 'pro' },
          { id: '/dealer-delta-pressure', label: 'Dealer Delta Pressure', requiredTier: 'pro' },
          { id: '/gex-gradient', label: 'GEX Gradient', requiredTier: 'pro' },
          { id: '/positioning-trap', label: 'Positioning Trap', requiredTier: 'pro' },
        ],
      },
      {
        label: 'Advanced Signals',
        items: [
          { id: '/advanced-signals', label: 'Advanced Signal Dashboard', requiredTier: 'elite' },
          { id: '/volatility-expansion', label: 'Volatility Expansion', requiredTier: 'elite' },
          { id: '/eod-pressure', label: 'EOD Pressure', requiredTier: 'elite' },
          { id: '/squeeze-setup', label: 'Squeeze Setup', requiredTier: 'elite' },
          { id: '/trap-detection', label: 'Trap Detection', requiredTier: 'elite' },
          { id: '/0dte-position-imbalance', label: '0DTE Position Imbalance', requiredTier: 'elite' },
          { id: '/gamma-vwap-confluence', label: 'Gamma/VWAP Confluence', requiredTier: 'elite' },
          { id: '/range-break-imminence', label: 'Range Break Imminence', requiredTier: 'elite' },
        ],
      },
    ],
  },
  {
    label: 'Metrics',
    items: [
      { id: '/gamma-exposure', label: 'Dealer Exposure', requiredTier: 'starter' },
      { id: '/flow-analysis', label: 'Flow Analysis', requiredTier: 'starter' },
      { id: '/smart-money', label: 'Smart Money', requiredTier: 'starter' },
      { id: '/max-pain', label: 'Max Pain', requiredTier: 'starter' },
      { id: '/intraday-tools', label: 'Technicals', requiredTier: 'starter' },
    ],
  },
  {
    label: 'Strategy Tools',
    items: [
      { id: '/options-calculator', label: 'Strategy Builder', requiredTier: 'starter' },
      { id: '/option-contracts', label: 'Live Options Quotes', requiredTier: 'starter' },
    ],
  },
  {
    label: 'Education',
    items: [
      { id: '/education', label: 'Hub', requiredTier: 'starter' },
      { id: '/education/decoding-gamma-exposure', label: 'Gamma Exposure Guide', requiredTier: 'starter' },
      { id: '/education/net-volume-vs-directional-flow', label: 'Flow Metrics Guide', requiredTier: 'starter' },
    ],
  },
];
