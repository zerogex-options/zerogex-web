import path from 'node:path';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import RelatedArticles from '@/components/RelatedArticles';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import { articleMetadata } from '@/core/articleRegistry';
import { getServerT, loadLocalizedMarkdown } from '@/core/localizedContent';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = articleMetadata('spx-net-gamma-exposure-today');
  const t = await getServerT(metaDict);
  return {
    ...base,
    title: t('title'),
    description: t('description'),
    openGraph: base.openGraph ? { ...base.openGraph, title: t('title'), description: t('description') } : base.openGraph,
    twitter: base.twitter ? { ...base.twitter, title: t('title'), description: t('description') } : base.twitter,
  };
}

const articlePath = path.join(process.cwd(), 'content/articles/spx-net-gamma-exposure-today.md');

export default async function SpxNetGammaExposureTodayPage() {
  const markdown = await loadLocalizedMarkdown(articlePath);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug="spx-net-gamma-exposure-today" />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">ZeroGEX Education • 9 min read</div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <RelatedArticles slug="spx-net-gamma-exposure-today" />

      <LiveLevelsCTA concept="SPX net GEX" />
    </div>
  );
}
