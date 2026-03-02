'use client';

import { useState, useEffect } from 'react';
import { Menu, X, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch real market data
  const { data: quoteData } = useMarketQuote(1000);
  const { data: previousCloseData } = usePreviousClose(selectedSymbol, 60000);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('headerCollapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('headerCollapsed', String(newState));
  };

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
      <div className="container mx-auto px-6" style={{ paddingTop: isCollapsed ? '8px' : '16px', paddingBottom: isCollapsed ? '8px' : '16px', transition: 'padding 0.3s ease' }}>
        {/* Desktop Layout */}
        <div className="hidden md:block relative">
          {isCollapsed ? (
            // Collapsed Layout - Single Line with Absolute Centered Logo
            <div className="relative flex items-center justify-between" style={{ paddingRight: '48px' }}>
              {/* Left: Dropdowns + Live Price */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="px-2 py-1 rounded-lg border text-xs font-semibold transition-all duration-200"
                    style={{
                      backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                      borderColor: colors.muted,
                      color: theme === 'dark' ? colors.light : colors.dark,
                      width: '90px',
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
                    className="px-2 py-1 rounded-lg border text-xs font-semibold transition-all duration-200"
                    style={{
                      backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                      borderColor: colors.muted,
                      color: theme === 'dark' ? colors.light : colors.dark,
                      width: '90px',
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
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-xl">${livePrice.price.toFixed(2)}</span>
                    <div 
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-xs w-fit"
                      style={{
                        backgroundColor: theme === 'dark' ? `${isPositive ? colors.bullish : colors.bearish}15` : `${isPositive ? colors.bullish : colors.bearish}10`,
                        color: isPositive ? colors.bullish : colors.bearish,
                      }}
                    >
                      {isPositive ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
                      {isPositive ? '+' : ''}{livePrice.change.toFixed(2)} ({isPositive ? '+' : ''}{livePrice.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                )}
              </div>

              {/* Absolute Center: Logo */}
              <div 
                className="absolute left-1/2 top-1/2 pointer-events-none"
                style={{
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <img 
                  src={theme === 'dark' ? '/title-dark.svg' : '/title-light.svg'}
                  alt="ZeroGEX" 
                  style={{
                    height: '60px',
                    width: 'auto',
                    objectFit: 'contain',
                    transition: 'height 0.3s ease',
                    pointerEvents: 'auto'
                  }}
                />
              </div>

              {/* Right: Text Times + Session Circle (pulled in from right) */}
              <div className="flex items-center gap-4" style={{ marginRight: '24px' }}>
                <WorldClocks theme={theme} session={session} compact={true} />
                <div onClick={() => setShowCountdown(!showCountdown)} style={{ cursor: 'pointer' }}>
                  <SessionBadge session={session} theme={theme} showCountdown={showCountdown} compact={true} />
                </div>
              </div>

              {/* Collapse Toggle Button - Rightmost */}
              <button
                onClick={toggleCollapsed}
                className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-10 absolute right-0"
                style={{
                  color: colors.muted,
                  backgroundColor: 'transparent',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${colors.muted}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Expand header"
              >
                <ChevronDown size={20} />
              </button>
            </div>
          ) : (
            // Expanded Layout - Original with right padding for toggle button
            <div style={{ paddingRight: '48px' }}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
                {/* Left Column - Dropdowns & Quote */}
                <div className="flex items-center gap-4">
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

                {/* Right Column - with padding to avoid toggle button */}
                <div className="flex flex-col gap-2 items-end">
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
                  src={theme === 'dark' ? '/title-dark.svg' : '/title-light.svg'}
                  alt="ZeroGEX" 
                  style={{
                    height: '140px',
                    width: 'auto',
                    objectFit: 'contain',
                    pointerEvents: 'auto',
                    transition: 'height 0.3s ease'
                  }}
                />
              </div>

              {/* Collapse Toggle Button - Top Right */}
              <button
                onClick={toggleCollapsed}
                className="absolute top-0 right-0 p-2 rounded-lg transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: colors.muted,
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${colors.muted}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Collapse header"
              >
                <ChevronUp size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Layout - Always Collapsed */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-4">
            <img 
              src={theme === 'dark' ? '/title-dark.svg' : '/title-light.svg'}
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
