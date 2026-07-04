'use client';

import { FormEvent, useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';

type Variant = 'inline' | 'sidebar';

type Props = {
  // Free-form label of the page this rendered on — powers the
  // ``source`` field on the subscribe POST and the PostHog event,
  // so the site owner can attribute signups by surface without
  // scraping the referer header.  E.g. 'cards', 'scorecard', 'replay'.
  surface: string;
  variant?: Variant;
  // Optional override for the headline text. Callers should pass
  // something surface-appropriate ("Want tomorrow's card too?" vs.
  // the default which reads well on a shared permalink page).
  headline?: string;
};

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

// Reusable email-capture card matching the surface-placement pattern
// established by Move 1 (BrokerCTA). Shows an inline email input +
// Subscribe button; on success swaps to a "check your inbox"
// confirmation. Callers place it on public share surfaces (Action Card
// permalinks, scorecard permalinks, forecast permalinks, replay
// snapshots, live-bulletin snapshots, /spx-gamma-levels).
//
// NEVER render this on the pricing page or an auth-gated route — the
// audiences overlap awkwardly and it dilutes the primary conversion
// path.
export default function NewsletterCTA({
  surface,
  variant = 'inline',
  headline = 'Get the free GEX Morning Card — dealer-gamma levels before the open.',
}: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) {
        setStatus('error');
        setErrorMessage('Enter your email to subscribe.');
        return;
      }
      setStatus('busy');
      setErrorMessage(null);
      try {
        const response = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmed,
            source: surface,
            referring_site: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!response.ok || !body.ok) {
          setStatus('error');
          setErrorMessage(body.error ?? 'Could not add that address — please try again.');
          return;
        }
        setStatus('success');
      } catch {
        setStatus('error');
        setErrorMessage('Network hiccup — please try again.');
      }
    },
    [email, surface],
  );

  const layoutStyle: React.CSSProperties =
    variant === 'sidebar'
      ? { padding: 20, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: C.card }
      : {
          padding: 20,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          backgroundColor: C.card,
          marginTop: 24,
        };

  if (status === 'success') {
    return (
      <aside style={layoutStyle} data-newsletter-cta data-newsletter-surface={surface}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <CheckCircle2 size={18} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: C.light }}>You&apos;re in.</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
              Confirm your email — check your inbox for the double-opt-in link.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside style={layoutStyle} data-newsletter-cta data-newsletter-surface={surface}>
      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: C.light }}>
        {headline}
      </p>
      <form
        onSubmit={onSubmit}
        style={
          variant === 'sidebar'
            ? { display: 'flex', flexDirection: 'column', gap: 8 }
            : { display: 'flex', gap: 8, flexWrap: 'wrap' }
        }
      >
        <label htmlFor={`newsletter-cta-email-${surface}`} style={{ position: 'absolute', left: -9999 }}>
          Email address
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '0 10px',
            backgroundColor: 'var(--color-bg, transparent)',
            flexGrow: 1,
            minWidth: variant === 'sidebar' ? '0' : 220,
          }}
        >
          <Mail size={14} color={C.muted} />
          <input
            id={`newsletter-cta-email-${surface}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
            required
            disabled={status === 'busy'}
            style={{
              border: 'none',
              outline: 'none',
              padding: '10px 8px',
              fontSize: 13,
              flexGrow: 1,
              background: 'transparent',
              color: C.light,
              width: '100%',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={status === 'busy'}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 800,
            cursor: status === 'busy' ? 'wait' : 'pointer',
            color: 'var(--text-inverse)',
            background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'center',
          }}
        >
          {status === 'busy' ? <Loader2 size={14} className="animate-spin" /> : (
            <>
              Subscribe <ArrowRight size={14} />
            </>
          )}
        </button>
      </form>
      {status === 'error' && errorMessage && (
        <p style={{ marginTop: 8, color: 'var(--color-bear, #d33)', fontSize: 12 }}>{errorMessage}</p>
      )}
      <p style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
        Free.{' '}
        <Link href="/newsletter" style={{ color: C.amber }}>
          What&apos;s in it →
        </Link>
      </p>
    </aside>
  );
}
