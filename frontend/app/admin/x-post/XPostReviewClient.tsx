'use client';

import { useCallback, useEffect, useState } from 'react';

import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { getCsrfToken } from '@/core/csrfClient';

// Mirrors the backend build_latest_record shape (this is a client component
// and can't import the server-only core/xPost.ts module).
type Headline = {
  title: string;
  summary?: string;
  source?: string;
  link?: string | null;
  published?: string | null;
};

type XPostRecord = {
  mode: string;
  timing_label: string;
  symbol: string;
  date: string;
  generated_at: string | null;
  post_text: string;
  reply_text: string;
  fallback_text: string;
  headlines: Headline[];
  levels: Record<string, number | string | null> | null;
  media: { png: string | null; clip: string | null };
};

type Envelope = {
  ok?: boolean;
  symbol: string;
  mode: string;
  timing_label: string;
  record: XPostRecord | null;
};

const textColor = 'var(--color-text-primary)';
const mutedText = 'var(--color-text-secondary)';
const borderColor = 'var(--color-border)';
const cardBg = 'var(--color-surface)';
const subtleBg = 'var(--color-surface-subtle)';

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
}

export default function XPostReviewClient() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState('');
  const [timingLabel, setTimingLabel] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [postText, setPostText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [hasRecord, setHasRecord] = useState(false);

  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyEnvelope = useCallback((env: Envelope) => {
    setTimingLabel(env.timing_label || '');
    if (env.record) {
      setPostText(env.record.post_text || '');
      setReplyText(env.record.reply_text || '');
      setHeadlines(env.record.headlines || []);
      setGeneratedAt(env.record.generated_at);
      setDateStr(env.record.date);
      setHasRecord(true);
    } else {
      setPostText('');
      setReplyText('');
      setHeadlines([]);
      setGeneratedAt(null);
      setDateStr(null);
      setHasRecord(false);
    }
  }, []);

  const loadLatest = useCallback(
    async (sym: string) => {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/admin/x-post/latest?symbol=${encodeURIComponent(sym)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = (await res.json()) as Envelope & { error?: string };
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        applyEnvelope(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load the latest post');
      } finally {
        setLoading(false);
      }
    },
    [applyEnvelope],
  );

  // Initial load: configured symbols, then the latest for the default symbol.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/x-post/symbols', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = (await res.json()) as { symbols?: string[]; default?: string; error?: string };
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        const syms = data.symbols && data.symbols.length ? data.symbols : ['SPY'];
        const def = data.default || syms[0];
        setSymbols(syms);
        setSymbol(def);
        await loadLatest(def);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLatest]);

  const onSymbolChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const s = e.target.value;
      setSymbol(s);
      void loadLatest(s);
    },
    [loadLatest],
  );

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getCsrfToken();
      if (!token) throw new Error('Could not get a CSRF token — reload and try again.');
      const res = await fetch('/api/admin/x-post/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        credentials: 'same-origin',
        body: JSON.stringify({ symbol }),
      });
      const data = (await res.json()) as Envelope & { error?: string };
      if (!res.ok) throw new Error(data?.error || `Regenerate failed (${res.status})`);
      applyEnvelope(data);
      setNotice('Regenerated from the latest data + headlines.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }, [symbol, applyEnvelope]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied to clipboard.`);
    } catch {
      setNotice('Copy failed — select the text and copy manually.');
    }
  }, []);

  const postToX = useCallback(() => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [postText]);

  const btnBase =
    'px-3 py-1.5 text-sm font-semibold rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold" style={{ color: textColor }}>
          X Post Review
        </h1>
        <div className="flex items-center gap-2">
          <label htmlFor="xpost-symbol" className="text-sm" style={{ color: mutedText }}>
            Ticker
          </label>
          <select
            id="xpost-symbol"
            value={symbol}
            onChange={onSymbolChange}
            disabled={loading || regenerating || symbols.length === 0}
            className="px-2 py-1.5 text-sm font-semibold rounded-md"
            style={{ backgroundColor: cardBg, color: textColor, border: `1px solid ${borderColor}` }}
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={regenerate}
            disabled={loading || regenerating}
            className={btnBase}
            style={{ color: textColor, border: `1px solid var(--color-warning)` }}
          >
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      <p className="text-xs mb-5" style={{ color: mutedText }}>
        {timingLabel ? (
          <>
            Showing the <strong style={{ color: textColor }}>{timingLabel}</strong> — the current
            timing switches automatically at 9:15, 12:30 and 16:05 ET. Edit the copy below, then
            copy it to X. Regenerating pulls the latest gamma levels, price action and CNBC
            headlines.
          </>
        ) : (
          'The current timing switches automatically at 9:15, 12:30 and 16:05 ET.'
        )}
      </p>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={() => loadLatest(symbol)} />
        </div>
      )}

      {notice && (
        <p className="text-sm mb-4" style={{ color: 'var(--color-positive)' }} role="status">
          {notice}
        </p>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {!hasRecord && !error && (
            <div
              className="rounded-lg p-4 mb-5 text-sm"
              style={{ backgroundColor: subtleBg, border: `1px solid ${borderColor}`, color: mutedText }}
            >
              No post has been auto-generated for {symbol} at this timing yet. Click{' '}
              <strong style={{ color: textColor }}>Regenerate</strong> to create one now.
            </div>
          )}

          {/* Post + reply live together on one card — same text area group. */}
          <div
            className="rounded-lg p-4 mb-4"
            style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="xpost-body" className="text-sm font-semibold" style={{ color: textColor }}>
                Post {symbol ? `— $${symbol}` : ''}
              </label>
              <span className="text-xs tabular-nums" style={{ color: mutedText }}>
                {postText.length} chars
              </span>
            </div>
            <textarea
              id="xpost-body"
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={14}
              spellCheck
              className="w-full rounded-md p-3 text-sm font-mono leading-relaxed resize-y"
              style={{ backgroundColor: subtleBg, color: textColor, border: `1px solid ${borderColor}` }}
            />

            <div className="flex items-center justify-between mt-4 mb-2">
              <label htmlFor="xpost-reply" className="text-sm font-semibold" style={{ color: textColor }}>
                Reply (threaded)
              </label>
              <span className="text-xs tabular-nums" style={{ color: mutedText }}>
                {replyText.length} chars
              </span>
            </div>
            <textarea
              id="xpost-reply"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              spellCheck
              className="w-full rounded-md p-3 text-sm font-mono leading-relaxed resize-y"
              style={{ backgroundColor: subtleBg, color: textColor, border: `1px solid ${borderColor}` }}
            />

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={postToX}
                disabled={!postText.trim()}
                className={btnBase}
                style={{ color: '#fff', backgroundColor: '#1d9bf0' }}
              >
                Post to X →
              </button>
              <button
                type="button"
                onClick={() => copyText(postText, 'Post')}
                disabled={!postText.trim()}
                className={btnBase}
                style={{ color: textColor, border: `1px solid ${borderColor}` }}
              >
                Copy post
              </button>
              <button
                type="button"
                onClick={() => copyText(replyText, 'Reply')}
                disabled={!replyText.trim()}
                className={btnBase}
                style={{ color: textColor, border: `1px solid ${borderColor}` }}
              >
                Copy reply
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: mutedText }}>
              &ldquo;Post to X&rdquo; opens the X composer with the post text prefilled. The reply is
              a separate tweet — post the main tweet first, then reply with the copied reply text.
            </p>
          </div>

          {headlines.length > 0 && (
            <div
              className="rounded-lg p-4 mb-4"
              style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
            >
              <div className="text-sm font-semibold mb-2" style={{ color: textColor }}>
                CNBC headlines used
              </div>
              <ul className="space-y-1.5">
                {headlines.map((h, i) => (
                  <li key={i} className="text-sm leading-snug" style={{ color: mutedText }}>
                    {h.link ? (
                      <a
                        href={h.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: textColor }}
                        className="hover:underline"
                      >
                        {h.title}
                      </a>
                    ) : (
                      <span style={{ color: textColor }}>{h.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs" style={{ color: mutedText }}>
            {hasRecord
              ? `Last generated ${formatWhen(generatedAt)}${dateStr ? ` · session ${dateStr}` : ''}. Not saved between days — this always shows the most recent auto-generated post for the current timing.`
              : 'Nothing generated yet for this timing.'}
          </p>
        </>
      )}
    </div>
  );
}
