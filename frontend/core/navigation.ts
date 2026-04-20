export type NavItem = {
  id: string;
  label: string;
  requiredTier?: 'basic' | 'pro' | 'admin';
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [{ id: '/dashboard', label: 'Dashboard', requiredTier: 'basic' }],
  },
  {
    label: 'Proprietary Signals',
    items: [
      { id: '/signal-score', label: 'Composite Score', requiredTier: 'pro' },
      { id: '/trading-signals', label: 'Signaled Trades', requiredTier: 'pro' },
      { id: '/volatility-expansion', label: 'Volatility Expansion', requiredTier: 'pro' },
      { id: '/eod-pressure', label: 'EOD Pressure', requiredTier: 'pro' },
      { id: '/squeeze-setup', label: 'Squeeze Setup', requiredTier: 'pro' },
      { id: '/trap-detection', label: 'Trap Detection', requiredTier: 'pro' },
      { id: '/0dte-position-imbalance', label: '0DTE Position Imbalance', requiredTier: 'pro' },
      { id: '/gamma-vwap-confluence', label: 'Gamma/VWAP Confluence', requiredTier: 'pro' },
    ],
  },
  {
    label: 'Metrics',
    items: [
      { id: '/gamma-exposure', label: 'Dealer Exposure', requiredTier: 'basic' },
      { id: '/flow-analysis', label: 'Flow Analysis', requiredTier: 'basic' },
      { id: '/smart-money', label: 'Smart Money', requiredTier: 'basic' },
      { id: '/max-pain', label: 'Max Pain', requiredTier: 'basic' },
      { id: '/intraday-tools', label: 'Technicals', requiredTier: 'pro' },
    ],
  },
  {
    label: 'Strategy Tools',
    items: [
      { id: '/options-calculator', label: 'Strategy Builder', requiredTier: 'pro' },
      { id: '/option-contracts', label: 'Live Options Quotes', requiredTier: 'pro' },
    ],
  },
  {
    label: 'Education',
    items: [
      { id: '/education', label: 'Hub', requiredTier: 'basic' },
      { id: '/education/decoding-gamma-exposure', label: 'Gamma Exposure Guide', requiredTier: 'basic' },
      { id: '/education/net-volume-vs-directional-flow', label: 'Flow Metrics Guide', requiredTier: 'basic' },
    ],
  },
];
