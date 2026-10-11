import type { Metadata } from 'next';
import { SITE_NAME } from '@/core/articleRegistry';
import { OG_IMAGE_PATH, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '@/core/ogImageManifest';

// /forecast/cone is a client component and cannot export metadata, so the
// page's title, description and canonical live here. Without them this public
// page was indexed under the homepage title with no canonical at all.
export const metadata: Metadata = {
  title: 'Intraday Forecast Cone: Range Bands, Graded Every 15 Minutes',
  description:
    'Every 15 minutes the cone re-anchors on the current bar and commits a range band and probability for each horizon left in the session, then grades them all.',
  alternates: { canonical: '/forecast/cone' },
  // Restates the root image because a page-level openGraph replaces the
  // root's object rather than merging into it (see app/layout.tsx).
  openGraph: {
    url: '/forecast/cone',
    siteName: SITE_NAME,
    images: [{ url: OG_IMAGE_PATH, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: 'ZeroGEX Options Analytics Platform' }],
    locale: 'en_US',
    type: 'website',
  },
};

export default function ForecastConeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
