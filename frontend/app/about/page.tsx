'use client';

import { useEffect, useState } from 'react';
import { colors } from '@/core/colors';

export default function AboutPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const bodyBg = document.body.style.backgroundColor;
      setTheme(bodyBg === colors.bgDark ? 'dark' : 'light');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 
        className="text-3xl font-bold"
        style={{ color: theme === 'dark' ? colors.light : colors.dark }}
      >
        About ZeroGEX
      </h2>
      <div
        className="p-8 rounded-2xl space-y-6"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div>
          <h3 
            className="text-xl font-bold mb-3"
            style={{ color: theme === 'dark' ? colors.light : colors.dark }}
          >
            Professional-Grade Options Flow Analytics
          </h3>
          <p className="leading-relaxed" style={{ color: colors.muted }}>
            ZeroGEX is a real-time options analytics platform that provides institutional-quality gamma exposure (GEX) analysis,
            options flow tracking, and dealer positioning insights for retail traders.
          </p>
        </div>
        
        <div>
          <h3 
            className="text-xl font-bold mb-3"
            style={{ color: theme === 'dark' ? colors.light : colors.dark }}
          >
            What We Track
          </h3>
          <ul className="space-y-2" style={{ color: colors.muted }}>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Real-time gamma exposure by strike level</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Dealer hedging flow and market impact</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Unusual options activity and smart money trades</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Put/call ratios and directional sentiment</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">•</span>
              <span>Intraday support/resistance from option positioning</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 
            className="text-xl font-bold mb-3"
            style={{ color: theme === 'dark' ? colors.light : colors.dark }}
          >
            How It Works
          </h3>
          <p className="leading-relaxed" style={{ color: colors.muted }}>
            Our platform ingests live options data from TradeStation, calculates Greeks using Black-Scholes models,
            and aggregates dealer positioning to identify key price levels where market makers will be forced to hedge.
            This creates predictable support and resistance zones that day traders can exploit.
          </p>
        </div>

        <div>
          <h3 
            className="text-xl font-bold mb-3"
            style={{ color: theme === 'dark' ? colors.light : colors.dark }}
          >
            Technology
          </h3>
          <p className="leading-relaxed" style={{ color: colors.muted }}>
            Built with Python, PostgreSQL, TimescaleDB, and AWS infrastructure for institutional-grade performance and reliability.
            Data updates every second during market hours.
          </p>
        </div>
      </div>
    </div>
  );
}
