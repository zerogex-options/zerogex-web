'use client';

import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import Header from './Header';
import Navigation from './Navigation';
import Footer from './Footer';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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
      <Navigation theme={theme} />
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <Footer theme={theme} />
    </div>
  );
}
