'use client';

import { useState } from 'react';
import { Check, Link2, Twitter } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import type { TelemetryEventName } from '@/core/telemetry/events';
import { useAuthSession } from '@/hooks/useAuthSession';

interface ShareCardButtonProps {
  /** The artifact id used for analytics attribution (card id, scorecard date, …). */
  cardId: string | number;
  /** Pre-filled tweet body. The cardUrl is added as the `url=` param. */
  tweetText: string;
  /** Public permalink shared in both actions. */
  cardUrl: string;
  /** Telemetry event name fired on both Copy and Twitter clicks.
   *  Defaults to ``card_share_clicked`` for backward compatibility with the
   *  /cards/[id] page. The scorecard page passes ``scorecard_share_clicked``. */
  eventName?: TelemetryEventName;
}

// Share controls for any shareable permalink. Two actions:
//   1. Copy the public URL to the clipboard.
//   2. Open a pre-filled tweet intent referencing the same URL.
// Both fire the same PostHog event tagged with the channel so we can measure
// which surface actually drives traffic. Telemetry is a no-op when
// NEXT_PUBLIC_POSTHOG_KEY is not set, so this component is safe everywhere.
export default function ShareCardButton({
  cardId,
  tweetText,
  cardUrl,
  eventName = 'card_share_clicked',
}: ShareCardButtonProps) {
  const [copied, setCopied] = useState(false);
  const { data: session, loading } = useAuthSession();
  // Admin-only surface. Rendered nothing (not even during load) so a
  // non-admin visitor never sees "Share to X" flash in and out of the DOM.
  if (loading || session?.user?.tier !== 'admin') return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      capture(eventName, { card_id: cardId, channel: 'copy_link' });
    } catch {
      // Clipboard API may be unavailable (insecure context, no permission) —
      // surface the URL via a prompt so users on legacy browsers can still copy.
      window.prompt('Copy this URL', cardUrl);
    }
  };

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(cardUrl)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
      >
        {copied ? <Check size={13} /> : <Link2 size={13} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => capture(eventName, { card_id: cardId, channel: 'twitter' })}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
      >
        <Twitter size={13} /> Share to X
      </a>
    </div>
  );
}
