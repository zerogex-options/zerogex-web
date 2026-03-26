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
      { id: '/trading-signals', label: 'Trade Ideas' },
      { id: '/volatility-expansion', label: 'Volatility Expansion' },
      { id: '/position-optimizer', label: 'Position Optimizer' },
    ],
  },
  {
    label: 'Metrics',
    items: [
      { id: '/gamma-exposure', label: 'Gamma Exposure' },
      { id: '/flow-analysis', label: 'Flow Analysis' },
      { id: '/smart-money', label: 'Smart Money' },
      { id: '/max-pain', label: 'Max Pain' },
      { id: '/intraday-tools', label: 'Other' },
    ],
  },
  {
    label: 'Strategy Tools',
    items: [
      { id: '/options-calculator', label: 'Live Strategy Lab' },
      { id: '/option-contracts', label: 'Real-Time Contract Viewer' },
    ],
  },
];
