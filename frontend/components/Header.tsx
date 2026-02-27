'use client';

import { useState, useEffect } from 'react';
import { Menu, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Theme, LivePrice } from '@/core/types';
import { getMarketSession } from '@/core/utils';
import { colors } from '@/core/colors';
import SessionBadge from './SessionBadge';
import WorldClocks from './WorldClocks';
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
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1min');

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const livePrice = { ...mockLivePrice, symbol: selectedSymbol };
  const isPositive = livePrice.change >= 0;

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
          {/* Logo & Dropdowns */}
          <div className="flex items-center gap-6">
            <img 
              src={theme === 'dark' ? '/title-dark.png' : '/title-light.png'}
              alt="ZeroGEX" 
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
            
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                borderColor: colors.muted,
                color: theme === 'dark' ? colors.light : colors.dark,
              }}
            >
              <option>SPY</option>
              <option>SPX</option>
              <option>QQQ</option>
              <option>IWM</option>
            </select>

            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                borderColor: colors.muted,
                color: theme === 'dark' ? colors.light : colors.dark,
              }}
            >
              <option value="1min">1 Min</option>
              <option value="5min">5 Min</option>
              <option value="15min">15 Min</option>
              <option value="1hr">1 Hour</option>
              <option value="1day">1 Day</option>
            </select>
          </div>

          {/* Desktop: Live Data */}
          <div className="hidden lg:flex items-center gap-4 flex-1 justify-center">
            <span className="font-semibold text-sm opacity-60">{livePrice.symbol}</span>
            <span className="font-bold text-2xl">${livePrice.price.toFixed(2)}</span>
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-sm"
              style={{
                backgroundColor: theme === 'dark' ? `${isPositive ? colors.bullish : colors.bearish}15` : `${isPositive ? colors.bullish : colors.bearish}10`,
                color: isPositive ? colors.bullish : colors.bearish,
              }}
            >
              {isPositive ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
              {isPositive ? '+' : ''}{livePrice.change.toFixed(2)} ({isPositive ? '+' : ''}{livePrice.changePercent.toFixed(2)}%)
            </div>
            <div className="text-sm font-mono opacity-60">
              Vol <span className="font-semibold opacity-90">{livePrice.volume}</span>
            </div>
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
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-sm opacity-60">{livePrice.symbol}</span>
              <span className="font-bold text-2xl">${livePrice.price.toFixed(2)}</span>
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-sm"
                style={{
                  backgroundColor: theme === 'dark' ? `${isPositive ? colors.bullish : colors.bearish}15` : `${isPositive ? colors.bullish : colors.bearish}10`,
                  color: isPositive ? colors.bullish : colors.bearish,
                }}
              >
                {isPositive ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
                {isPositive ? '+' : ''}{livePrice.change.toFixed(2)} ({isPositive ? '+' : ''}{livePrice.changePercent.toFixed(2)}%)
              </div>
            </div>
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
