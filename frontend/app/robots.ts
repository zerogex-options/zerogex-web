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
        // User-scoped data routes
        '/account',
        '/dashboard',
        // Admin
        '/admin',
        // Replaced by 308 redirect to /
        '/landing',
        // Tier-gated tools (middleware 307s anonymous traffic to /login)
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
