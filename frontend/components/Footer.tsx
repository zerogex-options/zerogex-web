'use client';

import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface FooterProps {
  theme: Theme;
}

export default function Footer({ theme }: FooterProps) {
  return (
    <footer
      className="border-t mt-16"
      style={{
        backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
        borderColor: colors.muted,
      }}
    >
      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <img 
            src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
            alt="ZeroGEX" 
            style={{
              height: '320px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
          
          {/* Disclaimer and Copyright */}
          <div className="text-center text-sm" style={{ color: colors.muted }}>
            <p className="mb-2">
              Trading involves substantial risk. Past performance is not indicative of future results.
            </p>
            <p>
              © 2026 ZeroGEX, LLC. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
