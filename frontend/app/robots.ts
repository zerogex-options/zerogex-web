import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Auth & user chrome. /login and /register are intentionally
        // crawlable: each carries a page-level noindex,follow tag so Google
        // can see the directive and drop the URL from the index (the
        // /login?next=... duplicates GSC was flagging, plus any externally-
        // linked /register entry). Blocking either here would hide the meta
        // tag and let Google index the URL anyway.
        '/forgot-password',
        '/reset-password',
        '/unauthorized',
        // User-scoped data routes that exist only behind auth.
        '/account',
        // Admin — belt-and-suspenders even though middleware 307s anonymous
        // traffic with an X-Robots-Tag header.
        '/admin',
        // Replaced by 308 redirect to /
        '/landing',
        // NOTE on tier-gated tools (/dashboard, /gamma-exposure, /max-pain,
        // /signal-score, /trading-signals, /intraday-tools, /options-calculator,
        // and the rest of the basic/pro routes): these used to live here as
        // robots.txt disallows. The seven URLs GSC was reporting under
        // "Indexed, though blocked by robots.txt" proved that approach doesn't
        // work — external links got the URLs into the index, and the
        // robots.txt block then prevented Googlebot from ever seeing a noindex
        // directive. Middleware (proxy.ts) now attaches X-Robots-Tag:
        // "noindex, follow" to the 307 it returns for anonymous traffic on
        // each of those routes, which is the only mechanism that reliably
        // pulls them out of the index. Keeping them crawlable is required so
        // the header is visible.
        // Internals. /_next/data is the only branch we want hidden — the
        // /_next/static tree carries the CSS, JS, and font bundles Google
        // needs to render and rank pages, so blocking the whole /_next prefix
        // (which previously hid e.g. .woff2 fonts in GSC) hurts indexing.
        '/api',
        '/_next/data',
        '/checkout',
      ],
    },
    sitemap: 'https://zerogex.io/sitemap.xml',
    host: 'https://zerogex.io',
  };
}
