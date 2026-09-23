'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { brandTitle } from '@/core/brand';
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
  // Phone-only menu. Below `sm` the bar keeps just the logo, the primary CTA
  // and this toggle; the secondary links move into the panel it opens, which
  // is what stops the CTA running off the right edge of a 375px screen.
  const [menuOpen, setMenuOpen] = useState(false);
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
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // The bar is transparent over the hero until the page scrolls; an open menu
  // needs the solid ground regardless.
  const solid = scrolled || menuOpen;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
      style={{
        // color-mix, not a hex alpha suffix: `${'var(--color-bg)'}ee` is not a
        // colour at all, so the declaration was dropped and the bar stayed
        // clear over the text scrolling beneath it.
        background: solid
          ? 'color-mix(in srgb, var(--color-bg) 93%, transparent)'
          : 'transparent',
        borderBottom: solid ? `1px solid ${C.border}` : '1px solid transparent',
        backdropFilter: solid ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: solid ? 'blur(20px)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <Link
        href="/"
        className="h-full flex items-center overflow-hidden flex-shrink-0"
        style={{ textDecoration: 'none', margin: 0, padding: 0, lineHeight: 0 }}
      >
        <Image
          {...brandTitle(isDark)}
          alt="ZeroGEX"
          priority
          // The lockup is trimmed to its artwork, so a height is the whole
          // sizing story: a fixed 30px on phones (the same lockup size as the
          // app's top bar), a fraction of the taller bar from `sm` up.
          className="h-[30px] sm:h-[88%] w-auto block max-w-none"
          style={{
            maxHeight: 'none',
            objectFit: 'contain',
            objectPosition: 'left center',
            margin: 0,
            padding: 0,
          }}
        />
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="hidden sm:flex w-[38px] h-[38px] items-center justify-center rounded-[10px]"
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

        <Link
          href="/search"
          aria-label="Search"
          className="hidden sm:flex w-[38px] h-[38px] items-center justify-center rounded-[10px]"
          style={{ background: 'var(--bg-hover)', border: `1px solid ${C.border}`, color: C.muted }}
        >
          <Search size={15} />
        </Link>

        <Link href="/education" className="hidden sm:block" style={{ textDecoration: 'none' }}>
          <button
            className="zg-small"
            style={{
              background: 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              borderRadius: 'var(--radius-control)',
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
                borderRadius: 'var(--radius-control)',
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

        <Link href={isAuthed ? '/account' : '/login'} className="hidden sm:block" style={{ textDecoration: 'none' }}>
          <button
            className="zg-small px-[14px] py-2 whitespace-nowrap"
            style={{
              background: 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              borderRadius: 'var(--radius-control)',
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
          <button className="zg-btn zg-btn--primary whitespace-nowrap min-h-[40px] sm:min-h-0" style={{ padding: '8px 12px', fontSize: 13 }}>
            {canLaunchApp ? (
              'Launch App'
            ) : (
              <>
                {/* Shorten the label on phones so the CTA fits beside the logo
                    and Login button; desktop keeps the full wording. */}
                <span className="sm:hidden">Get Started</span>
                <span className="hidden sm:inline">Get Started</span>
              </>
            )}{' '}
            <ArrowRight size={14} />
          </button>
        </Link>

        {/* Wrapped: .zg-icon-btn sets its own display, which would beat a
            responsive `hidden` utility placed on the button itself. */}
        <span className="sm:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="zg-icon-btn zg-touch-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="zgx-landing-menu"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </span>
      </div>

      {menuOpen && (
        <div id="zgx-landing-menu" className="zg-lmenu sm:hidden">
          <Link href="/spx-gamma-levels" className="zg-msheet-row" onClick={() => setMenuOpen(false)}>
            <span className="zg-msheet-row-label">Free gamma levels</span>
          </Link>
          <Link href="/education" className="zg-msheet-row" onClick={() => setMenuOpen(false)}>
            <span className="zg-msheet-row-label">Education</span>
          </Link>
          {showPricing && (
            <Link href="/pricing" className="zg-msheet-row" onClick={() => setMenuOpen(false)}>
              <span className="zg-msheet-row-label">Pricing</span>
            </Link>
          )}
          <Link href="/search" className="zg-msheet-row" onClick={() => setMenuOpen(false)}>
            <span className="zg-msheet-row-label">Search</span>
            <Search size={16} aria-hidden className="zg-msheet-row-icon" />
          </Link>
          <button type="button" className="zg-msheet-row" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            <span className="zg-msheet-row-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
            {isDark ? <Sun size={16} aria-hidden className="zg-msheet-row-icon" /> : <Moon size={16} aria-hidden className="zg-msheet-row-icon" />}
          </button>
          <div className="zg-lmenu-actions">
            <Link
              href={isAuthed ? '/account' : '/login'}
              className="zg-btn zg-btn--secondary"
              onClick={() => setMenuOpen(false)}
            >
              {isAuthed ? 'Account' : 'Log in'}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
