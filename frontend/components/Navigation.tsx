'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface NavigationProps {
  theme: Theme;
}

export default function Navigation({ theme }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();

  const pages = [
    { id: '/', label: 'DASHBOARD' },
    { id: '/charts', label: 'CHARTS' },
    { id: '/flow-analysis', label: 'FLOW ANALYSIS' },
    { id: '/greeks-gex', label: 'GREEKS & GEX' },
    { id: '/intraday-tools', label: 'INTRADAY TOOLS' },
    { id: '/about', label: 'ABOUT' },
  ];

  return (
    <nav
      className="border-b"
      style={{
        backgroundColor: theme === 'dark' ? colors.bgDark : colors.bgLight,
        borderColor: colors.muted,
      }}
    >
      <div className="container mx-auto px-6">
        <div className="flex overflow-x-auto">
          {pages.map((page) => {
            const isActive = pathname === page.id;
            
            return (
              <button
                key={page.id}
                onClick={() => router.push(page.id)}
                className="px-6 py-4 font-semibold text-sm whitespace-nowrap transition-all duration-200 relative group"
                style={{
                  color: isActive ? colors.bearish : (theme === 'dark' ? colors.light : colors.dark),
                  opacity: isActive ? 1 : 0.6,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? `${colors.bearish}10` : `${colors.bearish}05`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {page.label}
                {isActive && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{
                      backgroundColor: colors.bearish,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
