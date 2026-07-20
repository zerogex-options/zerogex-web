import {
  SITE_CONTACT_EMAIL,
  SITE_DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_ORG_DESCRIPTION,
  SITE_SAME_AS,
  SITE_URL,
} from '@/core/articleRegistry';

/**
 * Site-wide schema.org structured data, rendered once from the root layout.
 *
 * Emits two linked nodes:
 *   - Organization — the ZeroGEX brand entity (logo, contact, and `sameAs`
 *     profile links). Feeds the brand knowledge panel, the brand SERP, and
 *     answer-engine / AI-overview entity reconciliation. Previously the brand
 *     only appeared as a nested `publisher` inside per-article JSON-LD, with no
 *     top-level entity node and no `sameAs`.
 *   - WebSite — the site entity, tied back to the Organization as publisher.
 *
 * No SearchAction / sitelinks searchbox is emitted: Google requires it to point
 * at a working on-site search results page (e.g. /search?q={term}), which the
 * site does not currently expose. Wire it up here once a real search route
 * exists — a fabricated target would be invalid structured data.
 */
export default function SiteJsonLd() {
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_ORG_DESCRIPTION,
      email: SITE_CONTACT_EMAIL,
      logo: {
        '@type': 'ImageObject',
        url: SITE_DEFAULT_OG_IMAGE,
      },
      sameAs: SITE_SAME_AS,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-US',
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Payload is built from typed constants with no user input —
      // dangerouslySetInnerHTML is correct here and matches ArticleJsonLd.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
