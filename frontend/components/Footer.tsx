'use client';

import Link from 'next/link';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface FooterProps {
  theme: Theme;
}

const border = 'rgba(150,143,146,0.25)';

export default function Footer({ theme }: FooterProps) {
  const isDark = theme === 'dark';
  const subtext = isDark ? colors.muted : '#6b636a';
  const textLight = isDark ? colors.light : '#1a1618';

  return (
    <footer
      className="border-t mt-16"
      style={{
        background: isDark
          ? `linear-gradient(135deg, ${colors.cardDark}66 0%, rgba(42,38,40,0.8) 100%)`
          : 'rgba(200,195,200,0.2)',
        borderColor: border,
      }}
    >
      <div className="container mx-auto px-6 py-12">
        {/* Desktop layout: 3-column row */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 32 }}>

          {/* Left: link columns */}
          <div style={{ flex: 1, display: 'flex', gap: 48, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {/* Platform */}
            <div>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: colors.primary, marginBottom: 14,
                }}
              >
                Platform
              </div>
              {[
                ['/dashboard', 'Dashboard'],
                ['/gamma-exposure', 'Gamma Exposure'],
                ['/flow-analysis', 'Flow Analysis'],
                ['/trading-signals', 'Trading Signals'],
              ].map(([href, label]) => (
                <div key={href} style={{ marginBottom: 8 }}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textLight; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subtext; }}
                  >
                    {label}
                  </Link>
                </div>
              ))}
            </div>

            {/* Tools */}
            <div>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: colors.primary, marginBottom: 14,
                }}
              >
                Tools
              </div>
              {[
                ['/intraday-tools', 'Intraday Tools'],
                ['/max-pain', 'Max Pain'],
                ['/options-calculator', 'Options Calc'],
                ['/about', 'About'],
              ].map(([href, label]) => (
                <div key={href} style={{ marginBottom: 8 }}>
                  <Link
                    href={href}
                    style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textLight; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subtext; }}
                  >
                    {label}
                  </Link>
                </div>
              ))}
            </div>

            {/* More */}
            <div>
              <div
                style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: colors.primary, marginBottom: 14,
                }}
              >
                More
              </div>
              <div style={{ marginBottom: 8 }}>
                <a
                  href="https://api.zerogex.io/docs"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textLight; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subtext; }}
                >
                  API Docs
                </a>
              </div>
            </div>
          </div>

          {/* Center: large logo */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img
              src={isDark ? '/logo-dark.svg' : '/logo-light.svg'}
              alt="ZeroGEX"
              style={{ height: '480px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {/* Right: copyright + disclaimer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <p style={{ fontSize: 12, color: subtext, margin: 0, textAlign: 'right' }}>
              © 2026 ZeroGEX, LLC. All rights reserved.
            </p>
            <p style={{ fontSize: 12, color: subtext, margin: 0, lineHeight: 1.6, textAlign: 'right', maxWidth: 260 }}>
              Trading involves substantial risk. Past performance is not indicative of future results.
              This platform is for informational purposes only, not investment advice.
            </p>
          </div>

        </div>

        {/* Mobile layout: 2-column */}
        <div className="flex md:hidden" style={{ gap: 24 }}>

          {/* Left column: link groups */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.primary, marginBottom: 14 }}>
                Platform
              </div>
              {[
                ['/dashboard', 'Dashboard'],
                ['/gamma-exposure', 'Gamma Exposure'],
                ['/flow-analysis', 'Flow Analysis'],
                ['/trading-signals', 'Trading Signals'],
              ].map(([href, label]) => (
                <div key={href} style={{ marginBottom: 8 }}>
                  <Link href={href} style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}>{label}</Link>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.primary, marginBottom: 14 }}>
                Tools
              </div>
              {[
                ['/intraday-tools', 'Intraday Tools'],
                ['/max-pain', 'Max Pain'],
                ['/options-calculator', 'Options Calc'],
                ['/about', 'About'],
              ].map(([href, label]) => (
                <div key={href} style={{ marginBottom: 8 }}>
                  <Link href={href} style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}>{label}</Link>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.primary, marginBottom: 14 }}>
                More
              </div>
              <div style={{ marginBottom: 8 }}>
                <a href="https://api.zerogex.io/docs" target="_blank" rel="noreferrer" style={{ fontSize: 13, color: subtext, textDecoration: 'none' }}>
                  API Docs
                </a>
              </div>
            </div>
          </div>

          {/* Right column: logo + copyright + disclaimer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <img
              src={isDark ? '/logo-dark-small.svg' : '/logo-light-small.svg'}
              alt="ZeroGEX"
              style={{ height: '360px', width: 'auto', objectFit: 'contain' }}
            />
            <p style={{ fontSize: 12, color: subtext, margin: 0, textAlign: 'right' }}>
              © 2026 ZeroGEX, LLC. All rights reserved.
            </p>
            <p style={{ fontSize: 12, color: subtext, margin: 0, lineHeight: 1.6, textAlign: 'right' }}>
              Trading involves substantial risk. Past performance is not indicative of future results.
              This platform is for informational purposes only, not investment advice.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}
