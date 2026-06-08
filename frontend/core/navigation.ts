export type NavItem = {
  id: string;
  label: string;
  requiredTier?: 'basic' | 'pro' | 'admin';
  external?: boolean;
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
    label: 'Dashboard',
    items: [
      { id: '/dashboard', label: 'Dashboard', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Live View',
    items: [
      { id: '/strike-profile', label: 'Strike Profile', requiredTier: 'basic' },
      { id: '/price-action', label: 'Price Action', requiredTier: 'basic' },
      { id: '/options-chain', label: 'Options Chain', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: '/dealer-positioning', label: 'Dealer Positioning', requiredTier: 'basic' },
      { id: '/gex-summary', label: 'GEX Summary', requiredTier: 'basic' },
      { id: '/flow-analysis', label: 'Flow Analysis', requiredTier: 'basic' },
      { id: '/smart-money', label: 'Smart Money', requiredTier: 'basic' },
      { id: '/max-pain', label: 'Max Pain', requiredTier: 'basic' },
      { id: '/technicals', label: 'Technicals', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Signals',
    items: [
      { id: '/composite-score', label: 'Composite Score', requiredTier: 'pro' },
      { id: '/signaled-trades', label: 'Signaled Trades', requiredTier: 'admin' },
    ],
    subgroups: [
      {
        id: '/basic-signals',
        label: 'Basic Signals',
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
        label: 'Advanced Signals',
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
    label: 'Tools',
    items: [
      { id: '/strategy-builder', label: 'Strategy Builder', requiredTier: 'basic' },
    ],
  },
  {
    label: 'Learn',
    items: [
      { id: '/learn', label: 'Education Hub' },
      { id: '/help', label: 'Help' },
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
          { id: '/education/decoding-gamma-exposure', label: 'Gamma Exposure Explained' },
          { id: '/education/net-volume-vs-directional-flow', label: 'Options Flow Explained' },
          { id: '/education/eod-pressure-and-trap-detection', label: 'EOD Pressure & Trap Detection' },
          { id: '/education/squeeze-setup-positioning-trap-and-trap-detection', label: 'Three Signals, Three Stories' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: '/admin/monitoring', label: 'Monitoring', requiredTier: 'admin' },
    ],
  },
];
