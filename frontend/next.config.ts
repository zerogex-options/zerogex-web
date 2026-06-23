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
    ];
  },
};

export default nextConfig;
