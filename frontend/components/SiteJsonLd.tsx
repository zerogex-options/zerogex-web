import {
  FOUNDER_ID,
  ORGANIZATION_ID,
  PERSON_FOUNDER,
  SITE_CONTACT_EMAIL,
  SITE_DEFAULT_OG_IMAGE,
  SITE_LOGO,
  SITE_LOGO_HEIGHT,
  SITE_LOGO_WIDTH,
  SITE_NAME,
  SITE_ORG_DESCRIPTION,
  SITE_SAME_AS,
  SITE_URL,
  WEBSITE_ID,
} from '@/core/articleRegistry';

/**
 * Site-wide schema.org structured data, rendered once from the root layout.
 *
 * Emits three linked nodes:
 *   - Organization — the ZeroGEX brand entity (logo, contact, and `sameAs`
 *     profile links). Feeds the brand knowledge panel, the brand SERP, and
 *     answer-engine / AI-overview entity reconciliation. Previously the brand
 *     only appeared as a nested `publisher` inside per-article JSON-LD, with no
 *     top-level entity node and no `sameAs`.
 *   - Person — the founder, the author every Article node cites by @id
 *     (FOUNDER_ID, anchored on the /about#founder card). Emitted here so the
 *     @id resolves on every page, not only on /about.
 *   - WebSite — the site entity, tied back to the Organization as publisher,
 *     carrying a SearchAction (sitelinks searchbox) that points at the on-site
 *     /search results page. That route reads the `q` query parameter, so the
 *     urlTemplate below resolves to real results.
 */
export default function SiteJsonLd() {
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      // The second most common spelling of the brand in Search Console.
      alternateName: ['Zero GEX'],
      url: SITE_URL,
      description: SITE_ORG_DESCRIPTION,
      email: SITE_CONTACT_EMAIL,
      // A square mark, not the 1200x630 social card: Google's logo guidance
      // wants an actual logo, at least 112px, that reads on white.
      logo: {
        '@type': 'ImageObject',
        url: SITE_LOGO,
        width: SITE_LOGO_WIDTH,
        height: SITE_LOGO_HEIGHT,
      },
      image: SITE_DEFAULT_OG_IMAGE,
      founder: { '@id': FOUNDER_ID },
      sameAs: SITE_SAME_AS,
    },
    {
      '@context': 'https://schema.org',
      ...PERSON_FOUNDER,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { '@id': ORGANIZATION_ID },
      inLanguage: 'en-US',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
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
