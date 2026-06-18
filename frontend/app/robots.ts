import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Auth & user chrome
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/unauthorized',
        // User-scoped data routes. /dashboard itself is intentionally public
        // (anonymous preview of GEX/walls/flip via public APIs) and stays
        // crawlable; sub-paths under /dashboard/* are still off-limits via
        // the sitemap exclude.
        '/account',
        // Admin
        '/admin',
        // Replaced by 308 redirect to /
        '/landing',
        // Tier-gated tools (middleware 307s anonymous traffic to /login).
        // Disallowing them keeps Googlebot from filing them under
        // "Page with redirect" in Search Console.
        '/signal-score',
        '/trading-signals',
        '/advanced-signals',
        '/eod-pressure',
        '/squeeze-setup',
        '/trap-detection',
        '/0dte-position-imbalance',
        '/gamma-vwap-confluence',
        '/volatility-expansion',
        '/market-pressure',
        '/basic-signals',
        '/tape-flow-bias',
        '/skew-delta',
        '/vanna-charm-flow',
        '/dealer-delta-pressure',
        '/gex-gradient',
        '/positioning-trap',
        '/gamma-exposure',
        '/max-pain',
        '/greeks-gex',
        '/flow-analysis',
        '/smart-money',
        '/intraday-tools',
        '/options-calculator',
        '/option-contracts',
        '/range-break-imminence',
        '/backtesting',
        // Internals
        '/api',
        '/_next',
        '/checkout',
      ],
    },
    sitemap: 'https://zerogex.io/sitemap.xml',
    host: 'https://zerogex.io',
  };
}
