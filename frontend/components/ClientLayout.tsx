'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import Header from './Header';
import Navigation from './Navigation';
import Footer from './Footer';

// Routes that render their own full-page layout (no app chrome)
const STANDALONE_ROUTES = ['/', '/about'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (STANDALONE_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: theme === 'dark' ? colors.bgDark : colors.bgLight,
        color: theme === 'dark' ? colors.light : colors.dark,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <Navigation theme={theme} onToggleTheme={toggleTheme} />
      <main className="md:pl-[var(--zgx-nav-width,0px)]" style={{ flex: 1, paddingTop: "var(--zgx-nav-height, 0px)" }}>
        {children}
      </main>
      <Footer theme={theme} />
    </div>
  );
}
