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

// The landing for "gamma levels in Claude" / "SPX GEX MCP server" / "options
// data for AI assistants" — a query cluster with rising volume and, at the time
// of writing, no good answer written for it. We have the only free, keyless
// index-gamma MCP server, which makes this a page we can write honestly and
// nobody else can copy without shipping one.
//
// It leads with the failure it fixes rather than the feature: an assistant
// asked for a gamma flip with no source will invent one, confidently. That is
// the reason to connect anything at all, and the section on telling a real
// answer from a fabricated one is the part worth the reader's time.
export const metadata = articleMetadata('gamma-levels-in-claude');

const articlePath = path.join(process.cwd(), 'content/articles/gamma-levels-in-claude.md');

export default async function GammaLevelsInClaudePage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="gamma-levels-in-claude" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <ArticleMeta slug="gamma-levels-in-claude" />
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <ArticleFaq slug="gamma-levels-in-claude" />

      <RelatedArticles slug="gamma-levels-in-claude" />

      <GexMethodologyNote />
      <LiveLevelsCTA concept="gamma exposure" />
    </div>
  );
}
