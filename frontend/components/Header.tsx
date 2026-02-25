'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Theme, LivePrice } from '@/core/types';
import { getMarketSession } from '@/core/utils';
import { colors } from '@/core/colors';
import SessionBadge from './SessionBadge';
import WorldClocks from './WorldClocks';
import LivePriceWidget from './LivePriceWidget';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

// Mock data - will be replaced with real API
const mockLivePrice: LivePrice = {
  symbol: 'SPY',
  price: 585.42,
  change: 2.34,
  changePercent: 0.40,
  volume: '45.2M',
};

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const [session, setSession] = useState(getMarketSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="border-b sticky top-0 z-40 backdrop-blur-md"
      style={{
        backgroundColor: theme === 'dark' ? `${colors.bgDark}ee` : `${colors.bgLight}ee`,
        borderColor: colors.muted,
      }}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <h1 
              className="text-2xl font-bold"
              style={{ color: colors.bearish }}
            >
              ZeroGEX
            </h1>
            <select
              className="px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                borderColor: colors.muted,
                color: theme === 'dark' ? colors.light : colors.dark,
              }}
            >
              <option>SPY</option>
            </select>
          </div>

          {/* Desktop: Live Data */}
          <div className="hidden lg:flex items-center gap-4 flex-1 justify-center">
            <LivePriceWidget data={mockLivePrice} theme={theme} />
          </div>

          {/* Desktop: Clocks & Session */}
          <div className="hidden md:flex items-center gap-4">
            <WorldClocks theme={theme} />
            <SessionBadge session={session} theme={theme} />
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>

          {/* Mobile: Menu Toggle */}
          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile: Expanded Menu */}
        {mobileMenuOpen && (
          <div className="mt-4 space-y-4 md:hidden">
            <LivePriceWidget data={mockLivePrice} theme={theme} />
            <div className="flex items-center justify-between">
              <WorldClocks theme={theme} />
            </div>
            <SessionBadge session={session} theme={theme} />
          </div>
        )}
      </div>
    </header>
  );
}
