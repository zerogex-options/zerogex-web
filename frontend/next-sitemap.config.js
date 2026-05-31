const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROJECT_ROOT = __dirname;

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
module.exports = {
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
    '/dashboard',
    '/dashboard/*',
    // Admin
    '/admin',
    '/admin/*',
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
    // Defensive — none currently exist under app/, but match spec.
    '/api/*',
    '/checkout/*',
    '/_next/*',
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
    if (urlPath.startsWith('/education') || urlPath.startsWith('/guides') || urlPath === '/articles') {
      return { loc: urlPath, changefreq: 'monthly', priority: 0.7, lastmod };
    }
    return { loc: urlPath, changefreq: 'monthly', priority: 0.6, lastmod };
  },
};
