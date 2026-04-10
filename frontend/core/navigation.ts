export type NavItem = {
  id: string;
  label: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [{ id: '/dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Proprietary Signals',
    items: [
      { id: '/signal-score', label: 'Composite Score' },
      { id: '/trading-signals', label: 'Trade Ideas' },
      { id: '/volatility-expansion', label: 'Volatility Expansion' },
    ],
  },
  {
    label: 'Metrics',
    items: [
      { id: '/gamma-exposure', label: 'Gamma Exposure' },
      { id: '/flow-analysis', label: 'Market Tide' },
      { id: '/smart-money', label: 'Smart Money' },
      { id: '/max-pain', label: 'Max Pain' },
      { id: '/intraday-tools', label: 'Technicals' },
    ],
  },
  {
    label: 'Strategy Tools',
    items: [
      { id: '/options-calculator', label: 'Strategy Builder' },
      { id: '/option-contracts', label: 'Live Options Quotes' },
    ],
  },
  {
    label: 'Education',
    items: [
      { id: '/education', label: 'Hub' },
      { id: '/education/decoding-gamma-exposure', label: 'Gamma Exposure Guide' },
    ],
  },
];
