import type { Metadata } from 'next';
import BrokersClient from './Client';
import { BROKER_ROWS, brokerAffiliateUrl } from './brokerData';

// Public /brokers comparison page. Server-rendered so the JSON-LD ships
// with the initial HTML (SEO + AI overview eligibility); the row buttons
// hand off to the client component for click tracking.

const PAGE_TITLE = 'Best options brokers for trading dealer gamma | ZeroGEX';
const PAGE_DESCRIPTION =
  'Six options-friendly brokers our readers use to trade the dealer-gamma setups we publish. Honest side-by-side comparison — commissions, approval speed, API access — no ranking.';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');
const CANONICAL = `${SITE_URL}/brokers`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/brokers' },
  openGraph: {
    type: 'website',
    url: CANONICAL,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: 'ZeroGEX',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default function BrokersPage() {
  // Server-side JSON-LD. `Product` schema for each broker with the
  // affiliate URL as its offer target. Google/Bing accept these for
  // rich-result eligibility; if any URL is unset (env not yet
  // populated) we fall back to the broker's plain homepage.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': BROKER_ROWS.map((broker) => ({
      '@type': 'Product',
      name: broker.name,
      description: broker.tagline,
      brand: { '@type': 'Brand', name: broker.name },
      url: brokerAffiliateUrl(broker),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BrokersClient />
    </>
  );
}
