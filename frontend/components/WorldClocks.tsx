'use client';

import { useState, useEffect } from 'react';
import { Theme, MarketSession } from '@/core/types';
import { colors } from '@/core/colors';

interface WorldClocksProps {
  theme: Theme;
  session: MarketSession;
  hideCountdown?: boolean;
}

function AnalogClock({ time, label, theme }: { time: Date; label: string; theme: Theme }) {
  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="70" height="70" viewBox="0 0 100 100">
        {/* Clock face */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={colors.muted}
          strokeWidth="3"
        />
        
        {/* Hour markers */}
        {[...Array(12)].map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 50 + 38 * Math.cos(angle);
          const y1 = 50 + 38 * Math.sin(angle);
          const x2 = 50 + 44 * Math.cos(angle);
          const y2 = 50 + 44 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colors.muted}
              strokeWidth="3"
            />
          );
        })}

        {/* Hour hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 25 * Math.sin((hourAngle * Math.PI) / 180)}
          y2={50 - 25 * Math.cos((hourAngle * Math.PI) / 180)}
          stroke={theme === 'dark' ? colors.light : colors.dark}
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 35 * Math.sin((minuteAngle * Math.PI) / 180)}
          y2={50 - 35 * Math.cos((minuteAngle * Math.PI) / 180)}
          stroke={theme === 'dark' ? colors.light : colors.dark}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Second hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 38 * Math.sin((secondAngle * Math.PI) / 180)}
          y2={50 - 38 * Math.cos((secondAngle * Math.PI) / 180)}
          stroke={colors.bearish}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx="50" cy="50" r="4" fill={colors.bearish} />
      </svg>
      
      <div className="text-xs font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>
        {label}
      </div>
      <div className="text-sm font-bold opacity-80" style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
    </div>
  );
}

export default function WorldClocks({ theme, session, hideCountdown = false }: WorldClocksProps) {
  const [times, setTimes] = useState({
    ny: new Date(),
    london: new Date(),
    tokyo: new Date(),
  });

  useEffect(() => {
    const updateAll = () => {
      const now = new Date();
      
      setTimes({
        ny: new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })),
        london: new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' })),
        tokyo: new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })),
      });
    };

    updateAll();
    const interval = setInterval(updateAll, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4">
      <AnalogClock time={times.ny} label="NEW YORK" theme={theme} />
      <AnalogClock time={times.london} label="LONDON" theme={theme} />
      <AnalogClock time={times.tokyo} label="TOKYO" theme={theme} />
    </div>
  );
}
