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

  // /methodology is markdown-backed but lives at the content root rather than
  // in a scanned directory, so its lastmod has to be wired up by hand.
  if (trimmed === 'methodology') {
    return path.join(PROJECT_ROOT, 'content', 'methodology.md');
  }

  const guidesMatch = /^guides\/([^/]+)$/.exec(trimmed);
  if (guidesMatch) {
    return path.join(PROJECT_ROOT, 'content', 'guides', `${guidesMatch[1]}.md`);
  }

  const helpPlatformMatch = /^help\/platform\/([^/]+)$/.exec(trimmed);
  if (helpPlatformMatch) {
    return path.join(PROJECT_ROOT, 'content', 'help', 'platform', `${helpPlatformMatch[1]}.md`);
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

// Every force-static /<ticker>-gamma-levels landing. Declared once because the
// list is consumed twice below (dedupe + priority) and a ticker added to only
// one of them either duplicates a <url> or silently loses its SEO priority.
// ES / NQ are the futures pages: their levels are SPX / NDX option-derived,
// carried onto the futures price axis.
const GAMMA_LEVEL_PATHS = [
  '/spx-gamma-levels',
  '/spy-gamma-levels',
  '/qqq-gamma-levels',
  '/ndx-gamma-levels',
  '/es-gamma-levels',
  '/nq-gamma-levels',
];

// Public tools whose content changes every trading day: the free delayed
// chart and the replay / forecast indexes.
const DAILY_TOOL_PATHS = ['/chart', '/replay', '/forecast'];

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
    '/dashboard',
    '/dashboard/*',
    // Admin
    '/admin',
    '/admin/*',
    // Invitation-only founding-member activation page — not in sitemap and
    // marked noindex,nofollow at the page level.
    '/founding',
    // /landing is served by a 308 redirect to / (see next.config.ts)
    '/landing',
    // 301 redirect to /education/gamma-exposure-explained — keep the source
    // URL out of the sitemap so Google stops finding it via discovery and
    // funnels signals into the pillar instead.
    '/education/decoding-gamma-exposure',
    // Auth-gated tools — middleware 307s anonymous Googlebot to /login,
    // which Google Search Console reports as "Page with redirect".
    '/trade-bias',
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
    '/live-bulletin',
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
    '/backtesting',
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

  // The root layout reads cookies(), which opts every route into dynamic
  // rendering — so only the force-static gamma-levels pages are prerendered
  // and auto-discovered here. That silently dropped the homepage, /articles,
  // /education, and every markdown-backed content page from the sitemap.
  // Enumerate the public content routes explicitly so they are always
  // included; each is run through the same transform() below for a consistent
  // lastmod/priority/changefreq. Excluded/redirected slugs are filtered out.
  additionalPaths: async (cfg) => {
    const routes = [
      '/',
      '/about',
      '/articles',
      // The free delayed chart and the two public daily tools. All three are
      // public, self-canonical and rendered per request (they read the session
      // or searchParams), so they were never prerendered and never made it
      // into the sitemap. Only their index pages are listed: the dated
      // /replay and /forecast permalinks are discovered from those.
      '/chart',
      '/education',
      '/forecast',
      '/giving',
      '/guides',
      '/help',
      '/help/faqs',
      '/help/quickstarts',
      // The chart-integration hub and the four platform landings under it
      // (/integrations, /ninjatrader-, /sierra-chart-, /thinkorswim- and
      // /tradingview-indicator) are listed as literals rather than imported
      // from core/integrations.ts: this config is loaded by next-sitemap as
      // plain ESM outside the Next build, so the '@/...' alias it would need
      // does not resolve here. tests/integrations.test.ts asserts the two
      // lists agree, so the duplication is checked rather than trusted.
      '/integrations',
      '/methodology',
      '/ninjatrader-indicator',
      '/pricing',
      '/privacy',
      '/real-time-gex-0dte',
      '/replay',
      '/sierra-chart-indicator',
      '/terms',
      '/thinkorswim-indicator',
      '/trading-mistakes',
      '/tradingview-indicator',
      '/updates',
    ];

    const addDir = (dir, toRoute) => {
      const abs = path.join(PROJECT_ROOT, dir);
      if (!fs.existsSync(abs)) return;
      for (const file of fs.readdirSync(abs)) {
        // Localizations are cookie-selected variants of the canonical route,
        // not standalone URLs. Emitting `slug.de` etc. created sitemap-only
        // 404s and wasted Googlebot's crawl budget.
        if (file.endsWith('.md') && !/\.(de|es|fr|it)\.md$/.test(file)) {
          routes.push(toRoute(file.replace(/\.md$/, '')));
        }
      }
    };
    addDir('content/articles', (slug) => `/education/${slug}`);
    addDir('content/guides', (slug) => `/guides/${slug}`);
    addDir('content/help/platform', (slug) => `/help/platform/${slug}`);

    // Paths already auto-emitted (the force-static gamma pages) or intentionally
    // kept out of the sitemap. Skipping the gamma pages avoids a duplicate <url>.
    const skip = new Set([
      '/education/decoding-gamma-exposure',
      ...GAMMA_LEVEL_PATHS,
    ]);

    const seen = new Set();
    const out = [];
    for (const route of routes) {
      if (skip.has(route) || seen.has(route)) continue;
      seen.add(route);
      out.push(await cfg.transform(cfg, route));
    }
    return out;
  },

  transform: async (config, urlPath) => {
    const lastmod = lastmodFor(urlPath);

    if (urlPath === '/') {
      return { loc: urlPath, changefreq: 'weekly', priority: 1.0, lastmod };
    }
    if (urlPath === '/pricing') {
      return { loc: urlPath, changefreq: 'monthly', priority: 0.9, lastmod };
    }
    if (DAILY_TOOL_PATHS.includes(urlPath)) {
      // Refreshed every market day like the gamma pages, one notch below them.
      return { loc: urlPath, changefreq: 'daily', priority: 0.8, lastmod };
    }
    if (GAMMA_LEVEL_PATHS.includes(urlPath)) {
      // Ticker-first lead-magnet pages — the SEO landings for "<ticker> gamma
      // levels" intent searches. Each is self-canonical and refreshed
      // every market day, so daily changefreq matches reality and the priority
      // sits just below the homepage.
      return { loc: urlPath, changefreq: 'daily', priority: 0.95, lastmod };
    }
    if (urlPath.startsWith('/education') || urlPath.startsWith('/guides') || urlPath === '/articles') {
      return { loc: urlPath, changefreq: 'monthly', priority: 0.7, lastmod };
    }
    if (urlPath.startsWith('/help')) {
      return { loc: urlPath, changefreq: 'monthly', priority: 0.7, lastmod };
    }
    return { loc: urlPath, changefreq: 'monthly', priority: 0.6, lastmod };
  },
};

export default config;
