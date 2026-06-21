export type HelpArticle = {
  slug: string;
  title: string;
  description: string;
  section: string;
};

// Ordered list — drives next/prev navigation on each article page.
export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'getting-started',
    title: 'Your First 15 Minutes with ZeroGEX',
    description: 'A guided tour from sign-up to your first read of the dashboard.',
    section: 'Getting Started',
  },
  {
    slug: 'tiers-and-access',
    title: 'Tiers, Access & What Unlocks Where',
    description: 'A clear map of which pages are public, Basic, and Pro.',
    section: 'Getting Started',
  },
  {
    slug: 'navigating-the-app',
    title: 'Navigating the App',
    description: 'The sidebar, the symbol picker, the timeframe selector, and keyboard shortcuts.',
    section: 'Getting Started',
  },
  {
    slug: 'dashboard',
    title: 'Reading the Dashboard',
    description: 'Every metric tile on the dashboard explained.',
    section: 'Core Pages',
  },
  {
    slug: 'live-bulletin',
    title: 'Using the Live Bulletin',
    description: 'The streaming feed of signal events, regime shifts, and notable flow.',
    section: 'Core Pages',
  },
  {
    slug: 'signals-overview',
    title: 'How Signals Work End-to-End',
    description: 'Advanced vs. Basic signals, how scores combine, and what the cards show.',
    section: 'Signals',
  },
  {
    slug: 'composite-score',
    title: 'Composite Score',
    description: 'How the composite blends all signals and how to use it.',
    section: 'Signals',
  },
  {
    slug: 'basic-signals-dashboard',
    title: 'Basic Signal Dashboard',
    description: 'The six continuous reads that feed the composite.',
    section: 'Signals',
  },
  {
    slug: 'advanced-signals-dashboard',
    title: 'Advanced Signal Dashboard',
    description: 'The event-driven signals — what fires and what it means.',
    section: 'Signals',
  },
  {
    slug: 'dealer-positioning',
    title: 'Dealer Positioning',
    description: 'The full GEX surface — net GEX, gamma flip, walls, term structure.',
    section: 'Metrics',
  },
  {
    slug: 'gex-summary',
    title: 'GEX Summary & Greeks',
    description: 'Headline GEX numbers plus delta, gamma, vanna and charm.',
    section: 'Metrics',
  },
  {
    slug: 'flow-analysis',
    title: 'Flow Analysis',
    description: 'Premium-weighted and net-volume flow, smart-money buckets, aggressor split.',
    section: 'Metrics',
  },
  {
    slug: 'smart-money',
    title: 'Smart Money',
    description: 'The smart-money screen and the C/P ratio.',
    section: 'Metrics',
  },
  {
    slug: 'max-pain',
    title: 'Max Pain',
    description: 'How max pain is calculated and when to trust it.',
    section: 'Metrics',
  },
  {
    slug: 'technicals',
    title: 'Technicals',
    description: 'The intraday technical snapshot — price, candles, volatility gauges.',
    section: 'Metrics',
  },
  {
    slug: 'options-calculator',
    title: 'Strategy Builder',
    description: 'Build and price any single- or multi-leg options strategy.',
    section: 'Strategy Tools',
  },
  {
    slug: 'option-contracts',
    title: 'Live Options Quotes',
    description: 'Browse the live chain — filtering, sorting, and reading the surface.',
    section: 'Strategy Tools',
  },
  {
    slug: 'backtesting',
    title: 'Backtesting',
    description: 'Running a backtest against historical signal scores.',
    section: 'Strategy Tools',
  },
  {
    slug: 'account',
    title: 'Account Settings',
    description: 'Email, password, linked sign-in providers, and tier status.',
    section: 'Account & Billing',
  },
  {
    slug: 'billing',
    title: 'Billing & Stripe Portal',
    description: 'How billing works through Stripe and how to manage your plan.',
    section: 'Account & Billing',
  },
  {
    slug: 'referrals',
    title: 'Referrals',
    description: 'Your code, your link, what counts, and how earned months land.',
    section: 'Account & Billing',
  },
  {
    slug: 'alerts',
    title: 'Signal Alerts',
    description: 'How signal triggers surface inside the platform.',
    section: 'Alerts & Notifications',
  },
  {
    slug: 'email-preferences',
    title: 'Email Preferences',
    description: 'Marketing vs. transactional email and how to manage them.',
    section: 'Alerts & Notifications',
  },
  {
    slug: 'api-access',
    title: 'API Access & Keys (Pro)',
    description: 'Reading the API docs, what Pro unlocks, and the rate-limit model.',
    section: 'API & Data Access',
  },
  {
    slug: 'data-coverage',
    title: 'Data Coverage & Refresh',
    description: 'Supported symbols, market hours, refresh cadence, holidays.',
    section: 'API & Data Access',
  },
  {
    slug: 'reading-charts',
    title: 'How to Read ZeroGEX Charts',
    description: 'A shared visual vocabulary for every chart on the platform.',
    section: 'Charts & Reading the Data',
  },
  {
    slug: 'score-line',
    title: 'Reading the [-1, +1] Score Line',
    description: 'Sign, magnitude, and the meaning of a 0 score.',
    section: 'Charts & Reading the Data',
  },
  {
    slug: 'streaming-and-performance',
    title: 'Streaming & Performance',
    description: 'How real-time updates reach your browser and what to do if things feel slow.',
    section: 'Streaming & Performance',
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Sign-in, missing data, stale charts, payments, and browser caches.',
    section: 'Streaming & Performance',
  },
];

export function getHelpArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getHelpNeighbors(slug: string): {
  prev: HelpArticle | null;
  next: HelpArticle | null;
} {
  const idx = HELP_ARTICLES.findIndex((a) => a.slug === slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? HELP_ARTICLES[idx - 1] : null,
    next: idx < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[idx + 1] : null,
  };
}
