'use client';

import { useState, useEffect } from 'react';
import { Menu, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Theme } from '@/core/types';
import { useTimeframe } from '@/core/TimeframeContext';
import { getMarketSession } from '@/core/utils';
import { colors } from '@/core/colors';
import SessionBadge from './SessionBadge';
import WorldClocks from './WorldClocks';
import { useMarketQuote, usePreviousClose } from '@/hooks/useApiData';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const [session, setSession] = useState(getMarketSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');
  const { timeframe, setTimeframe } = useTimeframe();
  const [showCountdown, setShowCountdown] = useState(false);

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
  } : null;

  const isPositive = livePrice ? livePrice.change >= 0 : false;

  return (
    <header
      className="border-b sticky top-0 z-40"
      style={{
        backgroundColor: theme === 'dark' ? colors.bgDark : colors.bgLight,
        borderColor: colors.muted,
      }}
    >
      <div className="container mx-auto px-6 py-4">
        {/* Desktop Layout */}
        <div className="hidden md:block relative">
          {/* Main grid for left and right content */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
            
            {/* Left Column - Dropdowns & Quote */}
            <div className="flex items-center gap-4">
              {/* Dropdowns */}
              <div className="flex flex-col gap-2">
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                    borderColor: colors.muted,
                    color: theme === 'dark' ? colors.light : colors.dark,
                    width: '120px',
                  }}
                >
                  <option>SPY</option>
                  <option>SPX</option>
                  <option>QQQ</option>
                  <option>IWM</option>
                </select>

                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                    borderColor: colors.muted,
                    color: theme === 'dark' ? colors.light : colors.dark,
                    width: '120px',
                  }}
                >
                  <option value="1min">1 Min</option>
                  <option value="5min">5 Min</option>
                  <option value="15min">15 Min</option>
                  <option value="1hr">1 Hour</option>
                  <option value="1day">1 Day</option>
                </select>
              </div>

              {/* Live Price */}
              {livePrice && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-2xl">${livePrice.price.toFixed(2)}</span>
                  <div 
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-sm w-fit"
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
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-2 items-end">
              {/* Session Badge */}
              <div 
                onClick={() => setShowCountdown(!showCountdown)}
                style={{ cursor: 'pointer' }}
              >
                <SessionBadge 
                  session={session} 
                  theme={theme} 
                  showCountdown={showCountdown}
                />
              </div>
              
              {/* World Clocks */}
              <div className="scale-90 origin-right">
                <WorldClocks theme={theme} session={session} hideCountdown={true} />
              </div>
            </div>
          </div>

          {/* Absolutely centered logo */}
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ top: 0, bottom: 0 }}
          >
            <img 
              src={theme === 'dark' ? '/title-dark.png' : '/title-light.png'}
              alt="ZeroGEX" 
              style={{
                height: '140px',
                width: 'auto',
                objectFit: 'contain',
                pointerEvents: 'auto'
              }}
            />
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-4">
            <img 
              src={theme === 'dark' ? '/title-dark.png' : '/title-light.png'}
              alt="ZeroGEX" 
              style={{
                height: '48px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm font-semibold"
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
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm font-semibold"
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

              {livePrice && (
                <div className="flex items-center gap-4 flex-wrap">
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
              <div className="flex items-center gap-2">
                <div onClick={() => setShowCountdown(!showCountdown)} style={{ cursor: 'pointer' }}>
                  <SessionBadge session={session} theme={theme} showCountdown={showCountdown} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
