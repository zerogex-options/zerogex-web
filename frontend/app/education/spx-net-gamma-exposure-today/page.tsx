import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { renderMarkdown } from '@/components/MarkdownContent';
import ArticleJsonLd from '@/components/ArticleJsonLd';
import ArticleMeta from '@/components/ArticleMeta';
import ArticleFaq from '@/components/ArticleFaq';
import RelatedArticles from '@/components/RelatedArticles';
import GexMethodologyNote from '@/components/GexMethodologyNote';
import LiveLevelsCTA from '@/components/LiveLevelsCTA';
import DelayedLevelsTable from '@/components/DelayedLevelsTable';
import { articleMetadata } from '@/core/articleRegistry';
import { loadLocalizedMarkdown } from '@/core/localizedContent';
import { serverApiGet } from '@/core/api/serverFetch';
import { netGexAtSpotOrNull } from '@/core/gammaRegime';
import { fmtNetGex, fmtPrice, fmtTimestampET, levelsSentence, type GexSummary } from '@/core/gexSummary';

// This page ranks for the largest non-brand query cluster in Search Console —
// "spx net gex current value", "spx net gex dollar gamma current", "spx net
// gamma exposure current", "spx 0dte net gex current" and a dozen variants,
// ~450 impressions a month — and sat at positions 19-35 for all of them,
// because it explained the number without showing it. It now opens with
// today's delayed reading, pulled from the same endpoint and the same 900s
// fetch-cache window as /spx-gamma-levels (so the two pages share one cache
// entry and can never disagree), and leads the meta description with the
// value the way the gamma-levels snippet does. The explainer follows.

const SLUG = 'spx-net-gamma-exposure-today';
const articlePath = path.join(process.cwd(), 'content/articles/spx-net-gamma-exposure-today.md');

function loadSpxSummary() {
  return serverApiGet<GexSummary>('/api/gex/summary?symbol=SPX&underlying=SPX', 900);
}

export async function generateMetadata(): Promise<Metadata> {
  const base = articleMetadata(SLUG);
  const data = await loadSpxSummary();
  const netGex = netGexAtSpotOrNull(data?.net_gex_at_spot);
  if (!data || netGex === null) return base;

  // Value first, then the levels while the line stays inside the ~155
  // characters Google renders; the evergreen sentence closes it. Falls back to
  // the registry description whenever the snapshot has no net GEX, so a
  // half-empty snippet never ships.
  const head = `SPX net GEX ${fmtNetGex(netGex)} as of ${fmtTimestampET(data.timestamp)}`;
  const tail = '. What the current SPX net gamma exposure value means, and how to read it.';
  const optional: string[] = [];
  if (data.gamma_flip != null) optional.push(`gamma flip ${fmtPrice(data.gamma_flip)}`);
  if (data.call_wall != null) optional.push(`call wall ${fmtPrice(data.call_wall)}`);
  if (data.put_wall != null) optional.push(`put wall ${fmtPrice(data.put_wall)}`);
  let out = head;
  for (const part of optional) {
    const next = `${out} · ${part}`;
    if (next.length + tail.length > 155) break;
    out = next;
  }
  const description = out + tail;
  return {
    ...base,
    description,
    openGraph: { ...base.openGraph, description },
    twitter: { ...base.twitter, description },
  };
}

// The answer block. Rendered directly under the H1 and standfirst so the page
// answers the query before it explains it; every number is the same delayed
// snapshot the free levels pages show, formatted by the same helpers.
function CurrentNetGex({ data }: { data: GexSummary | null }) {
  const netGex = netGexAtSpotOrNull(data?.net_gex_at_spot);
  const linkClass = 'font-medium text-[var(--color-warning)] underline-offset-2 hover:underline';

  if (!data || netGex === null) {
    return (
      <section
        aria-labelledby="current-net-gex"
        className="my-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 md:p-8"
      >
        <h2 id="current-net-gex" className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">
          Current SPX net GEX
        </h2>
        <p className="text-[17px] leading-8 text-[var(--text-secondary)]">
          Today&rsquo;s delayed SPX net GEX is briefly unavailable here. The free{' '}
          <Link href="/spx-gamma-levels" className={linkClass}>
            SPX gamma levels page
          </Link>{' '}
          carries the same reading, refreshed roughly every 15 minutes.
        </p>
      </section>
    );
  }

  const positive = netGex >= 0;
  const levels = levelsSentence(data);

  return (
    <section
      aria-labelledby="current-net-gex"
      className="my-8 rounded-2xl border border-[var(--color-warning-soft)] bg-[var(--color-surface-subtle)] p-6 md:p-8"
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
        Free · delayed ~15 minutes · refreshed through the session
      </div>
      <h2 id="current-net-gex" className="mb-3 text-2xl font-bold text-[var(--color-text-primary)]">
        Current SPX net GEX: {fmtNetGex(netGex)}
      </h2>
      <p className="text-[17px] leading-8 text-[var(--text-secondary)]">
        As of {fmtTimestampET(data.timestamp)}, SPX net gamma exposure at spot is{' '}
        <strong className="text-[var(--color-text-primary)]">{fmtNetGex(netGex)}</strong> — a{' '}
        {positive ? 'positive' : 'negative'}-gamma regime,{' '}
        {positive
          ? 'in which dealers are modeled net long gamma and hedging tends to dampen moves'
          : 'in which dealers are modeled net short gamma and hedging tends to amplify moves'}
        .
        {data.gamma_flip != null ? (
          <>
            {' '}The zero-cross — the gamma flip, or zero gamma level — sits at {fmtPrice(data.gamma_flip)}
            {data.spot_price != null ? <>, with SPX spot at {fmtPrice(data.spot_price)}</> : null}.
          </>
        ) : null}
        {levels ? <> {levels}</> : null}
      </p>
      <DelayedLevelsTable symbol="SPX" data={data} />
      <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
        Same snapshot as the free{' '}
        <Link href="/spx-gamma-levels" className={linkClass}>
          SPX gamma levels page
        </Link>{' '}
        (also{' '}
        <Link href="/spy-gamma-levels" className={linkClass}>
          SPY
        </Link>
        ,{' '}
        <Link href="/qqq-gamma-levels" className={linkClass}>
          QQQ
        </Link>{' '}
        and{' '}
        <Link href="/ndx-gamma-levels" className={linkClass}>
          NDX
        </Link>
        ). For the live, session-long value,{' '}
        <Link href="/register" className={linkClass}>
          start a free trial
        </Link>
        . Modeled dealer gamma under the call-positive / put-negative convention — not observed inventory.
      </p>
    </section>
  );
}

export default async function SpxNetGammaExposureTodayPage() {
  const [markdown, data] = await Promise.all([loadLocalizedMarkdown(articlePath), loadSpxSummary()]);
  const nodes = renderMarkdown(markdown);
  // The markdown opens with the H1 and its italic standfirst; the live reading
  // slots in directly under them, ahead of the first rule and section.
  const lead = nodes.slice(0, 2);
  const rest = nodes.slice(2);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <ArticleJsonLd slug={SLUG} />
      <Link href="/articles" className="mb-8 inline-block text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        ← Back to Articles
      </Link>

      <article className="rounded-3xl border border-[var(--color-border)] bg-[var(--bg-card)]/95 px-8 py-10 shadow-[0_20px_60px_var(--color-info-soft)] md:px-14">
        <ArticleMeta slug={SLUG} />
        <div className="blog-medium-style">{lead}</div>
        <CurrentNetGex data={data} />
        <div className="blog-medium-style">{rest}</div>
      </article>

      <ArticleFaq slug={SLUG} />

      <RelatedArticles slug={SLUG} />

      <GexMethodologyNote />
      <LiveLevelsCTA concept="SPX net GEX" />
    </div>
  );
}
