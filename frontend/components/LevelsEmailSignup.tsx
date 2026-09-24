'use client';

import { useId, useState, type CSSProperties, type FormEvent } from 'react';
import { Check, Mail } from 'lucide-react';

import { SYMBOLS } from '@/core/symbols';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';

// Signup for the free pre-open levels email, rendered on the six public
// /<ticker>-gamma-levels pages.
//
// WHY IT SITS WHERE IT DOES. The page's conversion ladder is deliberate and
// documented in gammaLevels.tsx: levels, then LiveReadConversion, then the
// dashboard preview, then the trial CTA, then the share block. This block goes
// AFTER the trial CTA. The trial is the higher-value conversion and gets asked
// first; this is the explicit second ask for everyone who scrolled past it,
// which is most of the organic traffic. Putting it higher would cannibalize
// the trial; putting it below the share block would bury it in the evergreen
// content nobody scrolls to.
//
// WHY IT ASKS FOR SO LITTLE. One field. No name, no symbol picker, no account.
// Every additional input costs conversions, and none of them are needed: the
// digest covers all six tickers, and a subscriber is not a user.

type Props = {
  /** The page's primary ticker — copy and telemetry only. */
  symbol: string;
};

type Status = 'idle' | 'submitting' | 'done' | 'error';

const cardStyle: CSSProperties = {
  padding: '26px',
  marginBottom: 28,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const inputStyle: CSSProperties = {
  flex: '1 1 260px',
  minWidth: 0,
  padding: '11px 14px',
  // 16px, not 15: iOS Safari zooms the page into any field smaller than that
  // on focus, and this is the signup form on the busiest pages on the site.
  fontSize: 16,
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-panel)',
  outline: 'none',
};

// The honeypot. Positioned off-screen rather than display:none or
// hidden — some bots skip anything explicitly hidden, and a few screen
// readers announce a display:none field anyway. aria-hidden plus
// tabIndex={-1} keeps it away from assistive tech and the tab order, while
// still looking like an ordinary text input to something parsing the DOM.
const honeypotWrapStyle: CSSProperties = {
  position: 'absolute',
  left: '-9999px',
  width: 1,
  height: 1,
  overflow: 'hidden',
};

export default function LevelsEmailSignup(props: Props) {
  const { symbol: pageSymbol } = props;
  const inputId = useId();
  const [email, setEmail] = useState('');
  // Pre-selected to the page the reader is already on: someone subscribing
  // from /qqq-gamma-levels almost certainly wants QQQ, and a default that is
  // already right is worth more than a default that is merely consistent.
  const [symbol, setSymbol] = useState(() =>
    (SYMBOLS as readonly string[]).includes(props.symbol.toUpperCase())
      ? props.symbol.toUpperCase()
      : 'SPX',
  );
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    const trimmed = email.trim();
    // A cheap client-side shape check so an obvious typo gets an instant
    // answer instead of a round trip. The server re-validates; this is
    // courtesy, not a gate.
    if (!trimmed || !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(trimmed)) {
      setStatus('error');
      setMessage('That does not look like an email address. Mind checking it?');
      capture(TelemetryEvent.LevelsEmailRejected, { symbol: pageSymbol, reason: 'invalid' });
      return;
    }

    setStatus('submitting');
    setMessage('');
    capture(TelemetryEvent.LevelsEmailSubmitted, { symbol, page: pageSymbol, ...readUtmParams() });

    try {
      const response = await fetch('/api/levels-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, symbol, source: `/${pageSymbol.toLowerCase()}-gamma-levels`, website }),
      });

      if (response.status === 429) {
        setStatus('error');
        setMessage('Too many attempts from this connection. Please try again a bit later.');
        capture(TelemetryEvent.LevelsEmailRejected, { symbol: pageSymbol, reason: 'rate_limited' });
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setStatus('error');
        setMessage('Something went wrong on our end. Please try again in a moment.');
        return;
      }

      setStatus('done');
      // The server's wording, not ours — it is deliberately identical for
      // every outcome (new, already subscribed, previously opted out) so this
      // form cannot be used to find out whether an address reads this site.
      setMessage(
        data.message ??
          'Check your inbox for a confirmation link. The levels start the next trading morning after you click it.',
      );
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Could not reach the server. Please check your connection and try again.');
    }
  }

  if (status === 'done') {
    return (
      <section aria-labelledby="levels-email-heading" className="zg-panel" style={cardStyle}>
        <h2
          id="levels-email-heading"
          style={{
            margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px',
            color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <Check size={20} style={{ color: 'var(--color-bull)' }} aria-hidden="true" />
          Almost there&nbsp;- confirm your email
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', maxWidth: 660 }}>
          {message}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.8 }}>
          Nothing is sent until you click that link. If it does not arrive in a few minutes, check your spam folder.
          Your digest will lead with <strong>{symbol}</strong>.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="levels-email-heading" className="zg-panel" style={cardStyle}>
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--color-brand-primary)',
          border: '1px solid color-mix(in srgb, var(--color-brand-primary) 27%, transparent)',
          background: 'color-mix(in srgb, var(--color-brand-primary) 8%, transparent)',
          borderRadius: 999, padding: '5px 14px',
        }}
      >
        <Mail size={12} aria-hidden="true" /> Free daily email
      </div>

      <h2
        id="levels-email-heading"
        style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}
      >
        Get these levels before the open
      </h2>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', maxWidth: 660 }}>
        One email each trading morning with the gamma flip, call wall, put wall, max pain and net GEX for SPX, SPY,
        QQQ, NDX, ES and NQ&nbsp;- formatted to paste straight into the free TradingView script. No account, no card.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Lead with</span>
        {/* A row of buttons rather than a <select>: six options is few enough
            to show at once, and a visible row makes the default obvious. The
            chosen ticker heads the email's subject, table and paste block;
            the other five still appear underneath. */}
        <div role="radiogroup" aria-label="Preferred symbol" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SYMBOLS.map((s) => {
            const selected = s === symbol;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSymbol(s)}
                disabled={status === 'submitting'}
                style={{
                  padding: '5px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderRadius: 999,
                  border: `1px solid ${selected ? 'var(--color-brand-primary)' : 'var(--border-default)'}`,
                  background: selected ? 'var(--color-brand-primary)' : 'transparent',
                  color: selected ? '#10202c' : 'var(--color-text-secondary)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }} noValidate>
        {/* Visually hidden but present for screen readers. Inline rather
            than a utility class: this codebase has no .sr-only in
            app/globals.css, and referencing one that does not exist would
            silently render the label on screen. */}
        <label htmlFor={inputId} style={{ position: 'absolute', left: '-9999px' }}>
          Email address
        </label>
        <input
          id={inputId}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting'}
          required
          style={inputStyle}
        />

        {/* Honeypot — invisible to people, irresistible to naive bots. The
            server answers a filled one as success and stores nothing, so the
            author of the bot is never told which field gave it away. */}
        <div style={honeypotWrapStyle} aria-hidden="true">
          <label htmlFor={`${inputId}-website`}>Website</label>
          <input
            id={`${inputId}-website`}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="zg-btn zg-btn--primary"
          style={{ padding: '11px 20px', fontSize: 14 }}
        >
          {status === 'submitting' ? 'Sending…' : 'Send me the levels'}
        </button>
      </form>

      {status === 'error' && (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--color-bear)' }}>
          {message}
        </p>
      )}

      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.8 }}>
        Free, ~15-minute-delayed levels&nbsp;- {symbol} first, all six tickers included. Unsubscribe from the bottom
        of any email. We never sell or share your address.
      </p>
    </section>
  );
}
