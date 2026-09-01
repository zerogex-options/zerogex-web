import type { ReactNode } from 'react';
import BreadcrumbJsonLd from './BreadcrumbJsonLd';
import LandingHeader from './LandingHeader';
import SiteFooter from './SiteFooter';

// Page chrome shared by the /integrations hub and the four platform landings
// under it. Identical shell to the free gamma-levels pages — landing nav,
// 1080px column, site footer — so an integration page reads as the same site
// rather than a bolted-on microsite.
export default function IndicatorPageShell({
  crumb,
  path,
  parent,
  jsonLd,
  children,
}: {
  /** Breadcrumb label for this page. */
  crumb: string;
  /** Site-relative path, used for the breadcrumb item URL. */
  path: string;
  /**
   * Optional intermediate crumb, so the four platform pages sit UNDER the hub
   * (Home › Chart Integrations › TradingView Indicator) rather than beside it.
   * Passing it is what tells Google these pages are a set with a parent — and
   * it is what stops the nav collapse from orphaning them, since the hub link
   * is now the only one in the menus.
   */
  parent?: { name: string; url: string };
  /** schema.org payload for the integration itself (SoftwareApplication). */
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
          ...(parent ? [parent] : []),
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
