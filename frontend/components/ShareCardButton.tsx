'use client';

import { useState } from 'react';
import { Check, Link2, Twitter } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';

interface ShareCardButtonProps {
  cardId: number;
  tweetText: string;
  cardUrl: string;
}

// Share controls for an Action Card permalink. Two actions:
//   1. Copy the public /cards/<id> URL to the clipboard.
//   2. Open a pre-filled tweet intent referencing the same URL.
// Both fire a `card_share_clicked` PostHog event tagged with the channel so we
// can measure which surface actually drives traffic. Telemetry is a no-op when
// NEXT_PUBLIC_POSTHOG_KEY is not set, so this component is safe everywhere.
export default function ShareCardButton({ cardId, tweetText, cardUrl }: ShareCardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      capture('card_share_clicked', { card_id: cardId, channel: 'copy_link' });
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
        onClick={() => capture('card_share_clicked', { card_id: cardId, channel: 'twitter' })}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
      >
        <Twitter size={13} /> Share to X
      </a>
    </div>
  );
}
