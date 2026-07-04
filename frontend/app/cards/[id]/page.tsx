import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import ShareCardButton from '@/components/ShareCardButton';
import { StandDownCard, TradeCard } from '@/components/ActionCard';
import BrokerCTA from '@/components/BrokerCTA';
import { serverApiGet } from '@/core/api/serverFetch';
import type { SignalActionResponse } from '@/hooks/useApiData';

// Public permalink for a single Playbook Action Card. Server-rendered so the
// OG image preview matches what a Twitter/Discord/Slack crawler sees, and so
// the card data is baked into the HTML for indexing. ISR-cached for one hour
// since closed cards are immutable and open cards only matter for the brief
// window before they resolve — the live /trading-signals dashboard is the
// real-time surface; this page is the shareable receipt.

const REVALIDATE_SECONDS = 3600;

interface CardPayload extends SignalActionResponse {
  id?: number;
  created_at?: string;
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zerogex.io').replace(/\/+$/, '');

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function loadCard(cardId: number): Promise<CardPayload | null> {
  return serverApiGet<CardPayload>(`/api/signals/action/${cardId}`, REVALIDATE_SECONDS);
}

function humanizeWords(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildTweetText(card: CardPayload | null, fallback: string): string {
  if (!card) return fallback;
  const symbol = (card.underlying || 'SPY').toUpperCase();
  const action = humanizeWords(String(card.action ?? ''));
  if (!action || action.toUpperCase() === 'STAND DOWN') {
    return `Stand Down on ${symbol} — no tradable structure right now.`;
  }
  const entryPrice = typeof card.entry?.ref_price === 'number' ? `$${card.entry.ref_price.toFixed(2)}` : null;
  const targetPrice = typeof card.target?.ref_price === 'number' ? `$${card.target.ref_price.toFixed(2)}` : null;
  const confidence =
    typeof card.confidence === 'number' ? ` · conf ${card.confidence.toFixed(2)}` : '';
  if (entryPrice && targetPrice) {
    return `${symbol} ${action} — entry ${entryPrice} → target ${targetPrice}${confidence}.`;
  }
  return `${symbol} ${action}${confidence}.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cardId = parseId(id);
  if (cardId == null) {
    return {
      title: 'Action Card not found — ZeroGEX',
      robots: { index: false, follow: false },
    };
  }
  const card = await loadCard(cardId);
  const symbol = (card?.underlying || 'SPY').toUpperCase();
  const action = humanizeWords(String(card?.action ?? '')) || 'Action Card';
  const pattern = humanizeWords(String(card?.pattern ?? ''));
  const title = card
    ? `${symbol} ${action}${pattern ? ` · ${pattern}` : ''} — ZeroGEX Card #${cardId}`
    : `Action Card #${cardId} — ZeroGEX`;
  const description = card?.rationale
    ? String(card.rationale)
    : 'A decisive Playbook trade card emitted by the ZeroGEX engine — dealer positioning + signal confluence + structural levels in one instruction.';
  const url = `${SITE_URL}/cards/${cardId}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'ZeroGEX',
      // Next.js convention: the colocated opengraph-image.tsx wins. Listing
      // the absolute URL here is belt-and-braces for non-Next consumers.
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
    robots: card ? undefined : { index: false, follow: false },
  };
}

export default async function ActionCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cardId = parseId(id);
  if (cardId == null) notFound();
  const card = await loadCard(cardId);
  if (!card) notFound();

  const isStandDown = String(card.action ?? '').toUpperCase() === 'STAND_DOWN';
  const symbol = (card.underlying || 'SPY').toUpperCase();
  const tweetText = buildTweetText(card, `ZeroGEX Action Card #${cardId} for ${symbol}.`);
  const cardUrl = `${SITE_URL}/cards/${cardId}`;
  const issuedAt = card.timestamp ? new Date(String(card.timestamp)) : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/trading-signals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft size={14} /> Trading Signals
        </Link>
        <ShareCardButton cardId={cardId} tweetText={tweetText} cardUrl={cardUrl} />
      </div>

      <header className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          ZeroGEX · Action Card #{cardId}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {symbol} · {humanizeWords(String(card.action ?? '')) || 'Action Card'}
        </h1>
        {issuedAt && !Number.isNaN(issuedAt.getTime()) && (
          <div className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">
            Issued {issuedAt.toISOString()}
          </div>
        )}
      </header>

      {isStandDown ? <StandDownCard data={card} /> : <TradeCard data={card} />}

      <BrokerCTA surface="card" variant="inline" />

      <section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
        <div className="mb-1 text-[10px] uppercase tracking-[0.22em] font-bold">About this card</div>
        Every cycle (~1 minute) the ZeroGEX Playbook engine fuses dealer positioning, options
        flow, the Market State Index, and live structural levels into one decisive instruction.
        This is the permanent receipt for card <span className="font-mono">#{cardId}</span> —
        the entry, stop, target, and reasoning at the moment it was emitted. Closed Action
        Cards never re-write; the engine cannot retroactively edit a published call. Live
        positioning lives on{' '}
        <Link href="/trading-signals" className="underline">
          /trading-signals
        </Link>
        .
      </section>
    </main>
  );
}
