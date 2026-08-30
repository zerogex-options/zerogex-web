import type { ReactNode } from 'react';
import BreadcrumbJsonLd from './BreadcrumbJsonLd';
import LandingHeader from './LandingHeader';
import SiteFooter from './SiteFooter';

// Page chrome shared by the two indicator landings (/tradingview-indicator and
// /ninjatrader-indicator). Identical shell to the free gamma-levels pages —
// landing nav, 1080px column, site footer — so an indicator page reads as the
// same site rather than a bolted-on microsite.
export default function IndicatorPageShell({
  crumb,
  path,
  jsonLd,
  children,
}: {
  /** Breadcrumb label for this page (the trail is Home › crumb). */
  crumb: string;
  /** Site-relative path, used for the breadcrumb item URL. */
  path: string;
  /** schema.org payload for the indicator itself (SoftwareApplication). */
  jsonLd: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <script
        type="application/ld+json"
        // Built from typed props with no user input — same pattern as
        // BreadcrumbJsonLd / ArticleJsonLd.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: crumb, url: path },
        ]}
      />

      <LandingHeader />

      <main style={{ flex: 1, maxWidth: 1080, margin: '0 auto', padding: '120px 24px 80px', width: '100%' }}>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
