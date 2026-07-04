'use client';

import { FormEvent, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import { useTheme } from '@/core/ThemeContext';
import { ArrowRight, CheckCircle2, Loader2, Mail, Sparkles } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
} as const;

type SubmitStatus = 'idle' | 'busy' | 'success' | 'error';

type Props = {
  premiumCheckoutUrl: string;
};

export default function NewsletterClient({ premiumCheckoutUrl }: Props) {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utmSource = searchParams.get('utm_source') ?? undefined;
  const utmMedium = searchParams.get('utm_medium') ?? undefined;
  const utmCampaign = searchParams.get('utm_campaign') ?? undefined;

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) {
        setErrorMessage('Enter your email to subscribe.');
        setStatus('error');
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
            source: 'landing',
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
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
    [email, utmSource, utmMedium, utmCampaign],
  );

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', color: C.light, minHeight: '100vh' }}>
      <LandingHeader />

      <main style={{ padding: '48px 24px 64px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Above-the-fold hero + signup form. */}
        <section style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 48px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: C.amber,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <Sparkles size={14} /> New — daily newsletter
          </span>
          <h1
            style={{
              fontSize: 42,
              lineHeight: 1.1,
              fontWeight: 900,
              letterSpacing: '-1px',
              margin: '12px 0 12px',
            }}
          >
            The GEX Morning Card
          </h1>
          <p style={{ fontSize: 18, color: C.muted, margin: '0 0 24px' }}>
            Dealer-gamma levels for SPX / SPY / QQQ in your inbox before the open,
            every trading day. Free.
          </p>

          <NewsletterSignupForm
            email={email}
            onEmailChange={setEmail}
            onSubmit={onSubmit}
            status={status}
            errorMessage={errorMessage}
          />
        </section>

        {/* Two-column plan comparison. */}
        <section
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            margin: '0 auto 48px',
          }}
        >
          <PlanCard
            title="Free daily"
            price="$0"
            cadence="every trading morning"
            highlights={[
              'Yesterday\'s session recap — one paragraph.',
              'Today\'s gamma flip, call wall, put wall for SPX / SPY / QQQ.',
              'One playbook pattern likely to trigger today.',
              'Delivered before the 09:30 ET open.',
            ]}
            cta={{ kind: 'primary', label: 'Subscribe free', anchor: '#subscribe' }}
          />
          <PlanCard
            title="Sunday Playbook Review"
            price="$15"
            cadence="per month"
            highlights={[
              'Every free daily, plus:',
              'Last week\'s signal accuracy — full leaderboard.',
              'One playbook pattern deep dive: setup, entry, exit.',
              'Next week\'s macro-adjacent gamma landscape.',
              'One backtest post-mortem per week.',
            ]}
            cta={
              premiumCheckoutUrl
                ? { kind: 'external', label: 'Upgrade — $15/mo', href: premiumCheckoutUrl }
                : { kind: 'disabled', label: 'Paid tier coming soon' }
            }
            highlighted
          />
        </section>

        {/* Sample content preview — inline SVG mockup keeps everything under
            the same CSP + speed budget as the rest of the page. Replace with a
            real screenshot from public/newsletter/ once the first live send
            has landed. */}
        <section style={{ margin: '0 auto 48px', maxWidth: 640 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
            What you get, day one
          </h2>
          <SampleCardMock />
        </section>

        {/* TODO(site owner): once >500 subscribers, replace this block with a
            real subscriber-count callout. Do NOT fabricate numbers before then;
            leaving the section empty here is deliberate. */}

        <section
          style={{
            padding: 24,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            backgroundColor: C.card,
            maxWidth: 640,
            margin: '0 auto 48px',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            What we won&apos;t send you
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
            <li>Raw exchange quotes — we do not redistribute NBBO data.</li>
            <li>Per-contract bid / ask / last — everything is aggregated.</li>
            <li>Chart pictures pretending to be signals — every number is derived.</li>
          </ul>
        </section>

        <section style={{ textAlign: 'center', color: C.muted, fontSize: 13 }}>
          <p>
            Prefer the full site experience?{' '}
            <Link href="/pricing" style={{ color: C.amber, fontWeight: 700 }}>
              See Basic and Pro plans →
            </Link>
          </p>
        </section>
      </main>

      <Footer theme={theme} />
    </div>
  );
}

// ----------------------------------------------------------------------
// Signup form — anchored so the "Subscribe free" plan-card CTA scrolls here.
// ----------------------------------------------------------------------

function NewsletterSignupForm({
  email,
  onEmailChange,
  onSubmit,
  status,
  errorMessage,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  status: SubmitStatus;
  errorMessage: string | null;
}) {
  if (status === 'success') {
    return (
      <div
        id="subscribe"
        style={{
          display: 'inline-flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 20px',
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          backgroundColor: C.card,
          color: C.light,
          fontWeight: 600,
        }}
      >
        <CheckCircle2 size={18} color={C.amber} />
        You&apos;re in. Confirm your email — check your inbox.
      </div>
    );
  }
  return (
    <form
      id="subscribe"
      onSubmit={onSubmit}
      style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}
    >
      <label htmlFor="newsletter-email" style={{ position: 'absolute', left: -9999 }}>
        Email address
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: '0 12px',
          backgroundColor: C.card,
          width: 320,
          maxWidth: '100%',
        }}
      >
        <Mail size={16} color={C.muted} />
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@domain.com"
          autoComplete="email"
          required
          disabled={status === 'busy'}
          style={{
            border: 'none',
            outline: 'none',
            padding: '12px 8px',
            fontSize: 14,
            flexGrow: 1,
            background: 'transparent',
            color: C.light,
          }}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'busy'}
        style={{
          border: 'none',
          borderRadius: 12,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 800,
          cursor: status === 'busy' ? 'wait' : 'pointer',
          color: 'var(--text-inverse)',
          background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 160,
          justifyContent: 'center',
        }}
      >
        {status === 'busy' ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Subscribing…
          </>
        ) : (
          <>
            Subscribe (free) <ArrowRight size={16} />
          </>
        )}
      </button>
      {status === 'error' && errorMessage && (
        <p style={{ width: '100%', color: 'var(--color-bear, #d33)', fontSize: 13, margin: '4px 0 0' }}>
          {errorMessage}
        </p>
      )}
    </form>
  );
}

// ----------------------------------------------------------------------
// Plan comparison card
// ----------------------------------------------------------------------

type PlanCardProps = {
  title: string;
  price: string;
  cadence: string;
  highlights: string[];
  cta:
    | { kind: 'primary'; label: string; anchor: string }
    | { kind: 'external'; label: string; href: string }
    | { kind: 'disabled'; label: string };
  highlighted?: boolean;
};

function PlanCard({ title, price, cadence, highlights, cta, highlighted }: PlanCardProps) {
  return (
    <div
      style={{
        padding: 24,
        border: `1px solid ${highlighted ? C.amber : C.border}`,
        borderRadius: 16,
        backgroundColor: C.card,
        boxShadow: highlighted ? '0 0 32px var(--color-brand-primary-soft, rgba(245,180,0,0.25))' : 'none',
      }}
    >
      <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{title}</h3>
      <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>{cadence}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1px' }}>{price}</span>
        <span style={{ fontSize: 14, color: C.muted, fontWeight: 700 }}>/ {cadence.startsWith('per') ? 'mo' : 'day'}</span>
      </div>
      <ul style={{ marginTop: 20, padding: 0, listStyle: 'none' }}>
        {highlights.map((h) => (
          <li
            key={h}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              margin: '10px 0',
              fontSize: 14,
              color: C.light,
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{h}</span>
          </li>
        ))}
      </ul>

      {cta.kind === 'primary' && (
        <a
          href={cta.anchor}
          style={{
            marginTop: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '12px 18px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            color: 'var(--text-inverse)',
            background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
          }}
        >
          {cta.label} <ArrowRight size={16} />
        </a>
      )}
      {cta.kind === 'external' && (
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            padding: '12px 18px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            color: 'var(--text-inverse)',
            background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
          }}
        >
          {cta.label} <ArrowRight size={16} />
        </a>
      )}
      {cta.kind === 'disabled' && (
        <button
          type="button"
          disabled
          style={{
            marginTop: 20,
            width: '100%',
            padding: '12px 18px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.muted,
            cursor: 'default',
          }}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Sample-card mockup — inline SVG so it inherits the theme + skips CSP
// tightening around external images. Replace with a real screenshot from
// public/newsletter/ once the first live morning card has landed.
// ----------------------------------------------------------------------

function SampleCardMock() {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: C.card,
      }}
    >
      <svg
        role="img"
        aria-label="Sample of the GEX Morning Card newsletter format"
        viewBox="0 0 640 420"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <rect width="640" height="420" fill="var(--color-surface, #111)" />
        <text x="24" y="40" fontSize="14" fontFamily="system-ui" fill="var(--color-text-secondary, #999)">
          GEX Morning Card · Jul 3, 2026
        </text>
        <text x="24" y="72" fontSize="24" fontWeight="700" fontFamily="system-ui" fill="var(--color-text-primary, #eee)">
          Today&apos;s dealer gamma map.
        </text>

        <text x="24" y="120" fontSize="13" fontWeight="600" fontFamily="system-ui" fill="var(--color-text-secondary, #aaa)">
          YESTERDAY&apos;S TAPE
        </text>
        <text x="24" y="142" fontSize="14" fontFamily="system-ui" fill="var(--color-text-primary, #ddd)">
          $SPX, Wednesday: 4 Playbook calls, best signal squeeze setup (+0.35%),
        </text>
        <text x="24" y="160" fontSize="14" fontFamily="system-ui" fill="var(--color-text-primary, #ddd)">
          closing regime long gamma.
        </text>

        <text x="24" y="200" fontSize="13" fontWeight="600" fontFamily="system-ui" fill="var(--color-text-secondary, #aaa)">
          TODAY&apos;S KEY LEVELS
        </text>

        <g fontFamily="system-ui" fontSize="14" fill="var(--color-text-primary, #ddd)">
          <text x="24" y="228" fontWeight="700">SPX</text>
          <text x="140" y="228">flip 5,820</text>
          <text x="290" y="228">call wall 5,850</text>
          <text x="470" y="228">put wall 5,780</text>

          <text x="24" y="252" fontWeight="700">SPY</text>
          <text x="140" y="252">flip 581.00</text>
          <text x="290" y="252">call wall 585.50</text>
          <text x="470" y="252">put wall 577.00</text>

          <text x="24" y="276" fontWeight="700">QQQ</text>
          <text x="140" y="276">flip 512.00</text>
          <text x="290" y="276">call wall 517.00</text>
          <text x="470" y="276">put wall 508.50</text>
        </g>

        <text x="24" y="316" fontSize="13" fontWeight="600" fontFamily="system-ui" fill="var(--color-text-secondary, #aaa)">
          ONE PATTERN TO WATCH
        </text>
        <text x="24" y="338" fontSize="14" fontFamily="system-ui" fill="var(--color-text-primary, #ddd)">
          Squeeze Setup · $SPX — watch for a break above the call wall on volume.
        </text>

        <rect x="24" y="368" width="180" height="34" rx="6" fill="var(--color-brand-primary, #f5b400)" />
        <text
          x="114" y="390" textAnchor="middle" fontSize="13" fontWeight="700"
          fontFamily="system-ui" fill="#111"
        >
          Upgrade to weekly
        </text>
      </svg>
    </div>
  );
}
