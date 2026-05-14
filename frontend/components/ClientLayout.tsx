'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useAuthSession } from '@/hooks/useAuthSession';
import { DISCLAIMER_VERSION } from '@/core/disclaimer';
import Header from './Header';
import Navigation from './Navigation';
import Footer from './Footer';
import DisclaimerModal from './DisclaimerModal';
import TechnicalSnapshotPrewarm from './TechnicalSnapshotPrewarm';
import OptionChainPrewarm from './OptionChainPrewarm';

// Routes that render their own full-page layout (no app chrome)
const STANDALONE_ROUTES = ['/', '/about', '/pricing', '/login', '/register', '/unauthorized', '/terms', '/privacy'];

// Routes where the disclaimer modal should not interrupt the user (the auth
// flow itself, and the public terms/privacy pages which already contain the
// full legal text).
const DISCLAIMER_SUPPRESSED_ROUTES = new Set(['/login', '/register', '/unauthorized', '/terms', '/privacy', '/forgot-password', '/reset-password']);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { data: authSession, refresh: refreshAuth } = useAuthSession();
  const [acknowledgedLocally, setAcknowledgedLocally] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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

  if (STANDALONE_ROUTES.includes(pathname)) {
    return (
      <>
        {children}
        {disclaimerModal}
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'transparent',
        color: theme === 'dark' ? colors.light : colors.dark,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TechnicalSnapshotPrewarm />
      <OptionChainPrewarm />
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <Navigation theme={theme} />
      <main className="md:pl-[var(--zgx-nav-width,0px)]" style={{ flex: 1, paddingTop: "var(--zgx-nav-height, 0px)" }}>
        {children}
      </main>
      <Footer theme={theme} />
      {disclaimerModal}
    </div>
  );
}
