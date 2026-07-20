import { getArticleFaq } from '@/core/articleFaq';

/**
 * Visible "Frequently asked questions" block plus the FAQPage JSON-LD mirrored
 * from the same source (core/articleFaq.ts), so the structured data always
 * matches on-page content — Google discards FAQ markup whose answers aren't
 * visible. Renders nothing for slugs without FAQ content, so it is safe to drop
 * into any article page. Mirrors the FAQ pattern already used on the gamma
 * levels pages.
 */
export default function ArticleFaq({ slug }: { slug: string }) {
  const faq = getArticleFaq(slug);
  if (!faq || faq.length === 0) return null;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section className="mt-8" aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        // Built from typed FAQ content with no user input — matches ArticleJsonLd.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-9 md:px-14">
        <h2 id="faq-heading" className="mb-7 text-2xl font-bold text-[var(--color-text-primary)]">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-6">
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">{f.q}</h3>
              <p className="text-[15px] leading-7 text-[var(--color-text-secondary)]">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
