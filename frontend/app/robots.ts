import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Do not block HTML routes here. Auth utility pages carry a crawlable
        // noindex directive, permanent redirects need to be crawlable so Google
        // can consolidate them, and protected routes return X-Robots-Tag from
        // proxy.ts. A robots.txt block would hide all three signals and can
        // leave a URL indexed without a useful snippet.
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
