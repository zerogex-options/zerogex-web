'use client';

import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import Header from './Header';
import Navigation from './Navigation';

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
      }}
    >
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <Navigation theme={theme} />
      {children}
    </div>
  );
}
