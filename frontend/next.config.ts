import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/landing',
        destination: '/',
        permanent: true,
      },
      {
        // 301 to the pillar guide. /decoding-gamma-exposure overlapped heavily
        // with /gamma-exposure-explained and was sitting at position ~60 while
        // the pillar was at ~33 — consolidating into the pillar concentrates
        // authority on a single GEX-intent landing page.
        source: '/education/decoding-gamma-exposure',
        destination: '/education/gamma-exposure-explained',
        permanent: true,
      },
      {
        // Two URLs GSC reported under "Not found (404)" because old external
        // links keep pointing at routes the app no longer ships. Redirect to
        // the public gamma-levels landing rather than 404ing so any link
        // equity still flows somewhere useful.
        source: '/charts',
        destination: '/spx-gamma-levels',
        permanent: true,
      },
      {
        source: '/position-optimizer',
        destination: '/spx-gamma-levels',
        permanent: true,
      },
      {
        // SEO consolidation. GSC reported >half the education library as
        // "Discovered/Crawled - currently not indexed"; two SPY articles were
        // near-duplicates of a stronger sibling. Their unique content (the
        // reversal framing; the five-signs checklist + pinned-tape playbook)
        // was folded into the survivor, then the thin duplicate is 301'd so
        // Google consolidates the signal onto one indexable page per intent.
        source: '/education/why-spy-reverses-at-levels',
        destination: '/education/options-support-and-resistance',
        permanent: true,
      },
      {
        source: '/education/how-to-know-if-spy-is-pinned',
        destination: '/education/why-spy-pins-near-strikes',
        permanent: true,
      },
      {
        // Search Console lists 224 URLs under "Not found (404)", and nearly all
        // of them have one shape: /education/<slug>.de (and .es, .fr, .it),
        // plus the same suffixes under /guides and /help/platform. Those are
        // the cookie-selected markdown translations (content/articles/*.de.md
        // etc.), which an earlier sitemap build emitted as if they were
        // standalone pages. The sitemap stopped listing them, but Google keeps
        // recrawling them from its own index and reporting each as an error.
        // Every one of them is a translation of an English page that exists,
        // so send it there with a 301: the error report drains instead of
        // lingering, and whatever links or signals those URLs collected
        // consolidate onto the canonical route rather than dying at a 404.
        // The slug class is deliberately narrow so a real file-ish path
        // (nothing under these prefixes has one) cannot be caught by accident.
        source: '/education/:slug([a-z0-9-]+).:locale(de|es|fr|it)',
        destination: '/education/:slug',
        permanent: true,
      },
      {
        source: '/guides/:slug([a-z0-9-]+).:locale(de|es|fr|it)',
        destination: '/guides/:slug',
        permanent: true,
      },
      {
        source: '/help/platform/:slug([a-z0-9-]+).:locale(de|es|fr|it)',
        destination: '/help/platform/:slug',
        permanent: true,
      },
    ];
  },

  // Clickjacking defense, with one deliberate hole in it.
  //
  // In production this is belt AND braces: deploy/steps/070.ssl already adds
  // `X-Frame-Options "DENY"` at the nginx server level, so a normal page goes
  // out carrying both that and the SAMEORIGIN below. nginx `add_header`
  // appends rather than replaces, and a browser reading a conflicting pair
  // takes the stricter — DENY — which is the intended production policy. The
  // app-level header is kept anyway because it is the only framing protection
  // in any environment that is NOT behind that nginx: local dev, a preview
  // deploy, a different reverse proxy. It never weakens production and it
  // stops a new environment shipping with no policy at all.
  //
  // nginx carves out the same /embed/ exception with a regex location; see the
  // comment there for why the prefix form could not be used.
  //
  // Nothing set a framing policy before, which meant every page on the site —
  // /login, /account, the billing screens — could be loaded into a frame on
  // any origin. Default to SAMEORIGIN everywhere.
  //
  // /embed/* is the exception, and it is the whole point of the widget: those
  // frames exist to be rendered inside other people's pages, so the route
  // handler sets its own `Content-Security-Policy: frame-ancestors *`. The
  // negative lookahead below keeps this rule off that path entirely, because
  // an X-Frame-Options header here would be the stricter of the two and would
  // silently break every published embed. The embed route carries nothing
  // private — no cookies, no session, no member data — so there is nothing for
  // a hostile framer to steal from it.
  async headers() {
    return [
      {
        // `embed/` with the slash: the per-symbol FRAMES are the exception,
        // not the /embed builder page, which is an ordinary landing and has
        // the same reason as every other page to refuse being framed.
        source: '/((?!embed/).*)',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        // The resizer runs on third-party origins, so it has to be fetchable
        // from them, and it is safe to hold for a long time: it is versionless
        // by design and its behavior is fixed.
        source: '/embed.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
