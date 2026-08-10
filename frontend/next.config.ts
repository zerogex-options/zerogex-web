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
    ];
  },
};

export default nextConfig;
