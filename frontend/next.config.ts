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
        source: '/underlying-price-action',
        destination: '/price-action',
        permanent: true,
      },
      {
        source: '/option-contracts',
        destination: '/options-chain',
        permanent: true,
      },
      {
        source: '/gamma-exposure',
        destination: '/dealer-positioning',
        permanent: true,
      },
      {
        source: '/greeks-gex',
        destination: '/gex-summary',
        permanent: true,
      },
      {
        source: '/intraday-tools',
        destination: '/technicals',
        permanent: true,
      },
      {
        source: '/options-calculator',
        destination: '/strategy-builder',
        permanent: true,
      },
      {
        source: '/signal-score',
        destination: '/composite-score',
        permanent: true,
      },
      {
        source: '/trading-signals',
        destination: '/signaled-trades',
        permanent: true,
      },
      {
        source: '/education',
        destination: '/learn',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
