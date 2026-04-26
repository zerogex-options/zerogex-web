'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import { useTheme } from '@/core/ThemeContext';
import { normalizeTier, TierId } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';
import { ArrowRight, CheckCircle2, Loader2, Moon, Sparkles, Sun } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

type TierAction =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'subscribe'; tier: 'basic' | 'pro'; label: string }
  | { kind: 'portal'; label: string }
  | { kind: 'current'; label: string };

type TierCardProps = {
  title: string;
  price: string;
  original?: string;
  highlight?: string;
  features: string[];
  accent: string;
  action: TierAction;
  busy: boolean;
  onSubscribe: (tier: 'basic' | 'pro') => void;
  onPortal: () => void;
};

function CtaButton({
  action,
  busy,
  accent,
  onSubscribe,
  onPortal,
}: {
  action: TierAction;
  busy: boolean;
  accent: string;
  onSubscribe: (tier: 'basic' | 'pro') => void;
  onPortal: () => void;
}) {
  const baseStyle = {
    marginTop: 22,
    width: '100%',
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: 'var(--text-inverse)',
    background: `linear-gradient(135deg, ${accent} 0%, var(--heat-mid) 100%)`,
  } as const;

  if (action.kind === 'current') {
    return (
      <button
        type="button"
        disabled
        style={{
          ...baseStyle,
          background: 'transparent',
          color: C.muted,
          border: `1px solid ${C.border}`,
          cursor: 'default',
        }}
      >
        {action.label}
      </button>
    );
  }

  if (action.kind === 'link') {
    return (
      <Link href={action.href} style={{ textDecoration: 'none', display: 'block' }}>
        <span style={baseStyle as React.CSSProperties}>
          {action.label} <ArrowRight size={16} />
        </span>
      </Link>
    );
  }

  const handleClick = () => {
    if (busy) return;
    if (action.kind === 'subscribe') onSubscribe(action.tier);
    else onPortal();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{ ...baseStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : action.label}
      {!busy && action.kind === 'subscribe' && <ArrowRight size={16} />}
    </button>
  );
}

function TierCard({
  title,
  price,
  original,
  highlight,
  features,
  accent,
  action,
  busy,
  onSubscribe,
  onPortal,
}: TierCardProps) {
  return (
    <article
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${accent}66`,
        borderRadius: 18,
        padding: 28,
        boxShadow: `0 12px 40px ${accent}20`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.light }}>{title}</h3>
        {highlight && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              border: `1px solid ${accent}66`,
              color: accent,
              borderRadius: 999,
              padding: '4px 10px',
            }}
          >
            {highlight}
          </span>
        )}
      </div>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {original && (
          <span style={{ fontSize: 20, color: C.muted, textDecoration: 'line-through' }}>
            {original}
          </span>
        )}
        <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>{price}</span>
      </div>

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 12, flex: 1 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55 }}>
            <CheckCircle2 size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>

      <CtaButton action={action} busy={busy} accent={accent} onSubscribe={onSubscribe} onPortal={onPortal} />
    </article>
  );
}

const TIER_RANK: Record<TierId, number> = {
  public: 0,
  basic: 10,
  pro: 20,
  admin: 30,
};

export default function PricingPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const { data: authSession, loading: authLoading } = useAuthSession();
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier: TierId = useMemo(
    () => normalizeTier(authSession?.user?.tier),
    [authSession?.user?.tier],
  );
  const isAuthed = !!authSession?.authenticated;
  const hasPaidSubscription = currentTier === 'pro';

  const callBilling = useCallback(
    async (path: '/api/billing/checkout' | '/api/billing/portal', body?: object) => {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        throw new Error('Could not obtain CSRF token. Refresh and try again.');
      }
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrf.csrfToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Billing request failed');
      }
      window.location.href = payload.url;
    },
    [],
  );

  const handleSubscribe = useCallback(
    async (tier: 'basic' | 'pro') => {
      if (!isAuthed) {
        router.push(`/register?next=/pricing`);
        return;
      }
      if (currentTier === 'admin') {
        setError('Admin accounts do not subscribe.');
        return;
      }
      setError(null);
      setBusyTier(tier);
      try {
        if (hasPaidSubscription) {
          await callBilling('/api/billing/portal');
        } else {
          await callBilling('/api/billing/checkout', { tier });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setBusyTier(null);
      }
    },
    [callBilling, currentTier, hasPaidSubscription, isAuthed, router],
  );

  const handlePortal = useCallback(async () => {
    setError(null);
    setBusyTier('portal');
    try {
      await callBilling('/api/billing/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusyTier(null);
    }
  }, [callBilling]);

  const actionForPaidTier = (tier: 'basic' | 'pro'): TierAction => {
    const label = tier === 'basic' ? 'Basic' : 'Pro';
    if (authLoading) return { kind: 'link', href: '/register?next=/pricing', label: 'Get Started' };
    if (!isAuthed) {
      return { kind: 'link', href: `/register?next=/pricing`, label: 'Sign up to subscribe' };
    }
    if (currentTier === 'admin') return { kind: 'current', label: 'Admin (no subscription)' };
    if (currentTier === tier) return { kind: 'current', label: 'Current Plan' };
    if (TIER_RANK[currentTier] > TIER_RANK[tier]) {
      return { kind: 'portal', label: 'Manage Subscription' };
    }
    if (hasPaidSubscription) {
      return { kind: 'portal', label: `Switch to ${label}` };
    }
    return { kind: 'subscribe', tier, label: `Subscribe to ${label}` };
  };

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${isDark ? 'var(--color-bg)' : 'var(--color-bg)'}ee`,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="h-full flex items-center overflow-hidden flex-shrink-0" style={{ textDecoration: 'none', lineHeight: 0 }}>
          <img src="/title.svg" alt="ZeroGEX" className="h-[130%] sm:h-[150%] w-auto block" style={{ maxHeight: 'none', objectFit: 'contain' }} />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              color: C.muted,
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/about" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: C.light,
                cursor: 'pointer',
              }}
            >
              About
            </button>
          </Link>
        </div>
      </nav>

      <section style={{ minHeight: '100vh', padding: '120px 24px 84px', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(var(--border-subtle) 1px, transparent 1px),
              linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
            `,
            backgroundSize: '62px 62px',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: C.amber,
                border: `1px solid ${C.amber}55`,
                borderRadius: 999,
                background: `${C.amber}12`,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkles size={14} /> Price Tiers
            </div>
            <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
              Clear Tiers. Institutional-Grade Value.
            </h1>
            <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 18, lineHeight: 1.7 }}>
              Choose the ZeroGEX access level that fits your workflow. Upgrades and downgrades are pro-rated automatically.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--color-bear)',
                color: 'var(--color-bear)',
                background: 'var(--color-bear-soft)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <TierCard
              title="Basic"
              original="$29/mo"
              price="$19/mo"
              highlight="Limited Time Only"
              accent="var(--color-brand-primary)"
              features={[
                'Real-time metrics and full strategy tools.',
                'Access to Basic Signals.',
                'Designed for disciplined daily execution.',
              ]}
              action={actionForPaidTier('basic')}
              busy={busyTier === 'basic' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
            <TierCard
              title="Pro"
              original="$39/mo"
              price="$24/mo"
              highlight="Limited Time Only"
              accent="var(--color-brand-accent)"
              features={[
                'Everything included in Basic.',
                'Access to Advanced Signals.',
                'Direct access to ZeroGEX APIs.',
              ]}
              action={actionForPaidTier('pro')}
              busy={busyTier === 'pro' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
          </div>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
