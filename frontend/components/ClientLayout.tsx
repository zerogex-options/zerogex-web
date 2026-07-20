'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useAuthSession } from '@/hooks/useAuthSession';
import { identify as telemetryIdentify, reset as telemetryReset } from '@/core/telemetry/posthog-client';
import { DISCLAIMER_VERSION } from '@/core/disclaimer';
import { FOUNDING_LOCKIN_DEADLINE_ISO } from '@/core/foundingLockin';
import { PRO_WELCOME_SESSION_KEY, isProWelcomeEligible } from '@/core/proWelcome';
import Header from './Header';
import Navigation from './Navigation';
import Footer from './Footer';
import DisclaimerModal from './DisclaimerModal';
import FoundingLockinModal from './FoundingLockinModal';
import ProWelcomeModal from './ProWelcomeModal';
import TechnicalSnapshotPrewarm from './TechnicalSnapshotPrewarm';
import OptionChainPrewarm from './OptionChainPrewarm';

const FOUNDING_LOCKIN_SESSION_KEY = 'zgx.foundingLockinShown';

// useSyncExternalStore subscribe is a no-op: nothing externally mutates the
// values we care about (sessionStorage flag is only written by us, deadline
// is a fixed ISO string). The hook is just for the SSR-safe getServerSnapshot
// boundary so we don't risk a hydration mismatch.
const noopSubscribe = () => () => {};
const getFoundingLockinGateServer = () => false;
const getFoundingLockinGateClient = () => {
  try {
    const alreadyShown =
      window.sessionStorage.getItem(FOUNDING_LOCKIN_SESSION_KEY) === '1';
    const deadlinePassed = Date.now() >= Date.parse(FOUNDING_LOCKIN_DEADLINE_ISO);
    return !alreadyShown && !deadlinePassed;
  } catch {
    return false;
  }
};

// Pro-welcome session gate, same SSR-safe shape as the founding one above. The
// authoritative one-time gate is the server flag (user.proWelcomeSeenAt); this
// sessionStorage check is only a within-session backstop so a failed persist
// can't re-pop the modal on the next client navigation. SSR returns false so
// the modal never renders during hydration.
const getProWelcomeGateServer = () => false;
const getProWelcomeGateClient = () => {
  try {
    return window.sessionStorage.getItem(PRO_WELCOME_SESSION_KEY) !== '1';
  } catch {
    return false;
  }
};

// Routes that render their own full-page layout (no app chrome)
const STANDALONE_ROUTES = ['/', '/about', '/giving', '/pricing', '/founding', '/login', '/register', '/unauthorized', '/terms', '/privacy', '/real-time-gex-0dte', '/spx-gamma-levels', '/spy-gamma-levels', '/qqq-gamma-levels', '/trading-mistakes'];

// Routes where the disclaimer modal should not interrupt the user (the auth
// flow itself, and the public terms/privacy pages which already contain the
// full legal text). /pricing and /founding are suppressed so a new
// register→pricing/founding redirect doesn't trip the modal before the
// user has even chosen a plan.
const DISCLAIMER_SUPPRESSED_ROUTES = new Set(['/login', '/register', '/unauthorized', '/terms', '/privacy', '/forgot-password', '/reset-password', '/pricing', '/founding']);

// Don't interrupt the founding-rate reminder where it makes no sense: the
// auth flow, the legal pages, and the pages the CTA links to (so the user
// isn't reminded on the page they're actively converting from).
const FOUNDING_LOCKIN_SUPPRESSED_ROUTES = new Set(['/login', '/register', '/unauthorized', '/terms', '/privacy', '/forgot-password', '/reset-password', '/pricing', '/founding']);

// Don't pop the Pro welcome over the auth/legal/checkout flows, and skip
// /account itself — that's where the CTA points, so a modal linking to the
// page you're already on would be redundant. It simply shows on the next
// non-suppressed page instead (e.g. the /dashboard the checkout returns to).
const PRO_WELCOME_SUPPRESSED_ROUTES = new Set(['/login', '/register', '/unauthorized', '/terms', '/privacy', '/forgot-password', '/reset-password', '/pricing', '/founding', '/account']);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { data: authSession, refresh: refreshAuth } = useAuthSession();
  const [acknowledgedLocally, setAcknowledgedLocally] = useState(false);
  const [foundingLockinClosed, setFoundingLockinClosed] = useState(false);
  const [proWelcomeClosed, setProWelcomeClosed] = useState(false);
  // SSR returns false (suppress modal); client snapshot reads sessionStorage
  // + checks the deadline. Avoids the impure-Date.now()-during-render lint
  // and the hydration mismatch a naive useState lazy initializer would cause.
  const foundingLockinGatePassed = useSyncExternalStore(
    noopSubscribe,
    getFoundingLockinGateClient,
    getFoundingLockinGateServer,
  );
  const proWelcomeGatePassed = useSyncExternalStore(
    noopSubscribe,
    getProWelcomeGateClient,
    getProWelcomeGateServer,
  );

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Tie analytics to the logged-in user (keyed by app user id so client and
  // server/webhook events stitch to one person), and clear identity on logout.
  // Runs on every route since it's declared before the standalone-route early
  // return. No-op unless a PostHog key is configured.
  useEffect(() => {
    if (!authSession) return;
    if (authSession.authenticated && authSession.user) {
      telemetryIdentify(authSession.user.id, {
        tier: authSession.user.tier,
        has_active_subscription: authSession.user.hasActiveSubscription ?? false,
        email_verified: authSession.user.emailVerified ?? false,
      });
    } else {
      telemetryReset();
    }
  }, [authSession]);

  // Post-checkout: Stripe returns to /dashboard?trial_started=1, but the
  // subscription webhook may grant the trialing tier a beat later. Re-poll the
  // shared session a few times so the header/nav (and this layout) reflect the
  // new subscription within a few seconds instead of the stale public state
  // until the next navigation. useAuthSession is now a shared store, so this one
  // refresh updates every consumer. Bounded and self-cleaning; the dashboard's
  // data hooks fetch the tier-gated API independently, so they self-heal too.
  useEffect(() => {
    if (pathname !== '/dashboard') return;
    let trialStarted = false;
    try {
      trialStarted = new URLSearchParams(window.location.search).get('trial_started') === '1';
    } catch {
      // A malformed query string must never break the layout.
    }
    if (!trialStarted) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      void refreshAuth();
      if (tries >= 3) window.clearInterval(id);
    }, 3000);
    return () => window.clearInterval(id);
  }, [pathname, refreshAuth]);

  const shouldShowDisclaimer =
    !DISCLAIMER_SUPPRESSED_ROUTES.has(pathname) &&
    authSession?.authenticated === true &&
    authSession.user?.disclaimerVersionAcknowledged !== DISCLAIMER_VERSION &&
    !acknowledgedLocally;

  const disclaimerModal = shouldShowDisclaimer ? (
    <DisclaimerModal
      theme={theme}
      onAcknowledged={() => {
        setAcknowledgedLocally(true);
        void refreshAuth();
      }}
    />
  ) : null;

  // Waits for the disclaimer to clear so the two don't overlap. Deadline and
  // sessionStorage checks come from the useSyncExternalStore snapshot above.
  const shouldShowFoundingLockin =
    !shouldShowDisclaimer &&
    foundingLockinGatePassed &&
    !foundingLockinClosed &&
    !FOUNDING_LOCKIN_SUPPRESSED_ROUTES.has(pathname) &&
    authSession?.authenticated === true &&
    authSession.user?.foundingEligible === true &&
    authSession.user?.hasActiveSubscription === false &&
    !authSession.user?.foundingLockinDismissedAt;

  const markFoundingLockinSeenForSession = useCallback(() => {
    try {
      window.sessionStorage.setItem(FOUNDING_LOCKIN_SESSION_KEY, '1');
    } catch {
      // sessionStorage unavailable (private mode quirks); the in-memory flag
      // below still prevents re-render within this tab.
    }
    setFoundingLockinClosed(true);
  }, []);

  const foundingLockinModal = shouldShowFoundingLockin ? (
    <FoundingLockinModal
      theme={theme}
      onClose={markFoundingLockinSeenForSession}
      onDismissedPermanently={() => {
        markFoundingLockinSeenForSession();
        void refreshAuth();
      }}
    />
  ) : null;

  // One-time "Welcome to Pro" onboarding. Waits for the disclaimer AND founding
  // modals to clear so at most one modal is ever on screen. Gated by the server
  // seen-flag (isProWelcomeEligible) plus the sessionStorage backstop, and
  // suppressed on the auth/legal/checkout/account routes. Fires for a freshly
  // subscribed Pro member on their first landing back from Stripe checkout.
  const shouldShowProWelcome =
    !shouldShowDisclaimer &&
    !shouldShowFoundingLockin &&
    proWelcomeGatePassed &&
    !proWelcomeClosed &&
    !PRO_WELCOME_SUPPRESSED_ROUTES.has(pathname) &&
    authSession?.authenticated === true &&
    isProWelcomeEligible(authSession.user);

  const markProWelcomeSeenForSession = useCallback(() => {
    try {
      window.sessionStorage.setItem(PRO_WELCOME_SESSION_KEY, '1');
    } catch {
      // sessionStorage unavailable (private-mode quirks); the in-memory flag
      // below still prevents re-render within this tab.
    }
    setProWelcomeClosed(true);
  }, []);

  const proWelcomeModal = shouldShowProWelcome ? (
    <ProWelcomeModal
      theme={theme}
      onClose={() => {
        markProWelcomeSeenForSession();
        void refreshAuth();
      }}
    />
  ) : null;

  if (STANDALONE_ROUTES.includes(pathname)) {
    return (
      <>
        {children}
        {disclaimerModal}
        {foundingLockinModal}
        {proWelcomeModal}
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TechnicalSnapshotPrewarm />
      <OptionChainPrewarm />
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <Navigation theme={theme} />
      <main className="zg-faceplate md:pl-[var(--zgx-nav-width,0px)]" style={{ flex: 1, paddingTop: "var(--zgx-nav-height, 0px)" }}>
        {children}
      </main>
      <Footer theme={theme} />
      {disclaimerModal}
      {foundingLockinModal}
      {proWelcomeModal}
    </div>
  );
}
