import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

function gitLastCommitIso(absPath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', absPath],
      { cwd: PROJECT_ROOT, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' },
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

function sourceFileForRoute(urlPath) {
  if (urlPath === '/') return path.join(PROJECT_ROOT, 'app', 'page.tsx');

  const trimmed = urlPath.replace(/^\/+/, '');

  const educationMatch = /^education\/([^/]+)$/.exec(trimmed);
  if (educationMatch) {
    return path.join(PROJECT_ROOT, 'content', 'articles', `${educationMatch[1]}.md`);
  }

  const guidesMatch = /^guides\/([^/]+)$/.exec(trimmed);
  if (guidesMatch) {
    return path.join(PROJECT_ROOT, 'content', 'guides', `${guidesMatch[1]}.md`);
  }

  return path.join(PROJECT_ROOT, 'app', trimmed, 'page.tsx');
}

function lastmodFor(urlPath) {
  const file = sourceFileForRoute(urlPath);
  if (fs.existsSync(file)) {
    const fromGit = gitLastCommitIso(file);
    if (fromGit) return fromGit;
    try {
      return fs.statSync(file).mtime.toISOString();
    } catch {
      // fall through
    }
  }
  return new Date().toISOString();
}

/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: 'https://zerogex.io',
  generateRobotsTxt: false,

  exclude: [
    // Auth & user chrome
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/unauthorized',
    // User-scoped data routes
    '/account',
    '/account/*',
    '/dashboard/*',
    // Admin
    '/admin',
    '/admin/*',
    // Invitation-only founding-member activation page — not in sitemap and
    // marked noindex,nofollow at the page level.
    '/founding',
    // /landing is served by a 308 redirect to / (see next.config.ts)
    '/landing',
    // Auth-gated tools — middleware 307s anonymous Googlebot to /login,
    // which Google Search Console reports as "Page with redirect".
    '/signal-score',
    '/trading-signals',
    '/advanced-signals',
    '/eod-pressure',
    '/squeeze-setup',
    '/trap-detection',
    '/0dte-position-imbalance',
    '/gamma-vwap-confluence',
    '/volatility-expansion',
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
    '/market-pressure',
    // Defensive — none currently exist under app/, but match spec.
    '/api/*',
    '/checkout/*',
    '/_next/*',
    // next-sitemap auto-includes file-convention routes that aren't pages.
    // /robots.txt is a non-HTML route; per-route OG images are PNG handlers.
    '/robots.txt',
    '/*/opengraph-image',
    '/*/*/opengraph-image',
  ],

  autoLastmod: true,

  transform: async (config, urlPath) => {
    const lastmod = lastmodFor(urlPath);

    if (urlPath === '/') {
      return { loc: urlPath, changefreq: 'weekly', priority: 1.0, lastmod };
    }
    if (urlPath === '/pricing') {
      return { loc: urlPath, changefreq: 'monthly', priority: 0.9, lastmod };
    }
    if (urlPath === '/spx-gamma-levels') {
      // Lead-magnet page is the SEO landing for "SPX gamma levels" intent
      // searches — refreshed every market day, so daily changefreq matches
      // reality and the priority sits just below the homepage.
      return { loc: urlPath, changefreq: 'daily', priority: 0.95, lastmod };
    }
    if (urlPath.startsWith('/education') || urlPath.startsWith('/guides') || urlPath === '/articles') {
      return { loc: urlPath, changefreq: 'monthly', priority: 0.7, lastmod };
    }
    return { loc: urlPath, changefreq: 'monthly', priority: 0.6, lastmod };
  },
};

export default config;
