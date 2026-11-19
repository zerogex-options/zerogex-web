'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useLanguage, usePageT } from '@/core/LanguageContext';
import { BLACK_FRIDAY_SALE, formatSaleDeadline } from '@/core/blackFridaySale';
import { dict } from './BlackFridayBar.i18n';

// The site-wide Black Friday bar: a strip along the bottom of every page for a
// signed-in member the sale is for, linking to /pricing, where the sale prices
// are. Who it's for, and whether the sale is on, is decided server-side per
// request and arrives on the session as user.blackFridayEndsAt
// (core/serverAuth.ts, core/blackFridaySale.ts showsSaleBanner): a free
// account with no current plan or trial that has never held one, which is
// exactly who checkout sells the sale to. Statically rendered pages can't show
// a sale that has ended, because nothing here reads a clock or an env.
//
// Dismissible. The dismissal is remembered in this browser for the rest of the
// sale (keyed on its end, so a later sale shows again). Not shown where it
// would be noise or would get in the way: /pricing has its own sale banner, the
// sign-in and legal pages, and the bare pages embedded or screenshotted
// elsewhere.

const DISMISS_KEY = 'zgx.blackFridayBar.dismissed';

const HIDDEN_ROUTES = new Set([
  '/pricing',
  '/founding',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/embed',
]);
const HIDDEN_PREFIXES = ['/embed/', '/live-bulletin/snapshot/'];

export function isBarHiddenOn(pathname: string): boolean {
  return HIDDEN_ROUTES.has(pathname) || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
}

// The dismissal lives in localStorage, read through useSyncExternalStore so the
// server render (no storage) and the first client render agree: both say
// "dismissed", and the bar appears only once the browser has said otherwise.
// Nothing outside this component writes the key, so subscribe is a no-op.
const noopSubscribe = () => () => {};

function readDismissed(endsAt: string | null): boolean {
  if (!endsAt) return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === endsAt;
  } catch {
    // Storage blocked: show the bar; dismissing still hides it for this page view.
    return false;
  }
}

export default function BlackFridayBar() {
  const t = usePageT(dict);
  const { locale } = useLanguage();
  const pathname = usePathname();
  const { data: authSession } = useAuthSession();
  const endsAt = authSession?.authenticated ? (authSession.user?.blackFridayEndsAt ?? null) : null;

  const storedDismissed = useSyncExternalStore(
    noopSubscribe,
    () => readDismissed(endsAt),
    () => true,
  );
  const [closed, setClosed] = useState(false);

  const deadline = useMemo(
    () => (endsAt ? formatSaleDeadline(Date.parse(endsAt), locale) : null),
    [endsAt, locale],
  );

  const dismiss = useCallback(() => {
    try {
      if (endsAt) window.localStorage.setItem(DISMISS_KEY, endsAt);
    } catch {
      // Storage blocked: hidden for this page view only.
    }
    setClosed(true);
  }, [endsAt]);

  if (!endsAt || !deadline || storedDismissed || closed || isBarHiddenOn(pathname)) return null;

  return (
    <div
      role="region"
      aria-label="Black Friday sale"
      // left in the class list, not the style: an inline left would beat the
      // lg: class that clears the fixed sidebar, as <main>'s padding does.
      className="left-0 lg:left-[var(--zgx-nav-width,0px)]"
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        zIndex: 29,
        background:
          'linear-gradient(120deg, var(--color-brand-primary) 0%, var(--heat-mid) 45%, var(--color-accent-hot) 100%)',
        color: 'var(--text-inverse)',
        boxShadow: '0 -8px 30px color-mix(in srgb, var(--color-brand-primary) 30%, transparent)',
        padding: '10px 48px 10px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px 16px',
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1.35,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            border: '1px solid currentColor',
            borderRadius: 999,
            padding: '3px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {t('label')}
        </span>
        <span>{t('text', { pct: BLACK_FRIDAY_SALE.percentOff, deadline })}</span>
        <Link
          href="/pricing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'var(--text-inverse)',
            color: 'var(--color-brand-primary)',
            fontWeight: 800,
            fontSize: 13,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {t('cta')} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        title={t('dismiss')}
        style={{
          position: 'absolute',
          top: '50%',
          right: 10,
          transform: 'translateY(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          border: 'none',
          borderRadius: 999,
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}
