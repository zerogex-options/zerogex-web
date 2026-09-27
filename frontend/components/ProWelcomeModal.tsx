'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Compass, KeyRound, X } from 'lucide-react';
import { Theme } from '@/core/types';
import { lockPageScroll } from '@/core/scrollLock';
import { useTimeframe } from '@/core/TimeframeContext';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';

// The first-run welcome. Despite the file name it now greets every new member:
// Pro, as it always has, and a new Basic member (core/proWelcome.ts
// isWelcomeEligible). Since 2026-09-22 the only free trial is Basic monthly, so
// the Basic version is the one almost every trialer sees.
interface ProWelcomeModalProps {
  theme: Theme;
  // Which version to show. Pro adds the self-service API key card, a Pro-only
  // feature; everything else is the same for both.
  tier: 'pro' | 'basic';
  // Hide the modal for this browser session (sets sessionStorage + local state)
  // and refresh the shared auth session so the newly-stamped seen flag sticks.
  onClose: () => void;
}

// "Which market do you trade?" New members land on SPY, the default symbol, and
// nothing asked what they trade: a futures trader canceled asking for ES and NQ
// the day after they went real-time, because nothing he saw mentioned them.
// Picking one sets the app-wide symbol (persisted like any other pick), so the
// Signal Dashboard the CTA opens is already on their market.
const MARKETS: ReadonlyArray<{ symbol: UnderlyingSymbol; label: string }> = [
  { symbol: 'SPX', label: 'S&P 500 index' },
  { symbol: 'SPY', label: 'S&P 500 ETF' },
  { symbol: 'ES', label: 'S&P futures, incl. MES' },
  { symbol: 'NDX', label: 'Nasdaq-100 index' },
  { symbol: 'QQQ', label: 'Nasdaq-100 ETF' },
  { symbol: 'NQ', label: 'Nasdaq futures, incl. MNQ' },
];

export default function ProWelcomeModal({ theme, tier, onClose }: ProWelcomeModalProps) {
  const isDark = theme === 'dark';
  const isPro = tier === 'pro';
  const { setSymbol } = useTimeframe();
  const [submitting, setSubmitting] = useState(false);
  const [market, setMarket] = useState<UnderlyingSymbol | null>(null);
  // Read by the close paths, which are memoized callbacks; a ref keeps them
  // from recording a stale answer.
  const marketRef = useRef<UnderlyingSymbol | null>(null);
  // Guards every exit path so a double-click (or Escape + button) can't fire
  // onClose twice or race two persist requests.
  const closingRef = useRef(false);
  const ctaRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const releaseScroll = lockPageScroll();
    // preventScroll: on a phone the modal scrolls internally, and a plain
    // focus() scrolled it to the CTA at the bottom, so the greeting and the
    // market question opened out of view. Focus stays on the CTA for keyboard
    // users; the modal opens at the top.
    ctaRef.current?.focus({ preventScroll: true });
    return releaseScroll;
  }, []);

  const pickMarket = useCallback(
    (next: UnderlyingSymbol) => {
      marketRef.current = next;
      setMarket(next);
      setSymbol(next);
    },
    [setSymbol],
  );

  // Persist "seen" server-side so the welcome never returns on another device
  // or a later session, with the market answer (if any) for the audit trail.
  // Best-effort: the caller still hides it locally even if this throws (the
  // sessionStorage backstop covers the current session, and the server flag
  // simply re-shows on a future login).
  const persistSeen = useCallback(async () => {
    const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
    const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
    const token = csrfPayload.csrfToken;
    if (!token) return;
    await fetch('/api/auth/pro-welcome-seen', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ market: marketRef.current }),
    });
  }, []);

  // Close paths that stay on the current page (X button, "Maybe later",
  // Escape): persist, then hand back to the parent to hide + refresh.
  const dismiss = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setSubmitting(true);
    try {
      await persistSeen();
    } catch {
      // Non-blocking — see persistSeen note.
    } finally {
      onClose();
    }
  }, [onClose, persistSeen]);

  // Link paths (the Signal Dashboard CTA, the API-key link): don't block the
  // click on the network. Mark seen locally right away and fire the persist in
  // the background so the Link navigation proceeds immediately.
  const handleCta = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    void persistSeen().catch(() => {});
    onClose();
  }, [onClose, persistSeen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-modal-title"
      aria-describedby="pro-welcome-modal-body"
      style={{
        position: 'fixed',
        inset: 0,
        // Below the disclaimer (1000) and founding lock-in (999) modals. Those
        // are gated to clear before this one shows, so they never truly stack;
        // the lower z-index is just belt-and-suspenders during a state flip.
        zIndex: 998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          // Cap to the viewport and scroll internally so the CTA stays reachable
          // on short/landscape phones instead of clipping off-screen.
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          position: 'relative',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          padding: '28px 28px 24px',
        }}
      >
        <button
          type="button"
          onClick={() => void dismiss()}
          disabled={submitting}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 0,
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div
          id="pro-welcome-modal-title"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-brand-primary)',
            marginBottom: 10,
          }}
        >
          {isPro ? 'Welcome to ZeroGEX Pro' : 'Welcome to ZeroGEX'}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 14px 0', lineHeight: 1.3 }}>
          {isPro ? <>You&apos;re in&nbsp;- Pro is live 🎉</> : <>You&apos;re in 🎉</>}
        </h2>

        <p
          id="pro-welcome-modal-body"
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            margin: '0 0 16px 0',
          }}
        >
          {isPro ? (
            <>
              Thanks for subscribing. You now have full access to everything Pro unlocks&nbsp;-
              advanced signals, real-time dealer positioning, GEX heatmaps, and backtesting.
            </>
          ) : (
            <>Thanks for joining. One quick question, then the one page worth starting on.</>
          )}
        </p>

        <fieldset style={{ border: 'none', margin: '0 0 18px 0', padding: 0 }}>
          <legend style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, padding: 0 }}>
            Which market do you trade?
          </legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {MARKETS.map((m) => {
              const selected = market === m.symbol;
              return (
                <button
                  key={m.symbol}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickMarket(m.symbol)}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: selected
                      ? '1px solid var(--color-brand-primary)'
                      : '1px solid var(--border-default)',
                    backgroundColor: selected
                      ? 'color-mix(in srgb, var(--color-brand-primary) 14%, transparent)'
                      : 'transparent',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{m.symbol}</span>
                  <span style={{ display: 'block', fontSize: 11.5, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }} aria-live="polite">
            {market
              ? `Everything will open on ${market}. You can switch any time from the symbol picker at the top of the page.`
              : 'Every page opens on the market you pick. You can switch any time from the symbol picker at the top of the page.'}
          </p>
        </fieldset>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 18,
          }}
        >
          {/* Expectation-setting, deliberately BEFORE the feature tour. The most
              common way a trial fails is not a missing feature — it is reading the
              gamma flip as a mechanical trigger, watching it not determine a range,
              and concluding the concept is broken. /methodology says the opposite in
              our own words, but nothing surfaced it during a trial, so the people who
              most needed it never found it. Framed as a reason to trust the tool:
              publishing where your model is weakest is a strength. */}
          <p style={{ margin: '0 0 10px 0' }}>
            One thing worth knowing up front: dealer positioning is{' '}
            <em>modeled</em>, not observed&nbsp;- no public dataset says who is long and who is
            short at a strike. The levels are probabilistic context, not mechanical triggers. We
            write down exactly what&apos;s derived, what&apos;s assumed, and where the model is
            weakest in{' '}
            <Link
              href="/methodology"
              style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}
            >
              Methodology &amp; Validation
            </Link>
            . Five minutes, and it will save you misreading a level.
          </p>
          {/* Where to start, named explicitly. The Basic Signal Dashboard and four
              of its six children are the pages that most separate members who
              convert from members who leave during the trial — and they hold that
              lead after controlling for how much each group browsed overall, so it
              is not simply that converters click more (make scan-trial-activation).
              Naming one starting point beats handing a new member 40+ nav entries
              and a seven-day clock. It is a Basic page, so the same advice holds
              for both tiers. */}
          <p style={{ margin: 0 }}>
            If you do one thing today, open the{' '}
            <Link
              href="/basic-signals"
              onClick={handleCta}
              style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}
            >
              Signal Dashboard
            </Link>
            . It reads today&apos;s positioning as six plain signals&nbsp;- tape flow, skew,
            vanna/charm, dealer delta, GEX gradient and positioning traps&nbsp;- each saying what
            it means in a sentence, which is an easier place to get your bearings than raw levels.
            The full{' '}
            <Link href="/dashboard" onClick={handleCta} style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>
              dashboard
            </Link>{' '}
            is there whenever you want the wider view, with Today&apos;s Read near the top putting
            the day&apos;s positioning in plain English.
          </p>
        </div>

        {isPro && (
          // Feature-announcement highlight card. API keys are Pro-only
          // (isApiKeyEligibleTier), so the Basic version leaves it out rather
          // than advertising something the member cannot use.
          <div
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: '16px 18px',
              marginBottom: 18,
              background: isDark
                ? 'rgba(255, 255, 255, 0.03)'
                : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-brand-primary)',
                }}
              >
                <KeyRound size={18} aria-hidden="true" />
              </span>
              <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                New: Self-service API key generation
              </strong>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Call the ZeroGEX data API directly from your own scripts, spreadsheets, and integrations&nbsp;-
              no waiting on support. If you need a key:
            </p>
            <ol
              style={{
                margin: '0 0 4px 0',
                paddingLeft: 20,
                fontSize: 13.5,
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
              }}
            >
              <li>
                Open{' '}
                <Link
                  href="/account#api-access"
                  onClick={handleCta}
                  style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}
                >
                  Account → API Access
                </Link>
                .
              </li>
              <li>
                Click <strong style={{ color: 'var(--text-primary)' }}>Generate API Key</strong> and copy
                the secret&nbsp;- it&apos;s shown only once.
              </li>
              <li>
                Send it on your requests as{' '}
                <code style={{ fontSize: 12.5 }}>Authorization: Bearer &lt;key&gt;</code>.
              </li>
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={submitting}
            style={{
              flex: '0 0 auto',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Maybe later'}
          </button>
          <Link
            ref={ctaRef}
            href="/basic-signals"
            onClick={handleCta}
            style={{
              flex: '1 1 auto',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#ffffff',
              backgroundColor: 'var(--color-brand-primary)',
              border: 'none',
              borderRadius: 8,
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Compass size={16} aria-hidden="true" />
            Start with the Signal Dashboard
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {isPro && (
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            You can generate or regenerate a key anytime from your Account page.
          </p>
        )}
      </div>
    </div>
  );
}
