'use client';

import { useState } from 'react';
import { Theme } from '@/lib/types';
import { colors } from '@/lib/colors';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>('dark');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: theme === 'dark' ? colors.bgDark : colors.bgLight,
          color: theme === 'dark' ? colors.light : colors.dark,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          margin: 0,
          minHeight: '100vh',
        }}
      >
        <Header theme={theme} onToggleTheme={toggleTheme} />
        <Navigation theme={theme} />
        <main className="container mx-auto px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
