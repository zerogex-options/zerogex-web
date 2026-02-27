'use client';

import { useState, useEffect } from 'react';
import { Menu, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Theme } from '@/core/types';
import { getMarketSession } from '@/core/utils';
import { colors } from '@/core/colors';
import SessionBadge from './SessionBadge';
import WorldClocks from './WorldClocks';
import ThemeToggle from './ThemeToggle';
import { useMarketQuote, usePreviousClose } from '@/hooks/useApiData';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const [session, setSession] = useState(getMarketSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1min');

  // Fetch real market data
  const { data: quoteData } = useMarketQuote(1000);
  const { data: previousCloseData } = usePreviousClose(selectedSymbol, 60000);

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate change from previous close
  const livePrice = quoteData && previousCloseData ? {
    symbol: selectedSymbol,
    price: quoteData.close,
    change: quoteData.close - previousCloseData.previous_close,
    changePercent: ((quoteData.close - previousCloseData.previous_close) / previousCloseData.previous_close) * 100,
    volume: `${(quoteData.volume / 1000000).toFixed(1)}M`,
  } : null;

  const isPositive = livePrice ? livePrice.change >= 0 : false;

  return (
    <header
      className="border-b sticky top-0 z-40 backdrop-blur-md"
      style={{
        backgroundColor: theme === 'dark' ? `${colors.bgDark}ee` : `${colors.bgLight}ee`,
        borderColor: colors.muted,
      }}
    >
      <div className="container mx-auto px-6 py-6">
        {/* Top Row - Logo Centered */}
        <div className="flex justify-center mb-6">
          <img 
            src={theme === 'dark' ? '/title-dark.png' : '/title-light.png'}
            alt="ZeroGEX" 
            style={{
              height: '144px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Middle Row - Controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          {/* Left: Dropdowns & Live Price */}
          <div className="flex items-center gap-4">
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="px-4 py-2 rounded-lg border text-sm font-semibold transition-all duration-200"
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
              className="px-4 py-2 rounded-lg border text-sm font-semibold transition-all duration-200"
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

            {livePrice && (
              <>
                <div style={{ width: '2px', height: '40px', backgroundColor: colors.muted, opacity: 0.3 }} />
                <span className="font-semibold text-sm opacity-60">{livePrice.symbol}</span>
                <span className="font-bold text-3xl">${livePrice.price.toFixed(2)}</span>
                <div 
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-base"
                  style={{
                    backgroundColor: theme === 'dark' ? `${isPositive ? colors.bullish : colors.bearish}15` : `${isPositive ? colors.bullish : colors.bearish}10`,
                    color: isPositive ? colors.bullish : colors.bearish,
                  }}
                >
                  {isPositive ? <TrendingUp size={16} strokeWidth={2.5} /> : <TrendingDown size={16} strokeWidth={2.5} />}
                  {isPositive ? '+' : ''}{livePrice.change.toFixed(2)} ({isPositive ? '+' : ''}{livePrice.changePercent.toFixed(2)}%)
                </div>
                <div className="text-base font-mono opacity-60">
                  Vol <span className="font-semibold opacity-90">{livePrice.volume}</span>
                </div>
              </>
            )}
          </div>

          {/* Right: Session & Theme */}
          <div className="hidden md:flex items-center gap-4">
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

        {/* Bottom Row - World Clocks (Right Aligned) */}
        <div className="hidden md:flex justify-end">
          <WorldClocks theme={theme} session={session} />
        </div>

        {/* Mobile: Expanded Menu */}
        {mobileMenuOpen && (
          <div className="mt-4 space-y-4 md:hidden">
            {livePrice && (
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
            )}
            <WorldClocks theme={theme} session={session} />
            <SessionBadge session={session} theme={theme} />
          </div>
        )}
      </div>
    </header>
  );
}
