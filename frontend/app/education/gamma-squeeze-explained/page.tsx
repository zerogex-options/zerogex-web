import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleMeta from '@/components/ArticleMeta';
import ArticleFaq from '@/components/ArticleFaq';
import RelatedArticles from '@/components/RelatedArticles';
import { articleMetadata } from '@/core/articleRegistry';
import GexMethodologyNote from '@/components/GexMethodologyNote';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

// "gamma squeeze", "what is a gamma squeeze", "gamma squeeze explained" and
// "gamma squeeze vs short squeeze" are the most-searched terms in this topic
// space, and until 2026-11-22 no page on the site used the phrase: the
// mechanism was spread across the negative-gamma and call-wall explainers
// under other names. This is the one page for that intent. The negative-gamma
// explainer keeps the regime, the call-wall explainer keeps the level, and all
// three cross-link. It says plainly what an open-interest GEX model cannot see
// in a squeeze (who bought the calls), which is the same limit the wall-break
// study states.
export const metadata = articleMetadata('gamma-squeeze-explained');

const articlePath = path.join(process.cwd(), 'content/articles/gamma-squeeze-explained.md');

export default async function GammaSqueezeExplainedPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-6 sm:py-12">
      <ArticleJsonLd slug="gamma-squeeze-explained" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="zg-article-card">
        <ArticleMeta slug="gamma-squeeze-explained" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="gamma-squeeze-explained" />

      <RelatedArticles slug="gamma-squeeze-explained" />

      <GexMethodologyNote />
      <LiveLevelsCTA concept="gamma flip and walls" />
    </div>
  );
}
