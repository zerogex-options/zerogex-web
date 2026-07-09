'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { normalizeTier } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';
import ThemeDropdown from './ThemeDropdown';

const C = {
  bgDark: 'var(--color-bg)',
  card: 'var(--color-surface)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
};

interface LandingHeaderProps {
  // Set on /pricing itself to omit the self-referential Pricing button.
  hidePricingButton?: boolean;
}

export default function LandingHeader({ hidePricingButton = false }: LandingHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const { data: authSession } = useAuthSession();

  const isDark = theme === 'dark';
  const isAuthed = !!authSession?.authenticated;
  const tier = normalizeTier(authSession?.user?.tier);
  const hasPaidTier = tier === 'basic' || tier === 'pro';
  const showPricing = !hidePricingButton && !hasPaidTier;

  // Auth-aware primary CTA (requirement #8): only users who can actually reach
  // the dashboard get "Launch App" → /dashboard. Everyone else gets a clear
  // trial step instead of a button that bounces logged-out visitors back to the
  // free preview (the /dashboard→/spx-gamma-levels middleware redirect). Signed-
  // in-but-unpaid users go to /pricing (account exists → start trial at
  // checkout); logged-out visitors go to /register.
  const canLaunchApp = isAuthed && (hasPaidTier || tier === 'admin');
  // Signed-in-but-unpaid visitors go to /pricing to start the trial; mark it
  // with ?trial=1 so pricing shows the "You're almost done — choose your plan"
  // trial hero, the same as a visitor arriving fresh from registration.
  const trialHref = isAuthed ? '/pricing?trial=1' : '/register';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
      style={{
        background: scrolled
          ? `${isDark ? C.bgDark : 'var(--color-bg)'}ee`
          : 'transparent',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <Link
        href="/"
        className="h-full flex items-center overflow-hidden flex-shrink-0"
        style={{ textDecoration: 'none', margin: 0, padding: 0, lineHeight: 0 }}
      >
        <Image
          src="/title.svg"
          alt="ZeroGEX"
          width={300}
          height={60}
          priority
          className="h-[130%] sm:h-[150%] w-auto block"
          style={{
            maxHeight: 'none',
            maxWidth: 'none',
            objectFit: 'contain',
            objectPosition: 'center',
            margin: 0,
            padding: 0,
          }}
        />
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
          style={{
            background: 'var(--bg-hover)',
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
            color: C.muted,
          }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className="hidden sm:block">
          <ThemeDropdown />
        </div>

        <Link href="/education" className="hidden sm:block" style={{ textDecoration: 'none' }}>
          <button
            className="zg-small"
            style={{
              background: 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 14px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Education
          </button>
        </Link>

        {showPricing && (
          <Link href="/pricing" className="hidden sm:block" style={{ textDecoration: 'none' }}>
            <button
              className="zg-small"
              style={{
                background: 'var(--bg-hover)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              Pricing
            </button>
          </Link>
        )}

        <Link href={isAuthed ? '/account' : '/login'} style={{ textDecoration: 'none' }}>
          <button
            className="zg-small"
            style={{
              background: 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 14px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {isAuthed ? 'Account' : 'Login'}
          </button>
        </Link>

        <Link
          href={canLaunchApp ? '/dashboard' : trialHref}
          style={{ textDecoration: 'none' }}
          onClick={
            canLaunchApp
              ? undefined
              : () => capture(TelemetryEvent.TrialCtaClick, { location: 'site_header', ...readUtmParams() })
          }
        >
          <button
            className="flex items-center gap-1.5 px-3 py-2 sm:px-[18px] sm:py-2 text-xs sm:text-[13px] font-bold rounded-[10px]"
            style={{
              background: `linear-gradient(135deg, ${C.amber}, var(--heat-mid))`,
              border: 'none',
              color: 'var(--text-inverse)',
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${C.amber}50`,
            }}
          >
            {canLaunchApp ? 'Launch App' : 'Start Free Trial'} <ArrowRight size={14} />
          </button>
        </Link>
      </div>
    </nav>
  );
}
