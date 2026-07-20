import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { renderMarkdown } from '@/components/MarkdownContent';
import { HELP_ARTICLES, getHelpArticleBySlug, getHelpNeighbors } from '@/core/helpRegistry';
import { loadLocalizedMarkdown } from '@/core/localizedContent';

type Params = { slug: string };

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getHelpArticleBySlug(slug);
  if (!article) return {};
  return {
    title: `${article.title} — ZeroGEX Help`,
    description: article.description,
    alternates: { canonical: `/help/platform/${article.slug}` },
  };
}

const contentRoot = path.join(process.cwd(), 'content/help/platform');

export default async function HelpPlatformArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getHelpArticleBySlug(slug);
  if (!article) notFound();

  const filePath = path.join(contentRoot, `${article.slug}.md`);
  if (!fs.existsSync(filePath)) notFound();

  const markdown = await loadLocalizedMarkdown(filePath);
  const { prev, next } = getHelpNeighbors(article.slug);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/help/platform"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]"
      >
        <ArrowLeft size={14} />
        Back to Platform Guide
      </Link>

      <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        <Link href="/help" className="hover:text-[var(--color-warning)]">Help Center</Link>
        <span className="opacity-60">/</span>
        <Link href="/help/platform" className="hover:text-[var(--color-warning)]">Platform Guide</Link>
        <span className="opacity-60">/</span>
        <span className="text-[var(--color-text-primary)]">{article.title}</span>
      </nav>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <div className="mb-8 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
          ZeroGEX Help • {article.section}
        </div>
        <div className="blog-medium-style">{renderMarkdown(markdown)}</div>
      </article>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/help/platform/${prev.slug}`}
            className="zg-feature-shell group flex flex-col gap-1 p-5 transition hover:border-[var(--color-warning-soft)]"
          >
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
              <ArrowLeft size={12} />
              Previous
            </span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{prev.title}</span>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/help/platform/${next.slug}`}
            className="zg-feature-shell group flex flex-col gap-1 p-5 text-right transition hover:border-[var(--color-warning-soft)]"
          >
            <span className="inline-flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
              Next
              <ArrowRight size={12} />
            </span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{next.title}</span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
